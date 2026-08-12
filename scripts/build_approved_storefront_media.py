#!/usr/bin/env python3
"""Build the eight approved Open Design product sets on one media contract."""

from __future__ import annotations

import hashlib
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DESIGN_ROOT = ROOT / "public" / "storefront-media" / "approved" / "assets" / "blue-field-v2"
GENERATED_ROOT = ROOT / "catalog-media" / "generated-reference" / "approved-missing-angles"
OUTPUT_ROOT = ROOT / "public" / "storefront-media" / "approved" / "products"
MANIFEST = ROOT / "catalog-media" / "approved-storefront-media.json"
PROMPT_REFERENCE = "catalog-media/generated-reference/approved-missing-angles/PROMPTS.md"
CANVAS_SIZE = (1600, 1200)
BACKGROUND = (242, 243, 243)

PRODUCTS = (
    "anta-kai-1",
    "asics-sky-elite-ff-3",
    "li-ning-wade-808-4-ultra",
    "new-balance-two-wxy-v5",
    "nike-aone",
    "nike-free-metcon-6",
    "nike-kd-18",
    "nike-sabrina-3",
)

HOVER_NAMES = {
    "nike-aone": "nike-aone-front-pair-bg-v2.png",
}

GENERATED_SOURCES = {
    ("asics-sky-elite-ff-3", 3): "asics-sky-elite-ff-3-opposite-side-chroma.png",
    ("nike-kd-18", 3): "nike-kd-18-opposite-side-chroma.png",
    ("nike-sabrina-3", 3): "nike-sabrina-3-opposite-side-chroma.png",
    ("nike-aone", 2): "nike-aone-three-quarter-chroma.png",
    ("anta-kai-1", 4): "anta-kai-1-rear-chroma.png",
    ("asics-sky-elite-ff-3", 4): "asics-sky-elite-ff-3-rear-chroma.png",
    ("li-ning-wade-808-4-ultra", 4): "li-ning-wade-808-4-ultra-rear-chroma.png",
    ("new-balance-two-wxy-v5", 4): "new-balance-two-wxy-v5-rear-chroma.png",
    ("nike-aone", 4): "nike-aone-rear-chroma.png",
    ("nike-free-metcon-6", 4): "nike-free-metcon-6-rear-chroma.png",
    ("nike-sabrina-3", 4): "nike-sabrina-3-rear-chroma.png",
    ("anta-kai-1", 5): "anta-kai-1-sole-chroma.png",
    ("li-ning-wade-808-4-ultra", 5): "li-ning-wade-808-4-ultra-sole-chroma.png",
    ("new-balance-two-wxy-v5", 5): "new-balance-two-wxy-v5-sole-chroma.png",
    ("nike-aone", 5): "nike-aone-sole-chroma.png",
    ("nike-free-metcon-6", 5): "nike-free-metcon-6-sole-chroma.png",
    ("nike-kd-18", 5): "nike-kd-18-sole-chroma.png",
    ("nike-sabrina-3", 5): "nike-sabrina-3-sole-chroma.png",
}

ROTATE_CLOCKWISE = {
    ("nike-free-metcon-6", 5),
    ("nike-kd-18", 5),
}

STRICT_CHROMA_SOURCES = {
    "nike-sabrina-3-rear-chroma.png",
}

FRAME_SPECS = (
    {
        "role": "primary",
        "angle": "side",
        "orientation": "toe-left",
        "composition": "single",
        "target_width": 1184,
        "max_height": 780,
    },
    {
        "role": "gallery",
        "angle": "three-quarter",
        "orientation": "toe-left",
        "composition": "pair",
        "target_width": 1184,
        "max_height": 800,
    },
    {
        "role": "gallery",
        "angle": "side",
        "orientation": "toe-right",
        "composition": "single",
        "target_width": 1184,
        "max_height": 780,
    },
    {
        "role": "gallery",
        "angle": "rear",
        "orientation": "rear-facing",
        "composition": "pair",
        "target_height": 720,
        "max_width": 1088,
    },
    {
        "role": "gallery",
        "angle": "sole",
        "orientation": "not-applicable",
        "composition": "pair",
        "target_height": 840,
        "max_width": 1152,
    },
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return path.resolve().relative_to(ROOT.resolve()).as_posix()


def source_path(slug: str, frame_number: int) -> tuple[Path, str]:
    generated = GENERATED_SOURCES.get((slug, frame_number))
    if generated:
        return GENERATED_ROOT / generated, "gpt-image-2"
    if frame_number == 1:
        return DESIGN_ROOT / f"{slug}-stage.png", "open-design-export"
    if frame_number == 2:
        filename = HOVER_NAMES.get(slug, f"{slug}-front-pair-bg.png")
        return DESIGN_ROOT / "hover" / filename, "open-design-export"
    return DESIGN_ROOT / "gallery" / "normalized" / f"{slug}-{frame_number}.png", "open-design-export"


def border_key(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    samples = [
        rgb.getpixel((0, 0)),
        rgb.getpixel((width - 1, 0)),
        rgb.getpixel((0, height - 1)),
        rgb.getpixel((width - 1, height - 1)),
    ]
    return tuple(sorted(pixel[channel] for pixel in samples)[len(samples) // 2] for channel in range(3))


def connected_background_alpha(image: Image.Image, tolerance: int) -> Image.Image:
    """Remove only key-colour pixels connected to the canvas border."""

    rgb = image.convert("RGB")
    width, height = rgb.size
    key = border_key(rgb)
    pixels = rgb.load()
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

    alpha = Image.new("L", (width, height), 255)
    alpha.putdata([0 if value else 255 for value in background])
    return alpha.filter(ImageFilter.GaussianBlur(0.45))


def cutout(path: Path, generated: bool) -> Image.Image:
    render_path = path
    if generated:
        cutout_name = path.stem.removesuffix("-chroma") + "-cutout.png"
        candidate = path.parent / "cutouts" / cutout_name
        if candidate.is_file():
            render_path = candidate
    with Image.open(render_path) as source:
        source.load()
        rgba = ImageOps.exif_transpose(source).convert("RGBA")
    alpha = rgba.getchannel("A")
    if alpha.getextrema()[0] == 255:
        if generated:
            alpha = connected_background_alpha(rgba, 32)
        else:
            difference = ImageChops.difference(
                rgba.convert("RGB"),
                Image.new("RGB", rgba.size, border_key(rgba)),
            )
            alpha = ImageChops.lighter(
                ImageChops.lighter(difference.getchannel("R"), difference.getchannel("G")),
                difference.getchannel("B"),
            ).point(lambda value: 255 if value > 8 else 0)
            alpha = alpha.filter(ImageFilter.GaussianBlur(0.45))
    if generated and path.name in STRICT_CHROMA_SOURCES:
        red, green, blue, _ = rgba.split()
        green_dominance = ImageChops.subtract(green, ImageChops.lighter(red, blue))
        chroma_keep = green_dominance.point(lambda value: 0 if value > 12 else 255)
        alpha = ImageChops.darker(alpha, chroma_keep.filter(ImageFilter.GaussianBlur(0.45)))
    rgba.putalpha(alpha)
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError(f"No product foreground found in {path}")
    return rgba.crop(bbox)


def fit_subject(subject: Image.Image, spec: dict[str, object]) -> Image.Image:
    width, height = subject.size
    if "target_width" in spec:
        scale = int(spec["target_width"]) / width
        if height * scale > int(spec["max_height"]):
            scale = int(spec["max_height"]) / height
    else:
        scale = int(spec["target_height"]) / height
        if width * scale > int(spec["max_width"]):
            scale = int(spec["max_width"]) / width
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return subject.resize(size, Image.Resampling.LANCZOS)


def render(subject: Image.Image, generated: bool) -> Image.Image:
    canvas = Image.new("RGB", CANVAS_SIZE, BACKGROUND)
    x = (CANVAS_SIZE[0] - subject.width) // 2
    y = (CANVAS_SIZE[1] - subject.height) // 2
    if generated:
        shadow_layer = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
        draw = ImageDraw.Draw(shadow_layer)
        shadow_width = round(subject.width * 0.72)
        shadow_height = max(14, round(subject.height * 0.055))
        left = (CANVAS_SIZE[0] - shadow_width) // 2
        top = min(CANVAS_SIZE[1] - 100, y + subject.height - shadow_height // 2)
        draw.ellipse((left, top, left + shadow_width, top + shadow_height), fill=(20, 22, 25, 42))
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(18))
        canvas.paste(shadow_layer.convert("RGB"), mask=shadow_layer.getchannel("A"))
    canvas.paste(subject.convert("RGB"), (x, y), subject.getchannel("A"))
    return canvas


def build() -> None:
    skus: list[dict[str, object]] = []
    for slug in PRODUCTS:
        target_dir = OUTPUT_ROOT / slug
        target_dir.mkdir(parents=True, exist_ok=True)
        frames: list[dict[str, object]] = []
        for frame_number, spec in enumerate(FRAME_SPECS, start=1):
            source, generator = source_path(slug, frame_number)
            if not source.is_file():
                raise FileNotFoundError(source)
            generated = generator == "gpt-image-2"
            subject = cutout(source, generated)
            if (slug, frame_number) in ROTATE_CLOCKWISE:
                subject = subject.rotate(-90, expand=True)
            subject = fit_subject(subject, spec)
            output = target_dir / f"{frame_number:02d}-{spec['angle']}.png"
            render(subject, generated).save(output, "PNG", optimize=True)
            frames.append(
                {
                    "file": relative(output).removeprefix("public/"),
                    "role": spec["role"],
                    "angle": spec["angle"],
                    "orientation": spec["orientation"],
                    "composition": spec["composition"],
                    "source_kind": "generated-reference",
                    "sha256": sha256_file(output),
                    "generation": {
                        "model": generator,
                        "source_file": relative(source),
                        "source_sha256": sha256_file(source),
                        "prompt_reference": PROMPT_REFERENCE,
                    },
                }
            )
        skus.append(
            {
                "sku": f"catalog:{slug}",
                "slug": slug,
                "product_type": "footwear",
                "rights": {
                    "status": "owner-attested",
                    "evidence_reference": (
                        "Owner instruction dated 2026-08-01; every frame remains explicitly "
                        "labelled generated-reference until official provider evidence is imported"
                    ),
                },
                "frames": frames,
            }
        )
    payload = {
        "schema_version": 2,
        "scope": "Open Design featured footwear release",
        "expected_sku_count": len(skus),
        "canvas": list(CANVAS_SIZE),
        "background_rgb": list(BACKGROUND),
        "skus": skus,
    }
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(skus)} SKU sets / {len(skus) * 5} frames")


if __name__ == "__main__":
    build()
