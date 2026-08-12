#!/usr/bin/env python3
"""Build the local catalog provenance manifest from committed generated art."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "catalog"
UNIFIED_MEDIA_MANIFEST = ROOT / "catalog-media" / "unified-catalog-media.json"
EXPECTED_ROOT_ASSETS = 100


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def unified_primary_frames() -> dict[str, dict[str, object]]:
    if not UNIFIED_MEDIA_MANIFEST.is_file():
        return {}
    payload = json.loads(UNIFIED_MEDIA_MANIFEST.read_text(encoding="utf-8"))
    if payload.get("schema_version") != 1 or not isinstance(payload.get("products"), list):
        raise RuntimeError("unified catalog media manifest has an unsupported schema")
    primary: dict[str, dict[str, object]] = {}
    for product in payload["products"]:
        if not isinstance(product, dict) or not isinstance(product.get("slug"), str):
            raise RuntimeError("unified catalog media manifest contains an invalid product")
        frames = product.get("frames")
        if not isinstance(frames, list):
            raise RuntimeError(f"unified catalog media manifest has no frames for {product['slug']}")
        frame = next((item for item in frames if isinstance(item, dict) and item.get("position") == 1), None)
        if frame is None:
            raise RuntimeError(f"unified catalog media manifest has no primary frame for {product['slug']}")
        primary[product["slug"]] = frame
    return primary


def existing_catalog_items() -> dict[str, dict[str, object]]:
    path = CATALOG / "sources.json"
    if not path.is_file():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        raise RuntimeError("existing catalog source manifest has an unsupported schema")
    return {
        item["slug"]: item
        for item in items
        if isinstance(item, dict) and isinstance(item.get("slug"), str)
    }


def source_record(
    source: dict[str, object] | None,
    slug: str,
    generated_at: str,
) -> tuple[dict[str, object], dict[str, object], str]:
    provenance = {
        "kind": "project-generated-original",
        "generator": (
            "scripts/generate_catalog_art.py; project-generated product "
            "reference rasters normalized without crop or mirror to metadata-free 1600x1200 WebP"
        ),
        "official_product_photo": False,
        "generated_at": generated_at,
    }
    rights = {
        "status": "owned",
        "license_reference": f"SELECT project-generated visual asset record: {slug}",
        "verified_at": generated_at,
    }
    usage = (
        "original visual reference; exact product, colour, size, "
        "availability and price must pass server-side catalog validation before order"
    )
    if not isinstance(source, dict) or source.get("origin_kind") not in {"poizon-original", "supplier-original"}:
        return provenance, rights, usage

    source_rights = source.get("rights")
    if not isinstance(source_rights, dict):
        raise RuntimeError(f"Primary source frame lacks rights metadata: {slug}")
    origin_kind = source["origin_kind"]
    is_poizon = origin_kind == "poizon-original"
    provenance = {
        "kind": origin_kind,
        "generator": source.get("generator"),
        "official_product_photo": True,
        "source_provider": source.get("source_provider"),
        "source_url": source.get("source_url"),
        "product_url": source.get("product_url"),
        "source_spu": source.get("source_spu"),
        "source_sku": source.get("source_sku"),
        "origin_reference": source.get("origin_reference"),
        "origin_sha256": source.get("origin_sha256"),
        "normalized_from": (
            "Poizon public product-page original; KICKSBASE profile-aware normalizer"
            if is_poizon
            else "Official supplier product image; KICKSBASE profile-aware normalizer"
        ),
    }
    usage = (
        "Poizon product-page visual reference; exact product, colour, size, "
        "availability and price must pass server-side catalog validation before order"
        if is_poizon
        else "Official product-image visual reference; exact product, colour, size, "
        "availability and price must pass server-side catalog validation before order"
    )
    return provenance, source_rights, usage


def build(generated_at: str) -> dict[str, object]:
    slugs = sorted(path.stem for path in CATALOG.glob("*.webp"))
    if len(slugs) != EXPECTED_ROOT_ASSETS or len(set(slugs)) != EXPECTED_ROOT_ASSETS:
        raise RuntimeError(
            f"public/catalog must contain exactly {EXPECTED_ROOT_ASSETS} unique root WebP assets"
        )

    primary_frames = unified_primary_frames()
    prior_items = existing_catalog_items()
    items: list[dict[str, object]] = []
    for slug in slugs:
        path = CATALOG / f"{slug}.webp"
        if not path.is_file():
            raise RuntimeError(f"missing catalog asset: {path.name}")
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            dimensions = list(image.size)
            if image.format != "WEBP" or dimensions != [1600, 1200]:
                raise RuntimeError(f"invalid normalized WebP: {path.name}")
            if image.getexif():
                raise RuntimeError(f"metadata was not stripped: {path.name}")

        provenance, rights, usage = source_record(primary_frames.get(slug), slug, generated_at)
        prior_provenance = prior_items.get(slug, {}).get("provenance")
        if isinstance(prior_provenance, dict):
            provenance.update(
                {
                    key: value
                    for key, value in prior_provenance.items()
                    if key.startswith("gallery_frame_")
                }
            )

        items.append(
            {
                "slug": slug,
                "file": path.name,
                "provenance": provenance,
                "output_bytes": path.stat().st_size,
                "output_dimensions": dimensions,
                "output_sha256": sha256(path),
                "usage": usage,
                "rights": rights,
            }
        )

    return {
        "schema_version": 2,
        "generated_at": generated_at,
        "notice": (
            "Catalog visuals may be project-generated originals, reviewed Poizon "
            "product-page originals or official supplier product images. They are not proof of an exact product match. "
            "Brand names identify the requested search target; ordering is enabled "
            "only for a server-published SKU, size, availability and price."
        ),
        "items": items,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--generated-at",
        default=datetime.now(UTC).replace(microsecond=0).isoformat(),
        help="ISO-8601 UTC timestamp used by all generated records",
    )
    args = parser.parse_args()
    payload = build(args.generated_at)
    (CATALOG / "sources.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote provenance for {EXPECTED_ROOT_ASSETS} generated catalog assets")


if __name__ == "__main__":
    main()
