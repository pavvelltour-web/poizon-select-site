#!/usr/bin/env python3
"""Normalize legacy generated-reference catalog WebP files without cropping.

This intentionally operates on the complete decoded raster: it never mirrors,
never removes a subject, and only changes near-white pixels that are connected
to the source border.  That makes the studio backdrop consistent while keeping
disconnected white product surfaces intact.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "catalog"
CANVAS_SIZE = (1600, 1200)
BACKGROUND = (242, 243, 243)
OUTER_INSET = 96


def is_studio_white(pixel: tuple[int, int, int]) -> bool:
    """Only accept neutral, very bright pixels as a removable backdrop."""
    return min(pixel) >= 248 and max(pixel) - min(pixel) <= 5


def recolor_border_connected_studio_background(image: Image.Image) -> Image.Image:
    """Replace only the near-white flood-fill component reached from borders."""
    pixels = image.load()
    width, height = image.size
    visited = bytearray(width * height)
    pending: list[tuple[int, int]] = []

    for x in range(width):
        pending.extend(((x, 0), (x, height - 1)))
    for y in range(1, height - 1):
        pending.extend(((0, y), (width - 1, y)))

    while pending:
        x, y = pending.pop()
        index = y * width + x
        if visited[index] or not is_studio_white(pixels[x, y]):
            continue
        left = x
        while left and not visited[y * width + left - 1] and is_studio_white(pixels[left - 1, y]):
            left -= 1
        right = x
        while right + 1 < width and not visited[y * width + right + 1] and is_studio_white(pixels[right + 1, y]):
            right += 1
        for fill_x in range(left, right + 1):
            visited[y * width + fill_x] = 1
            pixels[fill_x, y] = BACKGROUND
        for neighbor_y in (y - 1, y + 1):
            if not 0 <= neighbor_y < height:
                continue
            for neighbor_x in range(left, right + 1):
                neighbor_index = neighbor_y * width + neighbor_x
                if not visited[neighbor_index] and is_studio_white(pixels[neighbor_x, neighbor_y]):
                    pending.append((neighbor_x, neighbor_y))
    return image


def normalize(source: Image.Image) -> Image.Image:
    """Uniformly scale the whole source raster and center it with 96px inset."""
    source = ImageOps.exif_transpose(source).convert("RGB")
    source = recolor_border_connected_studio_background(source)
    max_size = (CANVAS_SIZE[0] - 2 * OUTER_INSET, CANVAS_SIZE[1] - 2 * OUTER_INSET)
    contained = ImageOps.contain(source, max_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", CANVAS_SIZE, BACKGROUND)
    offset = ((CANVAS_SIZE[0] - contained.width) // 2, (CANVAS_SIZE[1] - contained.height) // 2)
    canvas.paste(contained, offset)
    return canvas


def all_assets() -> list[Path]:
    return sorted(CATALOG.glob("*.webp")) + sorted((CATALOG / "gallery").glob("*.webp"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    paths = all_assets()
    if len(paths) != 500:
        raise RuntimeError(f"expected exactly 500 catalog WebP files, found {len(paths)}")

    for path in paths:
        with Image.open(path) as opened:
            if opened.size == CANVAS_SIZE:
                continue
            normalized = normalize(opened)
        if not args.dry_run:
            with NamedTemporaryFile(suffix=".webp", dir=path.parent, delete=False) as temporary:
                temporary_path = Path(temporary.name)
            try:
                normalized.save(temporary_path, "WEBP", quality=95, method=6, exact=True, exif=b"", icc_profile=None)
                temporary_path.replace(path)
            finally:
                temporary_path.unlink(missing_ok=True)
    print(f"{'Validated' if args.dry_run else 'Normalized'} {len(paths)} generated-reference catalog WebP files to 1600x1200")


if __name__ == "__main__":
    main()
