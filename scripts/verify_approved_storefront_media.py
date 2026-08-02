#!/usr/bin/env python3
"""Block a release when approved product media breaks the storefront contract."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from PIL import Image, ImageChops


CANVAS_SIZE = (1600, 1200)
BACKGROUND = (242, 243, 243)
BACKGROUND_TOLERANCE = 1
MIN_INSET = 96
COHORT_WIDTH_SPREAD = 0.08
COHORT_HEIGHT_SPREAD = 0.10
COHORT_AXES = {
    "side": {"width"},
    "three-quarter": {"width"},
    "front": {"width"},
    "rear": {"height"},
    "sole": {"height"},
    "detail": {"width", "height"},
}
PRODUCT_TYPES = {"footwear", "apparel", "accessory"}
FRAME_SPECS = {
    "footwear": [
        ("primary", "side", "toe-left", "single"),
        ("gallery", "three-quarter", "toe-left", "pair"),
        ("gallery", "side", "toe-right", "single"),
        ("gallery", "rear", "rear-facing", "pair"),
        ("gallery", "sole", "not-applicable", "pair"),
    ],
    "apparel": [
        ("primary", "front", "front-facing", "single"),
        ("gallery", "rear", "rear-facing", "single"),
        ("gallery", "side", "not-applicable", "single"),
        ("gallery", "detail", "not-applicable", "single"),
        ("gallery", "detail", "not-applicable", "single"),
    ],
    "accessory": [
        ("primary", "three-quarter", "not-applicable", "single"),
        ("gallery", "front", "front-facing", "single"),
        ("gallery", "rear", "rear-facing", "single"),
        ("gallery", "side", "not-applicable", "single"),
        ("gallery", "detail", "not-applicable", "single"),
    ],
}
OCCUPANCY_LIMITS = {
    "footwear": {
        "side": ((0.64, 0.86), (0.34, 0.66)),
        "three-quarter": ((0.62, 0.86), (0.36, 0.68)),
        "rear": ((0.34, 0.68), (0.48, 0.80)),
        "sole": ((0.35, 0.84), (0.62, 0.76)),
    },
    "apparel": {
        "front": ((0.40, 0.70), (0.68, 0.86)),
        "rear": ((0.40, 0.70), (0.68, 0.86)),
        "side": ((0.28, 0.58), (0.66, 0.86)),
        "detail": ((0.30, 0.74), (0.30, 0.74)),
    },
    "accessory": {
        "three-quarter": ((0.38, 0.80), (0.36, 0.80)),
        "front": ((0.34, 0.78), (0.38, 0.82)),
        "rear": ((0.34, 0.78), (0.38, 0.82)),
        "side": ((0.38, 0.82), (0.32, 0.78)),
        "detail": ((0.28, 0.76), (0.28, 0.76)),
    },
}
RIGHTS_STATUSES = {"licensed", "owned", "supplier-api", "owner-attested"}
SOURCE_KINDS = {"poizon-original", "brand-original", "supplier-original", "generated-reference"}


class MediaQaError(RuntimeError):
    """Raised with every actionable manifest and file failure."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_file(root: Path, value: Any) -> Path | None:
    if not isinstance(value, str) or not value:
        return None
    candidate = (root / value).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def valid_https_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlsplit(value)
    return (
        parsed.scheme == "https"
        and bool(parsed.hostname)
        and parsed.username is None
        and parsed.password is None
        and not parsed.fragment
    )


def valid_timestamp(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None


def validate_provenance(
    frame: dict[str, Any],
    frame_label: str,
    project_root: Path,
) -> list[str]:
    source_kind = frame.get("source_kind")
    if source_kind not in SOURCE_KINDS:
        return [f"{frame_label}: source_kind must identify original or generated provenance"]
    if source_kind == "generated-reference":
        generation = frame.get("generation")
        if not isinstance(generation, dict):
            return [f"{frame_label}: generated-reference requires generation evidence"]
        errors = []
        if not isinstance(generation.get("model"), str) or not generation["model"].strip():
            errors.append(f"{frame_label}: generation.model is required")
        source = safe_file(project_root, generation.get("source_file"))
        if source is None or not source.is_file():
            errors.append(f"{frame_label}: generation.source_file must exist inside the project")
        elif generation.get("source_sha256") != sha256_file(source):
            errors.append(f"{frame_label}: generation.source_sha256 does not match")
        prompt = safe_file(project_root, generation.get("prompt_reference"))
        if prompt is None or not prompt.is_file():
            errors.append(f"{frame_label}: generation.prompt_reference must exist inside the project")
        return errors

    source = frame.get("source")
    if not isinstance(source, dict):
        return [f"{frame_label}: original source requires provider evidence"]
    errors = []
    if not valid_https_url(source.get("product_url")):
        errors.append(f"{frame_label}: source.product_url must be a credential-free HTTPS URL")
    if not valid_https_url(source.get("asset_url")):
        errors.append(f"{frame_label}: source.asset_url must be a credential-free HTTPS URL")
    if not valid_timestamp(source.get("observed_at")):
        errors.append(f"{frame_label}: source.observed_at must be a timezone-aware timestamp")
    identifiers = source.get("identifiers")
    if not isinstance(identifiers, dict) or not any(
        isinstance(identifiers.get(field), str) and identifiers[field].strip()
        for field in ("spu", "sku")
    ):
        errors.append(f"{frame_label}: source.identifiers must include SPU or SKU")
    intake = safe_file(project_root, source.get("intake_file"))
    if intake is None or not intake.is_file():
        errors.append(f"{frame_label}: source.intake_file must exist inside the project")
    elif source.get("intake_sha256") != sha256_file(intake):
        errors.append(f"{frame_label}: source.intake_sha256 does not match")
    return errors


def foreground_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    difference = ImageChops.difference(
        image,
        Image.new("RGB", image.size, BACKGROUND),
    )
    maximum = ImageChops.lighter(
        ImageChops.lighter(difference.getchannel("R"), difference.getchannel("G")),
        difference.getchannel("B"),
    )
    return maximum.point(
        lambda value: 255 if value > BACKGROUND_TOLERANCE else 0,
    ).getbbox()


def border_is_uniform(image: Image.Image) -> bool:
    width, height = image.size
    pixels = image.load()
    border = (
        (x, y)
        for x, y in (
            *((x, 0) for x in range(width)),
            *((x, height - 1) for x in range(width)),
            *((0, y) for y in range(1, height - 1)),
            *((width - 1, y) for y in range(1, height - 1)),
        )
    )
    return all(
        max(abs(channel - BACKGROUND[index]) for index, channel in enumerate(pixels[x, y]))
        <= BACKGROUND_TOLERANCE
        for x, y in border
    )


def validate_image(
    path: Path,
    product_type: str,
    angle: str,
) -> tuple[list[str], tuple[float, float] | None]:
    try:
        with Image.open(path) as source:
            source.load()
            if source.size != CANVAS_SIZE:
                return [f"{path}: canvas must be 1600x1200, got {source.width}x{source.height}"], None
            errors = []
            if source.mode != "RGB":
                errors.append(f"{path}: mode must be opaque RGB, got {source.mode}")
            image = source.convert("RGB")
            if not border_is_uniform(image):
                errors.append(f"{path}: canvas border must be flat RGB{BACKGROUND}")
            bbox = foreground_bbox(image)
    except (OSError, ValueError) as error:
        return [f"{path}: Pillow could not read image ({error})"], None

    if bbox is None:
        return [f"{path}: no foreground or shadow was detected against RGB{BACKGROUND}"], None
    left, top, right, bottom = bbox
    margins = (left, top, CANVAS_SIZE[0] - right, CANVAS_SIZE[1] - bottom)
    if min(margins) < MIN_INSET:
        errors.append(f"{path}: foreground/shadow bbox {bbox} violates the {MIN_INSET}px safe inset")
    width_ratio = (right - left) / CANVAS_SIZE[0]
    height_ratio = (bottom - top) / CANVAS_SIZE[1]
    width_limits, height_limits = OCCUPANCY_LIMITS[product_type][angle]
    if not width_limits[0] <= width_ratio <= width_limits[1]:
        errors.append(
            f"{path}: {product_type}/{angle} width {width_ratio:.3f} is outside "
            f"{width_limits[0]:.3f}-{width_limits[1]:.3f}"
        )
    if not height_limits[0] <= height_ratio <= height_limits[1]:
        errors.append(
            f"{path}: {product_type}/{angle} height {height_ratio:.3f} is outside "
            f"{height_limits[0]:.3f}-{height_limits[1]:.3f}"
        )
    return errors, (width_ratio, height_ratio)


def verify_manifest(manifest_path: Path, asset_root: Path) -> None:
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise MediaQaError(f"{manifest_path}: invalid manifest ({error})") from error
    if not isinstance(payload, dict) or payload.get("schema_version") != 2:
        raise MediaQaError(f"{manifest_path}: expected schema_version 2")
    skus = payload.get("skus")
    if not isinstance(skus, list) or payload.get("expected_sku_count") != len(skus):
        raise MediaQaError(f"{manifest_path}: expected_sku_count must equal the skus array length")
    if payload.get("canvas") != [*CANVAS_SIZE] or payload.get("background_rgb") != [*BACKGROUND]:
        raise MediaQaError(f"{manifest_path}: canvas/background contract does not match the verifier")

    errors: list[str] = []
    project_root = manifest_path.resolve().parent.parent
    seen_skus: set[str] = set()
    seen_paths: dict[str, str] = {}
    seen_hashes: dict[str, str] = {}
    cohorts: dict[tuple[str, str], list[tuple[str, float, float]]] = defaultdict(list)
    for sku_index, sku in enumerate(skus):
        label = f"skus[{sku_index}]"
        if not isinstance(sku, dict):
            errors.append(f"{label}: SKU must be an object")
            continue
        sku_id = sku.get("sku")
        product_type = sku.get("product_type")
        frames = sku.get("frames")
        rights = sku.get("rights")
        if not isinstance(sku_id, str) or not sku_id:
            errors.append(f"{label}: sku is required")
            continue
        if sku_id in seen_skus:
            errors.append(f"{label} ({sku_id}): duplicate SKU")
        seen_skus.add(sku_id)
        if product_type not in PRODUCT_TYPES:
            errors.append(f"{label} ({sku_id}): unsupported product_type {product_type!r}")
            continue
        if not isinstance(rights, dict) or rights.get("status") not in RIGHTS_STATUSES or not rights.get("evidence_reference"):
            errors.append(f"{label} ({sku_id}): rights status and evidence_reference are required")
        if not isinstance(frames, list) or len(frames) != 5:
            errors.append(f"{label} ({sku_id}): exactly 5 frames are required")
            continue
        for index, frame in enumerate(frames):
            frame_label = f"{label} ({sku_id}) frame {index + 1}"
            if not isinstance(frame, dict):
                errors.append(f"{frame_label}: frame must be an object")
                continue
            expected = FRAME_SPECS[product_type][index]
            actual = (
                frame.get("role"),
                frame.get("angle"),
                frame.get("orientation"),
                frame.get("composition"),
            )
            if actual != expected:
                errors.append(
                    f"{frame_label}: expected role/angle/orientation/composition {expected}, got {actual}"
                )
            errors.extend(validate_provenance(frame, frame_label, project_root))
            path = safe_file(asset_root, frame.get("file"))
            if path is None:
                errors.append(f"{frame_label}: file must be a relative path inside asset root")
                continue
            if not path.is_file():
                errors.append(f"{path}: file is missing")
                continue
            prior_path = seen_paths.setdefault(path.as_posix(), frame_label)
            if prior_path != frame_label:
                errors.append(f"{path}: path is reused by {prior_path} and {frame_label}")
            actual_hash = sha256_file(path)
            if frame.get("sha256") != actual_hash:
                errors.append(f"{path}: SHA-256 does not match manifest")
            prior_hash = seen_hashes.setdefault(actual_hash, frame_label)
            if prior_hash != frame_label:
                errors.append(f"{path}: duplicate image bytes with {prior_hash}")
            image_errors, ratios = validate_image(path, product_type, expected[1])
            errors.extend(image_errors)
            if ratios is not None:
                cohorts[(product_type, f"{expected[1]}:{expected[3]}")].append(
                    (frame_label, *ratios)
                )

    for (product_type, angle), values in cohorts.items():
        if len(values) < 2:
            continue
        widths = [value[1] for value in values]
        heights = [value[2] for value in values]
        base_angle = angle.split(":", 1)[0]
        if "width" in COHORT_AXES[base_angle] and max(widths) - min(widths) > COHORT_WIDTH_SPREAD:
            errors.append(
                f"{product_type}/{angle}: cohort width spread {max(widths) - min(widths):.3f} "
                f"exceeds {COHORT_WIDTH_SPREAD:.3f}"
            )
        if "height" in COHORT_AXES[base_angle] and max(heights) - min(heights) > COHORT_HEIGHT_SPREAD:
            errors.append(
                f"{product_type}/{angle}: cohort height spread {max(heights) - min(heights):.3f} "
                f"exceeds {COHORT_HEIGHT_SPREAD:.3f}"
            )
    if errors:
        raise MediaQaError("Approved storefront media QA failed:\n- " + "\n- ".join(errors))


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate approved five-frame storefront product media.")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("catalog-media/approved-storefront-media.json"),
    )
    parser.add_argument("--asset-root", type=Path, default=Path("public"))
    args = parser.parse_args()
    try:
        verify_manifest(args.manifest, args.asset_root)
    except MediaQaError as error:
        print(error)
        return 1
    print("Approved storefront media QA passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
