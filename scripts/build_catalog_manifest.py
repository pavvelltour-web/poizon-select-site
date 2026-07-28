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
EXPECTED_ROOT_ASSETS = 100


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build(generated_at: str) -> dict[str, object]:
    slugs = sorted(path.stem for path in CATALOG.glob("*.webp"))
    if len(slugs) != EXPECTED_ROOT_ASSETS or len(set(slugs)) != EXPECTED_ROOT_ASSETS:
        raise RuntimeError(
            f"public/catalog must contain exactly {EXPECTED_ROOT_ASSETS} unique root WebP assets"
        )

    items: list[dict[str, object]] = []
    for slug in slugs:
        path = CATALOG / f"{slug}.webp"
        if not path.is_file():
            raise RuntimeError(f"missing catalog asset: {path.name}")
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            dimensions = list(image.size)
            if image.format != "WEBP" or dimensions != [1200, 900]:
                raise RuntimeError(f"invalid normalized WebP: {path.name}")
            if image.getexif():
                raise RuntimeError(f"metadata was not stripped: {path.name}")

        items.append(
            {
                "slug": slug,
                "file": path.name,
                "provenance": {
                    "kind": "project-generated-original",
                    "generator": (
                        "scripts/generate_catalog_art.py; project-generated product "
                        "reference cutouts normalized to metadata-free 1200x900 WebP"
                    ),
                    "official_product_photo": False,
                    "generated_at": generated_at,
                },
                "output_bytes": path.stat().st_size,
                "output_dimensions": dimensions,
                "output_sha256": sha256(path),
                "usage": (
                    "original visual reference; exact product, colour, size, "
                    "availability and price must be confirmed before order"
                ),
                "rights": {
                    "status": "owned",
                    "license_reference": (f"SELECT project-generated visual asset record: {slug}"),
                    "verified_at": generated_at,
                },
            }
        )

    return {
        "schema_version": 2,
        "generated_at": generated_at,
        "notice": (
            "All catalog visuals are project-generated originals, not official "
            "manufacturer photography and not proof of an exact product match. "
            "Brand names identify the requested search target; the manager must "
            "confirm the exact SKU, colour, size, availability and price."
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
