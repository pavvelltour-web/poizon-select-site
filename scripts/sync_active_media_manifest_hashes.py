#!/usr/bin/env python3
"""Synchronize active-media hashes and declared roles without touching pixels.

This is intentionally narrower than the media builders: it preserves the
existing source and generation provenance, updating only values derived from
the active runtime files after a reviewed card replacement.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from build_unified_catalog_media import PROFILE_SPECS, media_profile
from portable_hash import TEXT_LF_HASH_MODE, sha256_file as portable_sha256_file


ROOT = Path(__file__).resolve().parents[1]
UNIFIED = ROOT / "catalog-media" / "unified-catalog-media.json"
APPROVED = ROOT / "catalog-media" / "approved-storefront-media.json"
PUBLIC = ROOT / "public"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def sync_unified() -> int:
    payload = json.loads(UNIFIED.read_text(encoding="utf-8"))
    products = payload.get("products")
    if not isinstance(products, list):
        raise RuntimeError("Unified media manifest needs a products array")

    approved_manifest_hash = portable_sha256_file(APPROVED, mode=TEXT_LF_HASH_MODE)
    updated = 0
    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Unified media product must be an object")
        slug = product.get("slug")
        frames = product.get("frames")
        if not isinstance(slug, str) or not isinstance(frames, list) or len(frames) != 5:
            raise RuntimeError("Unified media products need a slug and five frames")
        profile = media_profile(slug)
        product["media_profile"] = profile
        for frame, spec in zip(frames, PROFILE_SPECS[profile], strict=True):
            if not isinstance(frame, dict) or not isinstance(frame.get("file"), str):
                raise RuntimeError(f"{slug}: invalid frame record")
            path = ROOT / frame["file"]
            if not path.is_file():
                raise RuntimeError(f"{slug}: active file is missing: {path}")
            frame["role"] = spec.role
            frame["angle"] = spec.angle
            frame["composition"] = spec.composition
            frame["sha256"] = sha256_file(path)
            if frame.get("origin_reference") == "catalog-media/approved-storefront-media.json":
                frame["origin_hash_mode"] = TEXT_LF_HASH_MODE
                frame["origin_sha256"] = approved_manifest_hash
            updated += 1
    write_json(UNIFIED, payload)
    return updated


def sync_approved() -> int:
    payload = json.loads(APPROVED.read_text(encoding="utf-8"))
    skus = payload.get("skus")
    if not isinstance(skus, list):
        raise RuntimeError("Approved storefront manifest needs a skus array")

    updated = 0
    for sku in skus:
        if not isinstance(sku, dict) or not isinstance(sku.get("frames"), list):
            raise RuntimeError("Approved storefront SKU needs frames")
        for frame in sku["frames"]:
            if not isinstance(frame, dict) or not isinstance(frame.get("file"), str):
                raise RuntimeError("Approved storefront frame is invalid")
            path = PUBLIC / frame["file"]
            if not path.is_file():
                raise RuntimeError(f"Approved storefront active file is missing: {path}")
            frame["sha256"] = sha256_file(path)
            updated += 1
    write_json(APPROVED, payload)
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--approved", action="store_true", help="also sync the approved storefront manifest")
    args = parser.parse_args()
    approved = sync_approved() if args.approved else 0
    frames = sync_unified()
    print(json.dumps({"unified_frames": frames, "approved_frames": approved}))


if __name__ == "__main__":
    main()
