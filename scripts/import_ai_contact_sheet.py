#!/usr/bin/env python3
"""Import a generated 5-view product contact sheet into the catalog gallery."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import deque
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "catalog"
GALLERY = CATALOG / "gallery"
PROVENANCE = ROOT / "generated" / "ai-product-renders"
OUTPUT_SIZE = (1600, 1200)
BACKGROUND = (242, 243, 243)
SAFE_INSET = (160, 120)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def border_connected_background_alpha(image: Image.Image, tolerance: int = 12) -> Image.Image:
    """Make only near-white background connected to a panel edge transparent."""

    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    corners = (
        pixels[0, 0],
        pixels[width - 1, 0],
        pixels[0, height - 1],
        pixels[width - 1, height - 1],
    )
    key = tuple(sorted(pixel[channel] for pixel in corners)[len(corners) // 2] for channel in range(3))
    eligible = bytearray(width * height)
    for y in range(height):
        row = y * width
        for x in range(width):
            pixel = pixels[x, y]
            if max(abs(pixel[channel] - key[channel]) for channel in range(3)) <= tolerance:
                eligible[row + x] = 1

    background = bytearray(width * height)
    queue: deque[int] = deque()
    for x in range(width):
        queue.append(x)
        queue.append((height - 1) * width + x)
    for y in range(1, height - 1):
        queue.append(y * width)
        queue.append(y * width + width - 1)
    while queue:
        index = queue.popleft()
        if background[index] or not eligible[index]:
            continue
        background[index] = 1
        x = index % width
        if x:
            queue.append(index - 1)
        if x + 1 < width:
            queue.append(index + 1)
        if index >= width:
            queue.append(index - width)
        if index + width < width * height:
            queue.append(index + width)

    alpha = Image.frombytes("L", (width, height), bytes(0 if value else 255 for value in background))
    return alpha.filter(ImageFilter.GaussianBlur(0.45))


def normalize_panel(panel: Image.Image, view_index: int) -> Image.Image:
    panel = panel.convert("RGB")
    # Trim only detected studio gutter. Fixed-percentage cropping destroyed full
    # heels and outsole edges, especially in the rear footwear panel.
    alpha = border_connected_background_alpha(panel)
    bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox is None:
        raise RuntimeError(f"contact-sheet view {view_index + 1} has no product foreground")
    left, top, right, bottom = bbox
    if left <= 1 or top <= 1 or right >= panel.width - 1 or bottom >= panel.height - 1:
        raise RuntimeError(
            f"contact-sheet view {view_index + 1} touches a panel edge; regenerate it uncropped"
        )
    panel = panel.convert("RGBA")
    panel.putalpha(alpha)
    panel = panel.crop(bbox)
    canvas = Image.new("RGB", OUTPUT_SIZE, BACKGROUND)
    contained = ImageOps.contain(
        panel,
        (OUTPUT_SIZE[0] - 2 * SAFE_INSET[0], OUTPUT_SIZE[1] - 2 * SAFE_INSET[1]),
        Image.Resampling.LANCZOS,
    )
    x = (OUTPUT_SIZE[0] - contained.width) // 2
    y = (OUTPUT_SIZE[1] - contained.height) // 2
    canvas.paste(contained.convert("RGB"), (x, y), contained.getchannel("A"))
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
