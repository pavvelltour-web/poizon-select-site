#!/usr/bin/env python3
"""Remove contact-sheet edge artifacts from normalized catalog renders."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "catalog"
GALLERY = CATALOG / "gallery"
OUTPUT_SIZE = (1200, 900)
SAFE_INSET = 42
TARGET_BOX = (1120, 820)


def clean(path: Path) -> None:
    with Image.open(path) as source:
        image = source.convert("RGB")

    image = image.crop(
        (
            SAFE_INSET,
            SAFE_INSET,
            image.width - SAFE_INSET,
            image.height - SAFE_INSET,
        ),
    )
    diff = ImageOps.invert(image.convert("L")).point(
        lambda value: 255 if value > 10 else 0,
    )
    bbox = diff.getbbox()
    if bbox is not None:
        image = image.crop(bbox)

    canvas = Image.new("RGB", OUTPUT_SIZE, "white")
    contained = ImageOps.contain(image, TARGET_BOX, Image.Resampling.LANCZOS)
    x = (OUTPUT_SIZE[0] - contained.width) // 2
    y = (OUTPUT_SIZE[1] - contained.height) // 2
    canvas.paste(contained, (x, y))
    canvas.save(path, "WEBP", quality=92, method=6, exact=True, exif=b"", icc_profile=None)


def main() -> None:
    paths = sorted(CATALOG.glob("*.webp")) + sorted(GALLERY.glob("*.webp"))
    for path in paths:
        clean(path)
    print(f"Cleaned {len(paths)} catalog images")


if __name__ == "__main__":
    main()
