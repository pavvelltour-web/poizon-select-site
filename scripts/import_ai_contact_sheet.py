#!/usr/bin/env python3
"""Import a generated 5-view product contact sheet into the catalog gallery."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "catalog"
GALLERY = CATALOG / "gallery"
PROVENANCE = ROOT / "generated" / "ai-product-renders"
OUTPUT_SIZE = (1200, 900)
PANEL_SAFE_INSET_RATIO = 0.13


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def remove_rear_edge_artifacts(panel: Image.Image) -> Image.Image:
    mask = ImageOps.invert(panel.convert("L")).point(lambda value: 255 if value > 12 else 0)
    width, height = mask.size
    pixels = mask.load()
    visited: set[tuple[int, int]] = set()
    components: list[tuple[int, int, int, int, int, list[tuple[int, int]]]] = []

    for start_y in range(height):
        for start_x in range(width):
            if pixels[start_x, start_y] == 0 or (start_x, start_y) in visited:
                continue

            stack = [(start_x, start_y)]
            visited.add((start_x, start_y))
            coords: list[tuple[int, int]] = []
            min_x = max_x = start_x
            min_y = max_y = start_y
            while stack:
                x, y = stack.pop()
                coords.append((x, y))
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if (
                        0 <= nx < width
                        and 0 <= ny < height
                        and pixels[nx, ny] != 0
                        and (nx, ny) not in visited
                    ):
                        visited.add((nx, ny))
                        stack.append((nx, ny))
            if len(coords) >= 12:
                components.append((len(coords), min_x, min_y, max_x, max_y, coords))

    if not components:
        return panel

    largest_area = max(component[0] for component in components)
    cleaned = panel.copy()
    cleaned_pixels = cleaned.load()
    for area, min_x, _min_y, max_x, _max_y, coords in components:
        center_x = (min_x + max_x) / 2 / width
        near_edge = center_x < 0.14 or center_x > 0.73
        smaller_than_subject = area < largest_area * 0.8
        if near_edge and smaller_than_subject:
            for x, y in coords:
                cleaned_pixels[x, y] = (255, 255, 255)

    return cleaned


def normalize_panel(panel: Image.Image, view_index: int) -> Image.Image:
    panel = panel.convert("RGB")
    inset_x = int(panel.width * PANEL_SAFE_INSET_RATIO)
    inset_y = int(panel.height * PANEL_SAFE_INSET_RATIO)
    if inset_x > 0 and inset_y > 0:
        panel = panel.crop((inset_x, inset_y, panel.width - inset_x, panel.height - inset_y))
    if view_index == 3:
        panel = remove_rear_edge_artifacts(panel)
    # Trim almost-white gutters from the generated contact sheet, then re-center
    # on a pure white ecommerce canvas.
    diff = ImageOps.invert(panel.convert("L")).point(lambda value: 255 if value > 12 else 0)
    bbox = diff.getbbox()
    if bbox is not None:
        panel = panel.crop(bbox)
    canvas = Image.new("RGB", OUTPUT_SIZE, "white")
    contained = ImageOps.contain(panel, (1120, 820), Image.Resampling.LANCZOS)
    x = (OUTPUT_SIZE[0] - contained.width) // 2
    y = (OUTPUT_SIZE[1] - contained.height) // 2
    canvas.paste(contained, (x, y))
    if view_index == 3:
        canvas = remove_rear_edge_artifacts(canvas)
    return canvas


def crop_boxes(width: int, height: int) -> list[tuple[int, int, int, int]]:
    split_y = height // 2
    return [
        (0, 0, width // 2, split_y),
        (width // 2, 0, width, split_y),
        (0, split_y, width // 3, height),
        (width // 3, split_y, (width * 2) // 3, height),
        ((width * 2) // 3, split_y, width, height),
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--sheet", required=True)
    parser.add_argument("--prompt-file", required=True)
    parser.add_argument("--product-index", type=int, default=0)
    parser.add_argument("--generator", default="image generation system tool; requested GPT Image 2.0+")
    args = parser.parse_args()

    sheet_path = Path(args.sheet)
    prompt_path = Path(args.prompt_file)
    prompt_payload = json.loads(prompt_path.read_text(encoding="utf-8"))
    product_prompts = (
        prompt_payload["products"]
        if isinstance(prompt_payload, dict) and "products" in prompt_payload
        else prompt_payload
    )
    if not isinstance(product_prompts, list):
        raise RuntimeError("prompt file must contain a product list or a products array")
    product = product_prompts[args.product_index]
    if product["slug"] != args.slug:
        raise RuntimeError(
            f"prompt product mismatch: expected {args.slug}, got {product['slug']}"
        )

    GALLERY.mkdir(parents=True, exist_ok=True)
    PROVENANCE.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(UTC).replace(microsecond=0).isoformat()

    with Image.open(sheet_path) as source:
        source = source.convert("RGB")
        boxes = crop_boxes(*source.size)
        outputs: list[dict[str, object]] = []
        for index, box in enumerate(boxes):
            frame = normalize_panel(source.crop(box), index)
            target = (
                CATALOG / f"{args.slug}.webp"
                if index == 0
                else GALLERY / f"{args.slug}-{index + 1}.webp"
            )
            frame.save(target, "WEBP", quality=92, method=6, exact=True, exif=b"", icc_profile=None)
            outputs.append(
                {
                    "angle": product["angle_set"][index],
                    "prompt": product["prompts"][index],
                    "file": str(target.relative_to(CATALOG).as_posix()),
                    "sha256": sha256(target),
                    "bytes": target.stat().st_size,
                }
            )

    record = {
        "slug": args.slug,
        "brand": product["brand"],
        "name": product["name"],
        "source_sheet": str(sheet_path),
        "generator": args.generator,
        "seed": None,
        "seed_note": "The available image generation tool did not expose a numeric seed.",
        "generated_at": generated_at,
        "outputs": outputs,
    }
    (PROVENANCE / f"{args.slug}.json").write_text(
        json.dumps(record, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Imported {len(outputs)} studio product views for {args.slug}")


if __name__ == "__main__":
    main()
