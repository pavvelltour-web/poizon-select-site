#!/usr/bin/env python3
"""Validate, stage and audit product media without mutating the storefront.

The official-source workflow is deliberately offline. A supplier export must be
downloaded out of band, accompanied by rights evidence, and reviewed by a human
before this script will accept it. Staging never writes to ``public/catalog``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import tempfile
import warnings
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from PIL import Image, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_CATALOG = ROOT / "public" / "catalog"
DEFAULT_STAGING = ROOT / "catalog-media" / "staging"
CANVAS_SIZE = (1600, 1200)
CANVAS_BACKGROUND = (242, 243, 243)
SAFE_INSET_RATIO = 0.08
MAX_SOURCE_PIXELS = 40_000_000
ACCEPTED_RIGHTS = {"licensed", "owned", "supplier-api"}
ACCEPTED_KINDS = {"footwear", "apparel", "accessory"}
ACCEPTED_ROLES = {"primary", "gallery"}
ACCEPTED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ACCEPTED_ANGLES = {"side", "front", "rear", "three-quarter", "top", "sole", "detail"}
ACCEPTED_ORIENTATIONS = {
    "toe-right",
    "toe-left",
    "front-facing",
    "rear-facing",
    "not-applicable",
}
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class PipelineError(RuntimeError):
    """Raised when media must be rejected instead of guessed or published."""


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_iso_datetime(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise PipelineError(f"{field} must be an ISO-8601 timestamp")
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise PipelineError(f"{field} must be an ISO-8601 timestamp") from error
    if parsed.tzinfo is None:
        raise PipelineError(f"{field} must include a timezone")
    return value


def validate_https_url(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise PipelineError(f"{field} must be an HTTPS URL")
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
    ):
        raise PipelineError(f"{field} must be a credential-free HTTPS URL without a fragment")
    return value


def safe_local_path(source_root: Path, value: Any, field: str) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise PipelineError(f"{field} must be a relative local file path")
    relative = Path(value)
    if relative.is_absolute():
        raise PipelineError(f"{field} must be relative to --source-root")
    root = source_root.resolve()
    resolved = (root / relative).resolve()
    try:
        resolved.relative_to(root)
    except ValueError as error:
        raise PipelineError(f"{field} escapes --source-root") from error
    return resolved


def require_text(value: Any, field: str, minimum: int = 1) -> str:
    if not isinstance(value, str) or len(value.strip()) < minimum:
        raise PipelineError(f"{field} must contain at least {minimum} character(s)")
    return value.strip()


def reject_unknown_keys(value: dict[str, Any], allowed: set[str], field: str) -> None:
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise PipelineError(f"{field} contains unsupported field(s): {', '.join(unknown)}")


def expected_orientation(kind: str, role: str) -> tuple[str | None, str | None]:
    if role != "primary":
        return None, None
    if kind == "footwear":
        return "side", "toe-left"
    if kind == "apparel":
        return "front", "front-facing"
    return None, None


def validate_item(item: Any, index: int, source_root: Path) -> dict[str, Any]:
    prefix = f"items[{index}]"
    if not isinstance(item, dict):
        raise PipelineError(f"{prefix} must be an object")
    reject_unknown_keys(
        item,
        {"slug", "product_type", "identifiers", "source", "rights", "media", "qa"},
        prefix,
    )

    slug = require_text(item.get("slug"), f"{prefix}.slug")
    if not SLUG_PATTERN.fullmatch(slug):
        raise PipelineError(f"{prefix}.slug is not a lowercase catalog slug")
    kind = item.get("product_type")
    if kind not in ACCEPTED_KINDS:
        raise PipelineError(f"{prefix}.product_type must be one of {sorted(ACCEPTED_KINDS)}")

    identifiers = item.get("identifiers")
    if not isinstance(identifiers, dict):
        raise PipelineError(f"{prefix}.identifiers must be an object")
    reject_unknown_keys(identifiers, {"spu", "sku"}, f"{prefix}.identifiers")
    spu = identifiers.get("spu")
    sku = identifiers.get("sku")
    for field, value in (("spu", spu), ("sku", sku)):
        if value is not None and not isinstance(value, str):
            raise PipelineError(f"{prefix}.identifiers.{field} must be a string or null")
    if not any(isinstance(value, str) and value.strip() for value in (spu, sku)):
        raise PipelineError(f"{prefix}.identifiers must contain an SPU or SKU")

    source = item.get("source")
    if not isinstance(source, dict):
        raise PipelineError(f"{prefix}.source must be an object")
    reject_unknown_keys(
        source,
        {"provider", "asset_url", "product_url", "observed_at", "local_file", "sha256"},
        f"{prefix}.source",
    )
    require_text(source.get("provider"), f"{prefix}.source.provider", 3)
    validate_https_url(source.get("asset_url"), f"{prefix}.source.asset_url")
    validate_https_url(source.get("product_url"), f"{prefix}.source.product_url")
    parse_iso_datetime(source.get("observed_at"), f"{prefix}.source.observed_at")
    local_path = safe_local_path(source_root, source.get("local_file"), f"{prefix}.source.local_file")
    source_hash = source.get("sha256")
    if not isinstance(source_hash, str) or not SHA256_PATTERN.fullmatch(source_hash):
        raise PipelineError(f"{prefix}.source.sha256 must be a lowercase SHA-256 digest")

    rights = item.get("rights")
    if not isinstance(rights, dict) or rights.get("status") not in ACCEPTED_RIGHTS:
        raise PipelineError(f"{prefix}.rights.status must be one of {sorted(ACCEPTED_RIGHTS)}")
    reject_unknown_keys(
        rights,
        {"status", "evidence_reference", "verified_by", "verified_at", "permitted_uses"},
        f"{prefix}.rights",
    )
    require_text(rights.get("evidence_reference"), f"{prefix}.rights.evidence_reference", 8)
    require_text(rights.get("verified_by"), f"{prefix}.rights.verified_by", 2)
    parse_iso_datetime(rights.get("verified_at"), f"{prefix}.rights.verified_at")
    permitted = rights.get("permitted_uses")
    if not isinstance(permitted, list) or "storefront" not in permitted:
        raise PipelineError(f"{prefix}.rights.permitted_uses must include storefront")
    if not all(isinstance(value, str) for value in permitted):
        raise PipelineError(f"{prefix}.rights.permitted_uses must contain only strings")

    media = item.get("media")
    if not isinstance(media, dict):
        raise PipelineError(f"{prefix}.media must be an object")
    reject_unknown_keys(media, {"role", "angle", "orientation", "mime_type"}, f"{prefix}.media")
    role = media.get("role")
    if role not in ACCEPTED_ROLES:
        raise PipelineError(f"{prefix}.media.role must be primary or gallery")
    angle = require_text(media.get("angle"), f"{prefix}.media.angle")
    orientation = require_text(media.get("orientation"), f"{prefix}.media.orientation")
    if angle not in ACCEPTED_ANGLES:
        raise PipelineError(f"{prefix}.media.angle is not an accepted commerce view")
    if orientation not in ACCEPTED_ORIENTATIONS:
        raise PipelineError(f"{prefix}.media.orientation is not accepted")
    if media.get("mime_type") not in ACCEPTED_MIME_TYPES:
        raise PipelineError(f"{prefix}.media.mime_type must be JPEG, PNG or WebP")
    target_angle, target_orientation = expected_orientation(kind, role)
    if target_angle and angle != target_angle:
        raise PipelineError(f"{prefix} primary {kind} angle must be {target_angle}")
    if target_orientation and orientation != target_orientation:
        raise PipelineError(
            f"{prefix} primary {kind} orientation must be {target_orientation}; do not mirror it"
        )

    qa = item.get("qa")
    if not isinstance(qa, dict) or qa.get("status") != "approved":
        raise PipelineError(f"{prefix}.qa.status must be approved before staging")
    reject_unknown_keys(
        qa,
        {
            "status",
            "product_match_verified",
            "source_not_cropped",
            "logos_and_text_readable",
            "orientation_verified",
            "subject_scale_verified",
            "reviewer",
            "reviewed_at",
            "notes",
        },
        f"{prefix}.qa",
    )
    for field in (
        "product_match_verified",
        "source_not_cropped",
        "logos_and_text_readable",
        "orientation_verified",
        "subject_scale_verified",
    ):
        if qa.get(field) is not True:
            raise PipelineError(f"{prefix}.qa.{field} must be true")
    require_text(qa.get("reviewer"), f"{prefix}.qa.reviewer", 2)
    parse_iso_datetime(qa.get("reviewed_at"), f"{prefix}.qa.reviewed_at")
    if "notes" not in qa or not isinstance(qa["notes"], str):
        raise PipelineError(f"{prefix}.qa.notes must be a string")

    normalized = dict(item)
    normalized["_local_path"] = local_path
    return normalized


def load_and_validate_manifest(manifest_path: Path, source_root: Path) -> list[dict[str, Any]]:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        raise PipelineError("manifest schema_version must be 1")
    reject_unknown_keys(payload, {"schema_version", "items"}, "manifest")
    items = payload.get("items")
    if not isinstance(items, list) or not items:
        raise PipelineError("manifest items must be a non-empty array")
    validated = [validate_item(item, index, source_root) for index, item in enumerate(items)]

    keys: set[tuple[str, str, str]] = set()
    hashes: dict[str, list[str]] = defaultdict(list)
    for item in validated:
        key = (item["slug"], item["media"]["role"], item["media"]["angle"])
        if key in keys:
            raise PipelineError(f"duplicate media slot: {' / '.join(key)}")
        keys.add(key)
        hashes[item["source"]["sha256"]].append(" / ".join(key))
    duplicates = {digest: slots for digest, slots in hashes.items() if len(slots) > 1}
    if duplicates:
        detail = "; ".join(f"{digest[:12]}: {', '.join(slots)}" for digest, slots in duplicates.items())
        raise PipelineError(f"exact source duplicate(s) rejected: {detail}")
    return validated


def open_verified_source(item: dict[str, Any]) -> Image.Image:
    path: Path = item["_local_path"]
    if not path.is_file():
        raise PipelineError(f"source file does not exist: {path}")
    actual_hash = sha256_file(path)
    expected_hash = item["source"]["sha256"]
    if actual_hash != expected_hash:
        raise PipelineError(f"source SHA-256 mismatch for {item['slug']}: {actual_hash}")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as probe:
                width, height = probe.size
                if width <= 0 or height <= 0 or width * height > MAX_SOURCE_PIXELS:
                    raise PipelineError(f"invalid source dimensions for {item['slug']}: {width}x{height}")
                probe.verify()
            with Image.open(path) as source:
                actual_mime = Image.MIME.get(source.format or "")
                if actual_mime != item["media"]["mime_type"]:
                    raise PipelineError(
                        f"source MIME mismatch for {item['slug']}: expected "
                        f"{item['media']['mime_type']}, got {actual_mime or 'unknown'}"
                    )
                exif_orientation = source.getexif().get(274, 1)
                if exif_orientation in {2, 4, 5, 7}:
                    raise PipelineError(
                        f"mirrored EXIF orientation is not accepted for {item['slug']}"
                    )
                source.load()
                return ImageOps.exif_transpose(source).convert("RGBA")
    except PipelineError:
        raise
    except (OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise PipelineError(f"Pillow rejected source for {item['slug']}: {error}") from error


def normalize_without_crop_or_mirror(source: Image.Image) -> Image.Image:
    """Place the complete source on a standard canvas; never crop or transpose.

    EXIF orientation is applied while decoding so the file displays as authored.
    The pixel matrix is then scaled uniformly and padded. Horizontal flipping is
    intentionally not available because it would corrupt logos and printed text.
    """

    canvas = Image.new("RGB", CANVAS_SIZE, CANVAS_BACKGROUND)
    max_width = round(CANVAS_SIZE[0] * (1 - 2 * SAFE_INSET_RATIO))
    max_height = round(CANVAS_SIZE[1] * (1 - 2 * SAFE_INSET_RATIO))
    contained = ImageOps.contain(source, (max_width, max_height), Image.Resampling.LANCZOS)
    if contained.width > source.width or contained.height > source.height:
        # Official exports should remain sharp: never enlarge source pixels.
        contained = source.copy()
    if contained.width > max_width or contained.height > max_height:
        contained = ImageOps.contain(contained, (max_width, max_height), Image.Resampling.LANCZOS)
    if contained.mode == "RGBA":
        flattened = Image.new("RGB", contained.size, CANVAS_BACKGROUND)
        flattened.paste(contained, mask=contained.getchannel("A"))
        contained = flattened
    else:
        contained = contained.convert("RGB")
    x = (CANVAS_SIZE[0] - contained.width) // 2
    y = (CANVAS_SIZE[1] - contained.height) // 2
    canvas.paste(contained, (x, y))
    return canvas


def current_catalog_hashes() -> dict[str, list[str]]:
    result: dict[str, list[str]] = defaultdict(list)
    catalog_root = PUBLIC_CATALOG.parent.parent
    paths = sorted(PUBLIC_CATALOG.glob("*.webp")) + sorted((PUBLIC_CATALOG / "gallery").glob("*.webp"))
    for path in paths:
        result[sha256_file(path)].append(path.relative_to(catalog_root).as_posix())
    return result


def stage(manifest_path: Path, source_root: Path, output_root: Path) -> dict[str, Any]:
    items = load_and_validate_manifest(manifest_path, source_root)
    catalog_hashes = current_catalog_hashes()
    for item in items:
        existing = catalog_hashes.get(item["source"]["sha256"])
        if existing:
            raise PipelineError(
                f"{item['slug']} source is already present in catalog: {', '.join(existing)}"
            )

    output_root = output_root.resolve()
    public_root = (ROOT / "public").resolve()
    if output_root == public_root or output_root.is_relative_to(public_root):
        raise PipelineError("staging output must not be inside public/")
    output_root.mkdir(parents=True, exist_ok=True)
    transaction = Path(tempfile.mkdtemp(prefix="official-media-", dir=output_root))
    staged_records: list[dict[str, Any]] = []
    derived_hashes: dict[str, list[str]] = defaultdict(list)
    try:
        for item in items:
            source = open_verified_source(item)
            normalized = normalize_without_crop_or_mirror(source)
            role = item["media"]["role"]
            angle = item["media"]["angle"]
            target_dir = transaction / item["slug"]
            target_dir.mkdir(parents=True, exist_ok=True)
            target = target_dir / f"{role}-{angle}.webp"
            normalized.save(target, "WEBP", quality=95, method=6, exact=True, exif=b"", icc_profile=None)
            digest = sha256_file(target)
            slot = f"{item['slug']} / {role} / {angle}"
            existing_output = catalog_hashes.get(digest)
            if existing_output:
                raise PipelineError(
                    f"{slot} normalizes to an existing catalog asset: {', '.join(existing_output)}"
                )
            derived_hashes[digest].append(slot)
            staged_records.append(
                {
                    "slug": item["slug"],
                    "product_type": item["product_type"],
                    "identifiers": item["identifiers"],
                    "source": {key: value for key, value in item["source"].items()},
                    "rights": item["rights"],
                    "media": item["media"],
                    "qa": item["qa"],
                    "staged_file": target.relative_to(transaction).as_posix(),
                    "output_sha256": digest,
                    "output_dimensions": list(CANVAS_SIZE),
                    "transform": (
                        "uniform-scale-and-pad-only; no crop; no mirror; "
                        "cold-gray RGB(242,243,243) canvas"
                    ),
                }
            )
        duplicates = {digest: slots for digest, slots in derived_hashes.items() if len(slots) > 1}
        if duplicates:
            detail = "; ".join(f"{digest[:12]}: {', '.join(slots)}" for digest, slots in duplicates.items())
            raise PipelineError(f"exact normalized duplicate(s) rejected: {detail}")

        staged_manifest = {
            "schema_version": 1,
            "source_manifest": str(manifest_path.resolve()),
            "publication_status": "staged-not-published",
            "items": staged_records,
        }
        (transaction / "staged-manifest.json").write_text(
            json.dumps(staged_manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        final = output_root / f"batch-{sha256_file(manifest_path)[:12]}"
        if final.exists():
            raise PipelineError(f"staging batch already exists: {final}")
        transaction.replace(final)
        return {"batch": str(final), "items": len(staged_records)}
    except Exception:
        if transaction.exists():
            shutil.rmtree(transaction)
        raise


def content_bbox(
    image: Image.Image,
    background: tuple[int, int, int] = (255, 255, 255),
) -> tuple[int, int, int, int] | None:
    rgb = image.convert("RGB")
    backdrop = Image.new("RGB", rgb.size, background)
    difference = ImageChops.difference(rgb, backdrop).convert("L")
    mask = difference.point(lambda value: 255 if value > 16 else 0)
    return mask.getbbox()


def audit_current_catalog() -> dict[str, Any]:
    catalog_root = PUBLIC_CATALOG.parent.parent
    paths = sorted(PUBLIC_CATALOG.glob("*.webp")) + sorted((PUBLIC_CATALOG / "gallery").glob("*.webp"))
    hashes: dict[str, list[str]] = defaultdict(list)
    records: list[dict[str, Any]] = []
    safe_area_warnings: list[str] = []
    for path in paths:
        relative = path.relative_to(catalog_root).as_posix()
        digest = sha256_file(path)
        hashes[digest].append(relative)
        with Image.open(path) as image:
            image.load()
            width, height = image.size
            bbox = content_bbox(image)
            inset = None
            if bbox:
                left, top, right, bottom = bbox
                inset = {
                    "left": round(left / width, 4),
                    "top": round(top / height, 4),
                    "right": round((width - right) / width, 4),
                    "bottom": round((height - bottom) / height, 4),
                }
                if min(inset.values()) < SAFE_INSET_RATIO:
                    safe_area_warnings.append(relative)
            records.append(
                {
                    "file": relative,
                    "sha256": digest,
                    "bytes": path.stat().st_size,
                    "dimensions": [width, height],
                    "mode": image.mode,
                    "content_inset_ratio": inset,
                }
            )
    duplicate_groups = [files for files in hashes.values() if len(files) > 1]
    primary_gallery_duplicates = [
        files
        for files in duplicate_groups
        if any("/gallery/" not in file for file in files)
        and any("/gallery/" in file for file in files)
    ]
    sources_path = PUBLIC_CATALOG / "sources.json"
    source_manifest = json.loads(sources_path.read_text(encoding="utf-8"))
    source_items = source_manifest.get("items", [])
    official_count = sum(
        item.get("provenance", {}).get("official_product_photo") is True
        for item in source_items
    )
    return {
        "schema_version": 1,
        "scope": "current committed public/catalog WebP assets",
        "policy": {
            "signal_studio_safe_inset_ratio": SAFE_INSET_RATIO,
            "footwear_primary": "clean side view, toe left",
            "apparel_primary": "front view, consistent scale",
            "automated_orientation_detection": False,
            "automated_source_crop_detection": False,
        },
        "summary": {
            "file_count": len(records),
            "root_primary_count": len(list(PUBLIC_CATALOG.glob("*.webp"))),
            "gallery_count": len(list((PUBLIC_CATALOG / "gallery").glob("*.webp"))),
            "exact_duplicate_group_count": len(duplicate_groups),
            "primary_gallery_duplicate_group_count": len(primary_gallery_duplicates),
            "safe_area_warning_count": len(safe_area_warnings),
            "provenance_record_count": len(source_items),
            "confirmed_official_source_count": official_count,
        },
        "limitations": [
            "A hash and pixel audit cannot infer which direction a shoe toe points.",
            "A padded derivative can hide a crop already present in its source; human source review is required.",
            "No current file is promoted or replaced by this audit.",
        ],
        "exact_duplicate_groups": duplicate_groups,
        "primary_gallery_duplicate_groups": primary_gallery_duplicates,
        "safe_area_warnings": safe_area_warnings,
        "files": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate", help="validate metadata and local source paths")
    validate_parser.add_argument("--manifest", required=True, type=Path)
    validate_parser.add_argument("--source-root", required=True, type=Path)

    stage_parser = subparsers.add_parser("stage", help="create a non-public normalized staging batch")
    stage_parser.add_argument("--manifest", required=True, type=Path)
    stage_parser.add_argument("--source-root", required=True, type=Path)
    stage_parser.add_argument("--output-root", type=Path, default=DEFAULT_STAGING)

    audit_parser = subparsers.add_parser("audit-current", help="audit current assets without changing them")
    audit_parser.add_argument("--output", type=Path)

    args = parser.parse_args()
    try:
        if args.command == "validate":
            items = load_and_validate_manifest(args.manifest, args.source_root)
            for item in items:
                open_verified_source(item)
            result: dict[str, Any] = {"status": "valid", "items": len(items)}
        elif args.command == "stage":
            result = stage(args.manifest, args.source_root, args.output_root)
        else:
            result = audit_current_catalog()
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, json.JSONDecodeError, PipelineError) as error:
        raise SystemExit(f"Official media pipeline blocked: {error}") from error


if __name__ == "__main__":
    main()
