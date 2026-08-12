#!/usr/bin/env python3
"""Fail closed QA for the 100 x 5 unified catalog image contract.

The manifest is deliberately separate from the legacy featured-product media
manifest.  It describes the active five-frame set for every catalog SKU and
is safe to run before a release without altering any image files.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops

try:
    from scripts.portable_hash import BINARY_HASH_MODE, HASH_MODES, TEXT_LF_HASH_MODE, hash_mode_for_path, sha256_file
except ModuleNotFoundError:  # Direct execution: python scripts/verify_*.py
    from portable_hash import BINARY_HASH_MODE, HASH_MODES, TEXT_LF_HASH_MODE, hash_mode_for_path, sha256_file


CANVAS_SIZE = (1600, 1200)
BACKGROUND = (242, 243, 243)
EXPECTED_SKU_COUNT = 100
EXPECTED_FRAMES_PER_SKU = 5
MIN_SAFE_INSET_X = 160
MIN_SAFE_INSET_Y = 120
MAX_CENTER_OFFSET_X = 0.025
MAX_CENTER_OFFSET_Y = 0.025
MAX_COHORT_SCALE_SPREAD = 0.075
ORIGIN_KINDS = {
    "poizon-original",
    "project-generated-original",
    "project-generated-derivative",
    "owner-provided",
    "supplier-original",
}
RIGHTS_STATUSES = {"owned", "licensed", "supplier-api"}
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
ISO_UTC_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


class MediaQaError(RuntimeError):
    """Raised when the active catalog media set is not release-ready."""


@dataclass(frozen=True)
class FrameSpec:
    role: str
    angle: str
    composition: str
    width_target: float
    height_target: float
    width_tolerance: float
    height_tolerance: float


def specs(*values: tuple[str, str, str, float, float, float, float]) -> tuple[FrameSpec, ...]:
    return tuple(FrameSpec(*value) for value in values)


# These are framing targets, not a substitute for the required human review.
# The five positions are intentionally distinct for every media profile.
FRAME_SPECS: dict[str, tuple[FrameSpec, ...]] = {
    "footwear": specs(
        ("primary", "side", "single", 0.68, 0.48, 0.14, 0.14),
        ("gallery", "three-quarter", "pair", 0.75, 0.55, 0.12, 0.14),
        ("gallery", "side", "single", 0.68, 0.48, 0.14, 0.14),
        ("gallery", "rear", "pair", 0.48, 0.65, 0.14, 0.15),
        ("gallery", "sole", "pair", 0.58, 0.58, 0.16, 0.15),
    ),
    "slide": specs(
        ("primary", "side", "single", 0.64, 0.40, 0.16, 0.14),
        ("gallery", "three-quarter", "single", 0.66, 0.46, 0.16, 0.16),
        ("gallery", "top", "single", 0.62, 0.46, 0.16, 0.16),
        ("gallery", "rear", "single", 0.42, 0.52, 0.16, 0.18),
        ("gallery", "sole", "single", 0.58, 0.48, 0.18, 0.18),
    ),
    "apparel-top": specs(
        ("primary", "front", "full-product", 0.46, 0.68, 0.14, 0.14),
        ("gallery", "rear", "full-product", 0.46, 0.68, 0.14, 0.14),
        ("gallery", "side", "full-product", 0.34, 0.68, 0.14, 0.14),
        ("gallery", "three-quarter", "full-product", 0.48, 0.68, 0.14, 0.14),
        ("gallery", "detail", "detail", 0.48, 0.42, 0.18, 0.18),
    ),
    "apparel-outerwear": specs(
        ("primary", "front", "full-product", 0.50, 0.72, 0.14, 0.12),
        ("gallery", "rear", "full-product", 0.50, 0.72, 0.14, 0.12),
        ("gallery", "side", "full-product", 0.38, 0.72, 0.14, 0.12),
        ("gallery", "three-quarter", "full-product", 0.52, 0.72, 0.14, 0.12),
        ("gallery", "detail", "detail", 0.50, 0.44, 0.18, 0.18),
    ),
    "apparel-shorts": specs(
        ("primary", "front", "full-product", 0.50, 0.46, 0.16, 0.14),
        ("gallery", "rear", "full-product", 0.50, 0.46, 0.16, 0.14),
        ("gallery", "side", "full-product", 0.36, 0.46, 0.14, 0.14),
        ("gallery", "three-quarter", "full-product", 0.52, 0.48, 0.16, 0.14),
        ("gallery", "detail", "detail", 0.46, 0.34, 0.18, 0.18),
    ),
    "apparel-pants": specs(
        ("primary", "front", "full-product", 0.44, 0.76, 0.14, 0.10),
        ("gallery", "rear", "full-product", 0.44, 0.76, 0.14, 0.10),
        ("gallery", "side", "full-product", 0.34, 0.76, 0.14, 0.10),
        ("gallery", "three-quarter", "full-product", 0.46, 0.76, 0.14, 0.10),
        ("gallery", "detail", "detail", 0.44, 0.34, 0.18, 0.18),
    ),
    "ball": specs(
        ("primary", "three-quarter", "single", 0.46, 0.61, 0.14, 0.14),
        ("gallery", "front", "single", 0.46, 0.61, 0.14, 0.14),
        ("gallery", "rear", "single", 0.46, 0.61, 0.14, 0.14),
        ("gallery", "detail", "detail", 0.50, 0.50, 0.18, 0.18),
        ("gallery", "detail", "detail", 0.50, 0.50, 0.18, 0.18),
    ),
    "bag": specs(
        ("primary", "three-quarter", "single", 0.58, 0.58, 0.16, 0.16),
        ("gallery", "front", "single", 0.52, 0.58, 0.16, 0.16),
        ("gallery", "rear", "single", 0.52, 0.58, 0.16, 0.16),
        ("gallery", "side", "single", 0.42, 0.58, 0.16, 0.16),
        ("gallery", "detail", "detail", 0.50, 0.42, 0.18, 0.18),
    ),
    "protection": specs(
        ("primary", "three-quarter", "single", 0.48, 0.54, 0.18, 0.16),
        ("gallery", "front", "single", 0.44, 0.54, 0.18, 0.16),
        ("gallery", "rear", "single", 0.44, 0.54, 0.18, 0.16),
        ("gallery", "side", "single", 0.42, 0.54, 0.18, 0.16),
        ("gallery", "detail", "detail", 0.46, 0.42, 0.18, 0.18),
    ),
    "socks": specs(
        ("primary", "side", "pair", 0.42, 0.62, 0.16, 0.14),
        ("gallery", "front", "pair", 0.42, 0.62, 0.16, 0.14),
        ("gallery", "rear", "pair", 0.42, 0.62, 0.16, 0.14),
        ("gallery", "detail", "detail", 0.42, 0.40, 0.18, 0.18),
        ("gallery", "detail", "detail", 0.42, 0.40, 0.18, 0.18),
    ),
    "bottle": specs(
        ("primary", "three-quarter", "single", 0.30, 0.66, 0.14, 0.12),
        ("gallery", "front", "single", 0.30, 0.66, 0.14, 0.12),
        ("gallery", "rear", "single", 0.30, 0.66, 0.14, 0.12),
        ("gallery", "side", "single", 0.28, 0.66, 0.14, 0.12),
        ("gallery", "detail", "detail", 0.36, 0.40, 0.18, 0.18),
    ),
    "recovery": specs(
        ("primary", "three-quarter", "single", 0.58, 0.48, 0.18, 0.16),
        ("gallery", "side", "single", 0.58, 0.48, 0.18, 0.16),
        ("gallery", "rear", "single", 0.46, 0.58, 0.18, 0.16),
        ("gallery", "top", "single", 0.56, 0.48, 0.18, 0.16),
        ("gallery", "detail", "detail", 0.48, 0.42, 0.18, 0.18),
    ),
    "headwear": specs(
        ("primary", "front", "single", 0.44, 0.46, 0.16, 0.16),
        ("gallery", "three-quarter", "single", 0.48, 0.46, 0.16, 0.16),
        ("gallery", "side", "single", 0.42, 0.46, 0.16, 0.16),
        ("gallery", "rear", "single", 0.42, 0.46, 0.16, 0.16),
        ("gallery", "detail", "detail", 0.42, 0.34, 0.18, 0.18),
    ),
    "small-accessory": specs(
        ("primary", "three-quarter", "single", 0.38, 0.44, 0.20, 0.20),
        ("gallery", "front", "single", 0.36, 0.44, 0.20, 0.20),
        ("gallery", "rear", "single", 0.36, 0.44, 0.20, 0.20),
        ("gallery", "side", "single", 0.34, 0.44, 0.20, 0.20),
        ("gallery", "detail", "detail", 0.40, 0.36, 0.20, 0.20),
    ),
}
MEDIA_PROFILES = frozenset(FRAME_SPECS)

# One profile contract drives both rendering and QA. Keeping a second copy here
# previously let frame roles and scale targets drift apart.
try:
    from scripts.build_unified_catalog_media import APPROVED_SLUGS, PROFILE_SPECS as FRAME_SPECS
except ModuleNotFoundError:  # Direct execution: python scripts/verify_*.py
    from build_unified_catalog_media import APPROVED_SLUGS, PROFILE_SPECS as FRAME_SPECS

MEDIA_PROFILES = frozenset(FRAME_SPECS)


@dataclass(frozen=True)
class ImageMetrics:
    width_ratio: float
    height_ratio: float
    scale_score: float


def safe_file(root: Path, value: Any) -> Path | None:
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        return None
    candidate = (root / value).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_provenance(frame: dict[str, Any], label: str, project_root: Path) -> list[str]:
    errors: list[str] = []
    if frame.get("origin_kind") not in ORIGIN_KINDS:
        errors.append(f"{label}: origin_kind is not an accepted provenance type")
    origin_hash_mode = frame.get("origin_hash_mode")
    if origin_hash_mode not in HASH_MODES:
        errors.append(f"{label}: origin_hash_mode must be text-lf or binary")
    origin = safe_file(project_root, frame.get("origin_reference"))
    if origin is None or not origin.is_file():
        errors.append(f"{label}: origin_reference must be an existing root-relative file")
    else:
        expected_origin_hash_mode = hash_mode_for_path(origin)
        if origin_hash_mode != expected_origin_hash_mode:
            errors.append(
                f"{label}: origin_hash_mode must be {expected_origin_hash_mode} for {origin}"
            )
        listed_origin_hash = frame.get("origin_sha256")
        actual_origin_hash = sha256_file(origin, mode=expected_origin_hash_mode)
        if not isinstance(listed_origin_hash, str) or not SHA256_PATTERN.fullmatch(listed_origin_hash):
            errors.append(f"{label}: origin_sha256 must be a lowercase SHA-256 digest")
        elif listed_origin_hash != actual_origin_hash:
            errors.append(f"{label}: origin_sha256 does not match {origin}")
    if not nonempty_string(frame.get("generator")):
        errors.append(f"{label}: generator is required")

    rights = frame.get("rights")
    if not isinstance(rights, dict):
        errors.append(f"{label}: rights metadata is required")
    else:
        if rights.get("status") not in RIGHTS_STATUSES:
            errors.append(f"{label}: rights.status is not accepted")
        if not nonempty_string(rights.get("license_reference")):
            errors.append(f"{label}: rights.license_reference is required")
        verified_at = rights.get("verified_at")
        if not isinstance(verified_at, str) or not ISO_UTC_PATTERN.fullmatch(verified_at):
            errors.append(f"{label}: rights.verified_at must be an ISO UTC timestamp")
    return errors


def foreground_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    difference = ImageChops.difference(image, Image.new("RGB", image.size, BACKGROUND))
    maximum = ImageChops.lighter(
        ImageChops.lighter(difference.getchannel("R"), difference.getchannel("G")),
        difference.getchannel("B"),
    )
    return maximum.point(lambda value: 255 if value > 6 else 0).getbbox()


def border_is_uniform(image: Image.Image) -> bool:
    width, height = image.size
    pixels = image.load()
    border = (
        *((x, 0) for x in range(width)),
        *((x, height - 1) for x in range(width)),
        *((0, y) for y in range(1, height - 1)),
        *((width - 1, y) for y in range(1, height - 1)),
    )
    return all(
        max(abs(pixels[x, y][channel] - BACKGROUND[channel]) for channel in range(3)) <= 3
        for x, y in border
    )


def validate_image(path: Path, profile: str, index: int, spec: Any) -> tuple[list[str], ImageMetrics | None]:
    try:
        with Image.open(path) as source:
            source.load()
            if source.size != CANVAS_SIZE:
                return [f"{path}: canvas must be 1600x1200, got {source.size}"], None
            errors: list[str] = []
            if source.mode != "RGB":
                errors.append(f"{path}: mode must be RGB, got {source.mode}")
            image = source.convert("RGB")
            if not border_is_uniform(image):
                errors.append(f"{path}: border must be uniform RGB{BACKGROUND}")
            bbox = foreground_bbox(image)
    except (OSError, ValueError) as error:
        return [f"{path}: Pillow could not read image ({error})"], None

    if bbox is None:
        return [*errors, f"{path}: no foreground was detected against RGB{BACKGROUND}"], None

    left, top, right, bottom = bbox
    if left < MIN_SAFE_INSET_X or CANVAS_SIZE[0] - right < MIN_SAFE_INSET_X:
        errors.append(f"{path}: safe inset X requires at least {MIN_SAFE_INSET_X}px, got bbox {bbox}")
    if top < MIN_SAFE_INSET_Y or CANVAS_SIZE[1] - bottom < MIN_SAFE_INSET_Y:
        errors.append(f"{path}: safe inset Y requires at least {MIN_SAFE_INSET_Y}px, got bbox {bbox}")

    center_offset_x = abs((left + right) / 2 - CANVAS_SIZE[0] / 2) / CANVAS_SIZE[0]
    center_offset_y = abs((top + bottom) / 2 - CANVAS_SIZE[1] / 2) / CANVAS_SIZE[1]
    if center_offset_x > MAX_CENTER_OFFSET_X:
        errors.append(f"{path}: foreground center X offset {center_offset_x:.3f} exceeds {MAX_CENTER_OFFSET_X:.3f}")
    if center_offset_y > MAX_CENTER_OFFSET_Y:
        errors.append(f"{path}: foreground center Y offset {center_offset_y:.3f} exceeds {MAX_CENTER_OFFSET_Y:.3f}")

    width_ratio = (right - left) / CANVAS_SIZE[0]
    height_ratio = (bottom - top) / CANVAS_SIZE[1]
    width = right - left
    height = bottom - top
    if spec.target_width is not None:
        scale_score = max(width / spec.target_width, height / spec.max_height)
    else:
        scale_score = max(height / spec.target_height, width / spec.max_width)
    if not spec.min_scale <= scale_score <= spec.max_scale:
        errors.append(
            f"{path}: {profile} frame {index + 1} {spec.angle}/{spec.composition} "
            f"scale score {scale_score:.3f} is outside {spec.min_scale:.3f}..{spec.max_scale:.3f}"
        )
    return errors, ImageMetrics(width_ratio, height_ratio, scale_score)


def expected_active_files(slug: str) -> tuple[str, ...]:
    if slug in APPROVED_SLUGS:
        root = f"public/storefront-media/approved/products/{slug}"
        return (
            f"{root}/01-side.png",
            f"{root}/03-side.png",
            f"{root}/02-three-quarter.png",
            f"{root}/04-rear.png",
            f"{root}/05-sole.png",
        )
    return (
        f"public/catalog/{slug}.webp",
        f"public/catalog/gallery/{slug}-2.webp",
        f"public/catalog/gallery/{slug}-3.webp",
        f"public/catalog/gallery/{slug}-4.webp",
        f"public/catalog/gallery/{slug}-5.webp",
    )


def catalog_slugs(project_root: Path) -> tuple[set[str], list[str]]:
    path = project_root / "public" / "catalog" / "sources.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return set(), [f"{path}: invalid catalog source manifest ({error})"]
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return set(), [f"{path}: items must be an array"]
    values = [item.get("slug") for item in items if isinstance(item, dict)]
    slugs = {value for value in values if nonempty_string(value)}
    errors = []
    if len(values) != EXPECTED_SKU_COUNT or len(slugs) != EXPECTED_SKU_COUNT:
        errors.append(f"{path}: exactly {EXPECTED_SKU_COUNT} unique catalog slugs are required")
    return slugs, errors


def validate_visual_review(review_path: Path, manifest_path: Path) -> list[str]:
    try:
        review = json.loads(review_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [f"{review_path}: invalid visual review record ({error})"]
    if not isinstance(review, dict):
        return [f"{review_path}: visual review root must be an object"]

    errors: list[str] = []
    if review.get("schema_version") != 1:
        errors.append(f"{review_path}: schema_version must be 1")
    if review.get("status") != "approved":
        errors.append(f"{review_path}: status must be approved")
    if review.get("reviewer_type") != "agent-assisted-manual":
        errors.append(f"{review_path}: reviewer_type must be agent-assisted-manual")
    reviewed_at = review.get("reviewed_at")
    if not isinstance(reviewed_at, str) or not ISO_UTC_PATTERN.fullmatch(reviewed_at):
        errors.append(f"{review_path}: reviewed_at must be an ISO UTC timestamp")
    if review.get("reviewed_frame_count") != EXPECTED_SKU_COUNT * EXPECTED_FRAMES_PER_SKU:
        errors.append(f"{review_path}: reviewed_frame_count must be 500")
    if review.get("manifest_sha256_mode") != TEXT_LF_HASH_MODE:
        errors.append(f"{review_path}: manifest_sha256_mode must be {TEXT_LF_HASH_MODE}")
    elif review.get("manifest_sha256") != sha256_file(manifest_path, mode=TEXT_LF_HASH_MODE):
        errors.append(f"{review_path}: manifest_sha256 does not match the active manifest")
    checks = review.get("checks")
    if not isinstance(checks, list) or not all(nonempty_string(check) for check in checks) or len(checks) < 4:
        errors.append(f"{review_path}: at least four named visual checks are required")
    return errors


def verify_manifest(manifest_path: Path, project_root: Path, review_path: Path | None = None) -> None:
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise MediaQaError(f"{manifest_path}: invalid manifest ({error})") from error

    if not isinstance(payload, dict):
        raise MediaQaError(f"{manifest_path}: manifest root must be an object")

    errors: list[str] = []
    review_path = review_path or project_root / "catalog-media" / "unified-catalog-media-review.json"
    errors.extend(validate_visual_review(review_path, manifest_path))
    expected_slugs, catalog_errors = catalog_slugs(project_root)
    errors.extend(catalog_errors)
    if payload.get("schema_version") != 1:
        errors.append(f"{manifest_path}: schema_version must be 1")
    if payload.get("expected_sku_count") != EXPECTED_SKU_COUNT:
        errors.append(f"{manifest_path}: expected_sku_count must be {EXPECTED_SKU_COUNT}")
    if payload.get("expected_frame_count") != EXPECTED_SKU_COUNT * EXPECTED_FRAMES_PER_SKU:
        errors.append(
            f"{manifest_path}: expected_frame_count must be {EXPECTED_SKU_COUNT * EXPECTED_FRAMES_PER_SKU}"
        )
    if payload.get("canvas") != list(CANVAS_SIZE):
        errors.append(f"{manifest_path}: canvas must be {list(CANVAS_SIZE)}")
    if payload.get("background_rgb") != list(BACKGROUND):
        errors.append(f"{manifest_path}: background_rgb must be {list(BACKGROUND)}")

    products = payload.get("products")
    if not isinstance(products, list):
        raise MediaQaError("Unified catalog media QA failed:\n- products must be an array")
    if len(products) != EXPECTED_SKU_COUNT:
        errors.append(f"{manifest_path}: exactly {EXPECTED_SKU_COUNT} products are required, got {len(products)}")

    seen_skus: set[str] = set()
    seen_paths: dict[str, str] = {}
    seen_hashes: dict[str, str] = {}
    cohorts: dict[tuple[str, int], list[tuple[str, ImageMetrics]]] = defaultdict(list)
    active_files = 0
    for sku_index, sku in enumerate(products):
        sku_label = f"products[{sku_index}]"
        if not isinstance(sku, dict):
            errors.append(f"{sku_label}: SKU must be an object")
            continue
        sku_id = sku.get("sku") or sku.get("slug")
        if not nonempty_string(sku_id):
            errors.append(f"{sku_label}: sku or slug is required")
            continue
        if sku_id in seen_skus:
            errors.append(f"{sku_label} ({sku_id}): duplicate SKU")
        seen_skus.add(sku_id)

        profile = sku.get("media_profile")
        if profile not in MEDIA_PROFILES:
            errors.append(f"{sku_label} ({sku_id}): media_profile must be one of {sorted(MEDIA_PROFILES)}")
            continue
        frames = sku.get("frames")
        if not isinstance(frames, list) or len(frames) != EXPECTED_FRAMES_PER_SKU:
            errors.append(f"{sku_label} ({sku_id}): exactly {EXPECTED_FRAMES_PER_SKU} frames are required")
            continue

        for frame_index, frame in enumerate(frames):
            frame_label = f"{sku_label} ({sku_id}) frame {frame_index + 1}"
            if not isinstance(frame, dict):
                errors.append(f"{frame_label}: frame must be an object")
                continue
            active_files += 1

            expected = FRAME_SPECS[profile][frame_index]
            actual = (frame.get("role"), frame.get("angle"), frame.get("composition"))
            wanted = (expected.role, expected.angle, expected.composition)
            if actual != wanted:
                errors.append(f"{frame_label}: expected role/angle/composition {wanted}, got {actual}")
            errors.extend(validate_provenance(frame, frame_label, project_root))

            raw_file = frame.get("file")
            if isinstance(raw_file, str) and raw_file:
                previous_path = seen_paths.setdefault(raw_file, frame_label)
                if previous_path != frame_label:
                    errors.append(f"{frame_label}: duplicate active file with {previous_path}")
                expected_file = expected_active_files(str(sku_id))[frame_index]
                if raw_file != expected_file:
                    errors.append(f"{frame_label}: active file must be {expected_file}, got {raw_file}")
            else:
                errors.append(f"{frame_label}: file is required")

            path = safe_file(project_root, raw_file)
            if path is None:
                errors.append(f"{frame_label}: file must stay inside project root")
                continue
            if not path.is_file():
                errors.append(f"{frame_label}: active file is missing ({path})")
                continue

            actual_hash = sha256_file(path)
            listed_hash = frame.get("sha256")
            if not isinstance(listed_hash, str) or not SHA256_PATTERN.fullmatch(listed_hash):
                errors.append(f"{frame_label}: sha256 must be a lowercase SHA-256 digest")
            elif listed_hash != actual_hash:
                errors.append(f"{frame_label}: sha256 does not match {path}")
            previous_hash = seen_hashes.setdefault(actual_hash, frame_label)
            if previous_hash != frame_label:
                errors.append(f"{frame_label}: duplicate active hash with {previous_hash}")

            image_errors, metrics = validate_image(path, profile, frame_index, expected)
            errors.extend(image_errors)
            if metrics is not None:
                cohorts[(profile, frame_index)].append((frame_label, metrics))

    if active_files != EXPECTED_SKU_COUNT * EXPECTED_FRAMES_PER_SKU:
        errors.append(
            f"manifest: exactly {EXPECTED_SKU_COUNT * EXPECTED_FRAMES_PER_SKU} active files are required, got {active_files}"
        )
    if seen_skus != expected_slugs:
        missing = sorted(expected_slugs - seen_skus)
        extra = sorted(seen_skus - expected_slugs)
        errors.append(f"manifest/catalog SKU mismatch: missing={missing}, extra={extra}")

    for (profile, frame_index), values in cohorts.items():
        if len(values) < 2:
            continue
        scales = [metrics.scale_score for _, metrics in values]
        scale_spread = max(scales) - min(scales)
        spec = FRAME_SPECS[profile][frame_index]
        tolerance = spec.cohort_tolerance or MAX_COHORT_SCALE_SPREAD
        if scale_spread > tolerance:
            errors.append(
                f"{profile} frame {frame_index + 1} {spec.angle}/{spec.composition}: "
                f"cohort scale spread {scale_spread:.3f} exceeds {tolerance:.3f}"
            )

    if errors:
        raise MediaQaError("Unified catalog media QA failed:\n- " + "\n- ".join(errors))


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the unified 100 x 5 catalog media manifest.")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("catalog-media/unified-catalog-media.json"),
    )
    parser.add_argument("--project-root", type=Path, default=Path("."))
    parser.add_argument(
        "--review",
        type=Path,
        default=Path("catalog-media/unified-catalog-media-review.json"),
    )
    args = parser.parse_args()
    try:
        verify_manifest(args.manifest, args.project_root, args.review)
    except MediaQaError as error:
        print(error)
        return 1
    print("Unified catalog media QA passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
