#!/usr/bin/env python3
"""Build static-release catalog frames without changing product geometry."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "public" / "catalog"
RELEASE_ROOT = ROOT / "site-release" / "assets" / "blue-field-v2"
CANVAS_SIZE = (1600, 1200)
FOOTWEAR_SAFE_BOX = (1200, 840)
APPAREL_SAFE_BOX = (900, 940)
KNEEPAD_SAFE_BOX = (960, 880)
BALL_SAFE_BOX = (840, 840)
BAND_SET_SAFE_BOX = (1120, 720)
HYPERICE_SAFE_BOX = (1120, 720)
ROCKTAPE_SAFE_BOX = (900, 780)
MUELLER_SAFE_BOX = (1120, 620)
BAUERFEIND_SAFE_BOX = (820, 940)
BACKGROUND = (242, 243, 243)
OFFICIAL_SOURCE_ROOT = ROOT / "catalog-media" / "official-sources"


JOBS = (
    (
        "asics-upcourt-6",
        SOURCE_ROOT / "gallery" / "asics-upcourt-6-2.webp",
        RELEASE_ROOT / "hover" / "asics-upcourt-6-front-pair-bg.png",
    ),
    (
        "mizuno-wave-momentum-3",
        SOURCE_ROOT / "gallery" / "mizuno-wave-momentum-3-2.webp",
        RELEASE_ROOT / "hover" / "mizuno-wave-momentum-3-front-pair-bg.png",
    ),
    (
        "mizuno-cyclone-speed-5",
        SOURCE_ROOT / "gallery" / "mizuno-cyclone-speed-5-2.webp",
        RELEASE_ROOT / "hover" / "mizuno-cyclone-speed-5-front-pair-bg.png",
    ),
    (
        "adidas-stabil-16-indoor",
        SOURCE_ROOT / "gallery" / "adidas-stabil-16-indoor-2.webp",
        RELEASE_ROOT / "hover" / "adidas-stabil-16-indoor-front-pair-bg.png",
    ),
    (
        "puma-fuse-3",
        SOURCE_ROOT / "puma-fuse-3.webp",
        RELEASE_ROOT / "puma-fuse-3-stage.png",
    ),
    (
        "puma-fuse-3",
        SOURCE_ROOT / "gallery" / "puma-fuse-3-3.webp",
        RELEASE_ROOT / "gallery" / "normalized" / "puma-fuse-3-3.png",
    ),
)


BATCH_FOUR_JOBS = tuple(
    (slug, source, target)
    for slug in (
        "asics-netburner-ballistic-ff-4",
        "mizuno-wave-lightning-z8",
        "mizuno-wave-lightning-z8-mid",
        "mizuno-wave-momentum-elite-mid",
        "mizuno-wave-momentum-pro",
        "mizuno-wave-luminous-3",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_FIVE_JOBS = tuple(
    (slug, source, target)
    for slug in (
        "mizuno-wave-voltage-2",
        "adidas-handball-spezial-core-black",
        "new-balance-1000-black",
        "asics-gel-kayano-20-glacier-grey",
        "asics-gel-1130-black-pure-silver",
        "asics-gel-nyc-cream-oyster-grey",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_SIX_JOBS = tuple(
    (slug, source, target)
    for slug in (
        "asics-gel-kayano-14-white-midnight",
        "salomon-xt-6-white-lunar-rock",
        "new-balance-9060-rain-cloud",
        "new-balance-2002r-protection-pack",
        "new-balance-530-white-silver-navy",
        "new-balance-1906r-silver-metallic",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_SEVEN_JOBS = tuple(
    (slug, source, target)
    for slug in (
        "hoka-ora-recovery-slide-3",
        "nike-calm-slide",
        "oofos-ooahh-slide",
        "crocs-mellow-recovery-slide",
        "nike-mind-001-slide-black",
        "nike-zoom-vomero-5-photon-dust",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_EIGHT_JOBS = tuple(
    (slug, source, target)
    for slug in (
        "nike-air-max-95-black-anthracite",
        "nike-air-force-1-07-white",
        "nike-dunk-low-panda",
        "adidas-samba-og-white-black",
        "adidas-gazelle-indoor-green",
        "adidas-campus-00s-core-black",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_NINE_JOBS = tuple(
    (slug, source, target)
    for slug in (
        "converse-chuck-70-high-black",
        "vans-old-skool-36-black-white",
        "timberland-field-boot-beef-broccoli",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_TEN_JOBS = tuple(
    (slug, source, target, APPAREL_SAFE_BOX)
    for slug in (
        "nike-dri-fit-volleyball-jersey",
        "mizuno-volleyball-practice-tee",
        "asics-actibreeze-match-top",
        "adidas-crazyflight-shorts",
        "nike-pro-compression-shorts",
        "under-armour-heatgear-top",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_ELEVEN_JOBS = tuple(
    (slug, source, target, APPAREL_SAFE_BOX)
    for slug in (
        "adidas-own-the-run-shorts",
        "on-performance-tights",
        "nike-therma-fit-training-hoodie",
        "adidas-zne-track-jacket",
        "essentials-hoodie-light-oatmeal",
        "north-face-1996-nuptse-black",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_TWELVE_JOBS = tuple(
    (slug, source, target, APPAREL_SAFE_BOX)
    for slug in (
        "supreme-mm6-zip-hoodie-black",
        "jordan-nigel-sylvester-bike-air-jersey",
        "nike-barcelona-ronaldinho-jersey",
        "kith-adidas-messi-tee",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_ACCESSORY_ONE_JOBS = tuple(
    (slug, source, target, safe_box)
    for slug, safe_box in (
        ("nike-vapor-elite-volleyball-kneepads", KNEEPAD_SAFE_BOX),
        ("mizuno-vs1-ultra-kneepad", KNEEPAD_SAFE_BOX),
        ("molten-v5m5000-flistatec", BALL_SAFE_BOX),
        ("theraband-resistance-band-set", BAND_SET_SAFE_BOX),
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_ACCESSORY_TWO_JOBS = tuple(
    (slug, source, target, safe_box)
    for slug, safe_box in (
        ("hyperice-vyper-go-roller", HYPERICE_SAFE_BOX),
        ("rocktape-kinesiology-tape-black", ROCKTAPE_SAFE_BOX),
        ("mueller-jumpers-knee-strap", MUELLER_SAFE_BOX),
        ("bauerfeind-sports-knee-support", BAUERFEIND_SAFE_BOX),
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_ACCESSORY_THREE_JOBS = tuple(
    (slug, source, target, safe_box)
    for slug, safe_box in (
        ("mizuno-arm-sleeves", APPAREL_SAFE_BOX),
        ("stance-icon-crew-socks", APPAREL_SAFE_BOX),
        ("mikasa-v200w-volleyball", BALL_SAFE_BOX),
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


BATCH_ACCESSORY_FOUR_JOBS = tuple(
    (slug, source, target, BALL_SAFE_BOX)
    for slug in ("wilson-evo-nxt-basketball",)
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-3.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


OFFICIAL_BATCH_SEVEN_OVERRIDES = (
    ("oofos-ooahh-slide", OFFICIAL_SOURCE_ROOT / "oofos-ooahh-slide" / "1-lateral.jpg", RELEASE_ROOT / "oofos-ooahh-slide-stage.png"),
    ("oofos-ooahh-slide", OFFICIAL_SOURCE_ROOT / "oofos-ooahh-slide" / "2-main.jpg", RELEASE_ROOT / "hover" / "oofos-ooahh-slide-front-pair-bg.png"),
    ("oofos-ooahh-slide", OFFICIAL_SOURCE_ROOT / "oofos-ooahh-slide" / "3-front.jpg", RELEASE_ROOT / "gallery" / "normalized" / "oofos-ooahh-slide-3.png"),
    ("oofos-ooahh-slide", OFFICIAL_SOURCE_ROOT / "oofos-ooahh-slide" / "4-back.jpg", RELEASE_ROOT / "gallery" / "normalized" / "oofos-ooahh-slide-4.png"),
    ("oofos-ooahh-slide", OFFICIAL_SOURCE_ROOT / "oofos-ooahh-slide" / "5-bottom.jpg", RELEASE_ROOT / "gallery" / "normalized" / "oofos-ooahh-slide-5.png"),
    ("crocs-mellow-recovery-slide", OFFICIAL_SOURCE_ROOT / "crocs-mellow-recovery-slide" / "1-side.jpg", RELEASE_ROOT / "crocs-mellow-recovery-slide-stage.png"),
    ("crocs-mellow-recovery-slide", OFFICIAL_SOURCE_ROOT / "crocs-mellow-recovery-slide" / "2-pair.jpg", RELEASE_ROOT / "hover" / "crocs-mellow-recovery-slide-front-pair-bg.png"),
    ("crocs-mellow-recovery-slide", OFFICIAL_SOURCE_ROOT / "crocs-mellow-recovery-slide" / "3-angle.jpg", RELEASE_ROOT / "gallery" / "normalized" / "crocs-mellow-recovery-slide-3.png"),
    ("crocs-mellow-recovery-slide", OFFICIAL_SOURCE_ROOT / "crocs-mellow-recovery-slide" / "4-back.jpg", RELEASE_ROOT / "gallery" / "normalized" / "crocs-mellow-recovery-slide-4.png"),
    ("crocs-mellow-recovery-slide", OFFICIAL_SOURCE_ROOT / "crocs-mellow-recovery-slide" / "5-bottom.jpg", RELEASE_ROOT / "gallery" / "normalized" / "crocs-mellow-recovery-slide-5.png"),
)


# Strict footwear-v1 maps the user-approved five-frame order without reusing
# the legacy F2 hover asset: F2 is one shoe at 3/4, F3 is the full front pair.
STRICT_FOOTWEAR_V1_JOBS = tuple(
    (slug, source, target)
    for slug in (
        "nike-kd-18",
        "nike-sabrina-3",
        "oofos-ooahh-slide",
    )
    for source, target in (
        (SOURCE_ROOT / f"{slug}.webp", RELEASE_ROOT / f"{slug}-stage.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-2.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-2.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-3.webp", RELEASE_ROOT / "hover" / f"{slug}-front-pair-bg.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-4.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-4.png"),
        (SOURCE_ROOT / "gallery" / f"{slug}-5.webp", RELEASE_ROOT / "gallery" / "normalized" / f"{slug}-5.png"),
    )
)


def is_white_background(pixel: tuple[int, int, int]) -> bool:
    return min(pixel) >= 238 and max(pixel) - min(pixel) <= 16


def connected_white_background(image: Image.Image) -> bytearray:
    width, height = image.size
    pixels = image.load()
    mask = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def add(x: int, y: int) -> None:
        index = y * width + x
        if mask[index] or not is_white_background(pixels[x, y]):
            return
        mask[index] = 1
        queue.append((x, y))

    for x in range(width):
        add(x, 0)
        add(x, height - 1)
    for y in range(height):
        add(0, y)
        add(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                add(next_x, next_y)
    return mask


def content_bounds(background: bytearray, size: tuple[int, int]) -> tuple[int, int, int, int]:
    width, height = size
    left, top, right, bottom = width, height, -1, -1
    for index, is_background in enumerate(background):
        if is_background:
            continue
        x = index % width
        y = index // width
        left = min(left, x)
        top = min(top, y)
        right = max(right, x)
        bottom = max(bottom, y)
    if right < left or bottom < top:
        raise RuntimeError("Could not locate product content on the source image")

    content_width = right - left + 1
    content_height = bottom - top + 1
    pad_x = max(24, round(content_width * 0.14))
    pad_y = max(24, round(content_height * 0.14))
    return (
        max(0, left - pad_x),
        max(0, top - pad_y),
        min(width, right + pad_x + 1),
        min(height, bottom + pad_y + 1),
    )


def normalize(source: Path, safe_box: tuple[int, int] = FOOTWEAR_SAFE_BOX) -> Image.Image:
    with Image.open(source) as opened:
        if "A" in opened.getbands() or "transparency" in opened.info:
            rgba = opened.convert("RGBA")
            alpha_background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            image = Image.alpha_composite(alpha_background, rgba).convert("RGB")
        else:
            image = opened.convert("RGB")

    background = connected_white_background(image)
    pixels = image.load()
    width, height = image.size
    for index, is_background in enumerate(background):
        if is_background:
            pixels[index % width, index // width] = BACKGROUND

    crop = image.crop(content_bounds(background, image.size))
    product_frame = ImageOps.contain(crop, safe_box, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", CANVAS_SIZE, BACKGROUND)
    x = (CANVAS_SIZE[0] - product_frame.width) // 2
    y = (CANVAS_SIZE[1] - product_frame.height) // 2
    canvas.paste(product_frame, (x, y))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only-batch-four", action="store_true")
    parser.add_argument("--only-batch-five", action="store_true")
    parser.add_argument("--only-batch-six", action="store_true")
    parser.add_argument("--only-batch-seven", action="store_true")
    parser.add_argument("--only-batch-eight", action="store_true")
    parser.add_argument("--only-batch-nine", action="store_true")
    parser.add_argument("--only-batch-ten", action="store_true")
    parser.add_argument("--only-batch-eleven", action="store_true")
    parser.add_argument("--only-batch-twelve", action="store_true")
    parser.add_argument("--only-accessory-batch-one", action="store_true")
    parser.add_argument("--only-accessory-batch-two", action="store_true")
    parser.add_argument("--only-accessory-batch-three", action="store_true")
    parser.add_argument("--only-accessory-batch-four", action="store_true")
    parser.add_argument("--only-strict-footwear-v1", action="store_true")
    args = parser.parse_args()

    jobs = STRICT_FOOTWEAR_V1_JOBS if args.only_strict_footwear_v1 else BATCH_ACCESSORY_FOUR_JOBS if args.only_accessory_batch_four else BATCH_ACCESSORY_THREE_JOBS if args.only_accessory_batch_three else BATCH_ACCESSORY_TWO_JOBS if args.only_accessory_batch_two else BATCH_ACCESSORY_ONE_JOBS if args.only_accessory_batch_one else BATCH_TWELVE_JOBS if args.only_batch_twelve else BATCH_ELEVEN_JOBS if args.only_batch_eleven else BATCH_TEN_JOBS if args.only_batch_ten else BATCH_NINE_JOBS if args.only_batch_nine else BATCH_EIGHT_JOBS if args.only_batch_eight else BATCH_SEVEN_JOBS if args.only_batch_seven else BATCH_SIX_JOBS if args.only_batch_six else BATCH_FIVE_JOBS if args.only_batch_five else BATCH_FOUR_JOBS if args.only_batch_four else JOBS
    if args.only_batch_seven:
        jobs = tuple(job for job in jobs if job[0] not in {"oofos-ooahh-slide", "crocs-mellow-recovery-slide"}) + OFFICIAL_BATCH_SEVEN_OVERRIDES

    for job in jobs:
        slug, source, target, safe_box = (*job, FOOTWEAR_SAFE_BOX) if len(job) == 3 else job
        if not source.is_file():
            raise FileNotFoundError(f"Missing source for {slug}: {source}")
        if target.exists() and not args.force:
            raise FileExistsError(f"Refusing to overwrite existing release asset: {target}")
        target.parent.mkdir(parents=True, exist_ok=True)
        normalize(source, safe_box).save(target, "PNG", optimize=True)
        with Image.open(target) as result:
            if result.size != CANVAS_SIZE or result.format != "PNG":
                raise RuntimeError(f"Invalid normalized release asset: {target}")
        print(target.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
