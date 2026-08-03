#!/usr/bin/env python3
"""Reframe every active catalog image on one profile-aware studio contract.

The builder never mirrors or stretches a product. It removes only the
border-connected neutral studio backdrop, scales the complete visible subject
uniformly and centers it on the KICKSBASE 4:3 product canvas.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image, ImageChops, ImageFilter, ImageOps

try:
    from scripts.import_ai_contact_sheet import border_connected_background_alpha
    from scripts.portable_hash import hash_mode_for_path, sha256_file
except ModuleNotFoundError:  # Direct execution: python scripts/build_*.py
    from import_ai_contact_sheet import border_connected_background_alpha
    from portable_hash import hash_mode_for_path, sha256_file


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "catalog"
APPROVED_PRODUCTS = ROOT / "public" / "storefront-media" / "approved" / "products"
GENERATED_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "unified-missing-angles"
FRONT_PAIR_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "unified-front-pairs"
MANIFEST = ROOT / "catalog-media" / "unified-catalog-media.json"
APPROVED_MANIFEST = ROOT / "catalog-media" / "approved-storefront-media.json"
CATALOG_GENERATOR = ROOT / "scripts" / "generate_catalog_art.py"
CANVAS_SIZE = (1600, 1200)
BACKGROUND = (242, 243, 243)

APPROVED_SLUGS = {
    "anta-kai-1",
    "asics-sky-elite-ff-3",
    "li-ning-wade-808-4-ultra",
    "new-balance-two-wxy-v5",
    "nike-aone",
    "nike-free-metcon-6",
    "nike-kd-18",
    "nike-sabrina-3",
}

SLIDES = {
    "crocs-mellow-recovery-slide",
    "hoka-ora-recovery-slide-3",
    "nike-calm-slide",
    "nike-mind-001-slide-black",
    "oofos-ooahh-slide",
}
APPAREL_OUTERWEAR = {
    "adidas-zne-track-jacket",
    "essentials-hoodie-light-oatmeal",
    "nike-therma-fit-training-hoodie",
    "north-face-1996-nuptse-black",
    "supreme-mm6-zip-hoodie-black",
}
APPAREL_SHORTS = {
    "adidas-crazyflight-shorts",
    "adidas-own-the-run-shorts",
    "nike-pro-compression-shorts",
}
APPAREL_PANTS = {"on-performance-tights"}
APPAREL_TOPS = {
    "asics-actibreeze-match-top",
    "jordan-nigel-sylvester-bike-air-jersey",
    "kith-adidas-messi-tee",
    "mizuno-volleyball-practice-tee",
    "nike-barcelona-ronaldinho-jersey",
    "nike-dri-fit-volleyball-jersey",
    "under-armour-heatgear-top",
}
BALLS = {
    "mikasa-v200w-volleyball",
    "molten-v5m4500-volleyball",
    "molten-v5m5000-flistatec",
    "wilson-evo-nxt-basketball",
}
BAGS = {
    "adidas-tiro-league-duffel",
    "nike-brasilia-training-duffel",
    "nike-hoops-elite-backpack",
}
PROTECTION = {
    "bauerfeind-sports-knee-support",
    "mcdavid-hex-elbow-pads",
    "mcdavid-hex-knee-pads",
    "mizuno-arm-sleeves",
    "mizuno-vs1-ultra-kneepad",
    "mueller-jumpers-knee-strap",
    "nike-essential-volleyball-elbow-pads",
    "nike-vapor-elite-volleyball-kneepads",
}
SOCKS = {
    "nike-everyday-cushion-crew-socks-6pk",
    "stance-icon-crew-socks",
}
BOTTLES = {
    "camelbak-podium-chill-bottle",
    "nike-hyperfuel-water-bottle",
}
RECOVERY = {
    "hyperice-vyper-go-roller",
    "nike-resistance-band-heavy",
    "rocktape-kinesiology-tape-black",
    "theraband-resistance-band-set",
    "triggerpoint-grid-foam-roller",
}
HEADWEAR = {"new-era-yankees-59fifty-black"}

# Only logical frame three is replaced for these products. Frame two stays byte-for-byte
# intact, while hover gets a complete, front three-quarter pair view.
FRONT_PAIR_OVERRIDE_SLUGS = frozenset({
    "adidas-campus-00s-core-black",
    "adidas-crazyflight-6-mid",
    "adidas-gazelle-indoor-green",
    "adidas-handball-spezial-core-black",
    "adidas-harden-volume-9",
    "adidas-samba-og-white-black",
    "adidas-stabil-16-indoor",
    "asics-gel-kayano-14-white-midnight",
    "asics-gel-kayano-20-glacier-grey",
    "asics-gel-nyc-cream-oyster-grey",
    "asics-gel-1130-black-pure-silver",
    "asics-gel-tactic-13",
    "asics-metarise-2",
    "asics-netburner-ballistic-ff-4",
    "asics-sky-elite-ff-mt-3",
    "asics-upcourt-6",
    "converse-chuck-70-high-black",
    "crocs-mellow-recovery-slide",
    "hoka-ora-recovery-slide-3",
    "jordan-luka-4",
    "mizuno-cyclone-speed-5",
    "mizuno-wave-lightning-z8",
    "mizuno-wave-lightning-z8-mid",
    "mizuno-wave-luminous-3",
    "mizuno-wave-momentum-3",
    "mizuno-wave-momentum-elite-mid",
    "mizuno-wave-momentum-pro",
    "mizuno-wave-voltage-2",
    "new-balance-1000-black",
    "new-balance-1906r-silver-metallic",
    "new-balance-2002r-protection-pack",
    "new-balance-530-white-silver-navy",
    "new-balance-9060-rain-cloud",
    "nike-air-force-1-07-white",
    "nike-air-max-95-black-anthracite",
    "nike-calm-slide",
    "nike-dunk-low-panda",
    "nike-gt-cut-academy",
    "nike-hyperace-3-se",
    "nike-ja-3",
    "nike-lebron-nxxt-genisus",
    "nike-mind-001-slide-black",
    "nike-zoom-hyperset-2",
    "nike-zoom-vomero-5-photon-dust",
    "oofos-ooahh-slide",
    "salomon-xt-6-white-lunar-rock",
    "timberland-field-boot-beef-broccoli",
    "vans-old-skool-36-black-white",
    "way-of-wade-all-city-12",
})


@dataclass(frozen=True)
class FrameSpec:
    role: str
    angle: str
    composition: str
    target_width: int | None = None
    target_height: int | None = None
    max_width: int = 1280
    max_height: int = 960
    rotate_portrait: bool = False


PROFILE_SPECS: dict[str, tuple[FrameSpec, ...]] = {
    "footwear": (
        FrameSpec("primary", "side", "single", target_width=1184, max_height=760),
        FrameSpec("gallery", "opposite-side", "single", target_width=1120, max_height=760),
        FrameSpec("gallery", "three-quarter", "pair", target_width=1184, max_height=760),
        FrameSpec("gallery", "rear", "single-or-pair", target_height=760, max_width=1088),
        FrameSpec("gallery", "sole", "single-or-pair", target_height=840, max_width=1152, rotate_portrait=True),
    ),
    "slide": (
        FrameSpec("primary", "side", "single-or-pair", target_width=1088, max_height=720),
        FrameSpec("gallery", "opposite-side", "single-or-pair", target_width=1040, max_height=720),
        FrameSpec("gallery", "three-quarter", "pair", target_width=1056, max_height=760),
        FrameSpec("gallery", "rear", "pair", target_width=960, max_height=780),
        FrameSpec("gallery", "sole", "single-or-pair", target_width=1000, max_height=780),
    ),
    "apparel-top": (
        FrameSpec("primary", "front", "single", target_height=900, max_width=1040),
        FrameSpec("gallery", "rear", "single", target_height=900, max_width=1040),
        FrameSpec("gallery", "alternate-front", "single", target_height=860, max_width=1040),
        FrameSpec("gallery", "side", "single", target_height=840, max_width=940),
        FrameSpec("gallery", "detail", "single-detail", target_width=840, max_height=760),
    ),
    "apparel-outerwear": (
        FrameSpec("primary", "front", "single", target_height=900, max_width=1040),
        FrameSpec("gallery", "rear", "single", target_height=900, max_width=1040),
        FrameSpec("gallery", "alternate-front", "single", target_height=860, max_width=1040),
        FrameSpec("gallery", "side", "single", target_height=840, max_width=940),
        FrameSpec("gallery", "detail", "single-detail", target_width=840, max_height=760),
    ),
    "apparel-shorts": (
        FrameSpec("primary", "front", "single", target_height=800, max_width=1040),
        FrameSpec("gallery", "rear", "single", target_height=800, max_width=1040),
        FrameSpec("gallery", "alternate-front", "single", target_height=780, max_width=1040),
        FrameSpec("gallery", "side", "single", target_height=780, max_width=900),
        FrameSpec("gallery", "detail", "single-detail", target_width=820, max_height=720),
    ),
    "apparel-pants": (
        FrameSpec("primary", "front", "single", target_height=920, max_width=820),
        FrameSpec("gallery", "rear", "single", target_height=920, max_width=820),
        FrameSpec("gallery", "alternate-front", "single", target_height=900, max_width=820),
        FrameSpec("gallery", "side", "single", target_height=900, max_width=720),
        FrameSpec("gallery", "detail", "single-detail", target_width=780, max_height=760),
    ),
    "ball": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_height=780, max_width=880)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
    "bag": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_width=1000, max_height=820)
        for index, angle in enumerate(("three-quarter", "side", "rear", "front", "detail"))
    ),
    "protection": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single-or-pair", target_height=840, max_width=1040)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
    "socks": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single-or-set", target_height=840, max_width=1040)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
    "bottle": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_height=840, max_width=760)
        for index, angle in enumerate(("front", "alternate", "rear", "top", "detail"))
    ),
    "recovery": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single-or-set", target_width=960, max_height=840)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
    "headwear": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_width=900, max_height=820)
        for index, angle in enumerate(("three-quarter", "side", "rear", "underside", "detail"))
    ),
    "small-accessory": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_width=820, max_height=760)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
}


def media_profile(slug: str) -> str:
    cohorts = (
        (SLIDES, "slide"),
        (APPAREL_TOPS, "apparel-top"),
        (APPAREL_OUTERWEAR, "apparel-outerwear"),
        (APPAREL_SHORTS, "apparel-shorts"),
        (APPAREL_PANTS, "apparel-pants"),
        (BALLS, "ball"),
        (BAGS, "bag"),
        (PROTECTION, "protection"),
        (SOCKS, "socks"),
        (BOTTLES, "bottle"),
        (RECOVERY, "recovery"),
        (HEADWEAR, "headwear"),
    )
    for slugs, profile in cohorts:
        if slug in slugs:
            return profile
    return "footwear"


def active_paths(slug: str) -> tuple[Path, ...]:
    if slug in APPROVED_SLUGS:
        root = APPROVED_PRODUCTS / slug
        return (
            root / "01-side.png",
            root / "03-side.png",
            root / "02-three-quarter.png",
            root / "04-rear.png",
            root / "05-sole.png",
        )
    return (
        CATALOG / f"{slug}.webp",
        CATALOG / "gallery" / f"{slug}-2.webp",
        CATALOG / "gallery" / f"{slug}-3.webp",
        CATALOG / "gallery" / f"{slug}-4.webp",
        CATALOG / "gallery" / f"{slug}-5.webp",
    )


def source_paths(slug: str) -> tuple[Path, ...]:
    paths = list(active_paths(slug))
    overrides = {
        1: GENERATED_OVERRIDES / f"{slug}-opposite-side.png",
        2: GENERATED_OVERRIDES / f"{slug}-front.png",
        3: GENERATED_OVERRIDES / f"{slug}-rear.png",
        4: GENERATED_OVERRIDES / f"{slug}-sole.png",
    }
    for index, override in overrides.items():
        if override.is_file():
            paths[index] = override
    front_pair = FRONT_PAIR_OVERRIDES / f"{slug}-front-three-quarter-pair.webp"
    if slug in FRONT_PAIR_OVERRIDE_SLUGS and front_pair.is_file():
        paths[2] = front_pair
    return tuple(paths)


def border_key(image: Image.Image) -> tuple[int, int, int]:
    width, height = image.size
    samples = (
        image.getpixel((0, 0)),
        image.getpixel((width - 1, 0)),
        image.getpixel((0, height - 1)),
        image.getpixel((width - 1, height - 1)),
    )
    return tuple(sorted(pixel[channel] for pixel in samples)[len(samples) // 2] for channel in range(3))


def subject_cutout(path: Path) -> Image.Image:
    with Image.open(path) as opened:
        opened.load()
        rgb = ImageOps.exif_transpose(opened).convert("RGB")
    key = border_key(rgb)
    if GENERATED_OVERRIDES in path.parents or FRONT_PAIR_OVERRIDES in path.parents:
        alpha = border_connected_background_alpha(rgb, tolerance=4)
    else:
        difference = ImageChops.difference(rgb, Image.new("RGB", rgb.size, key))
        maximum = ImageChops.lighter(
            ImageChops.lighter(difference.getchannel("R"), difference.getchannel("G")),
            difference.getchannel("B"),
        )
        tolerance = 8 if min(key) >= 250 else 3
        alpha = maximum.point(lambda value: 255 if value > tolerance else 0)
        alpha = alpha.filter(ImageFilter.GaussianBlur(0.45))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox is None:
        raise RuntimeError(f"No product foreground found in {path}")
    return rgba.crop(bbox)


def fit_subject(subject: Image.Image, spec: FrameSpec) -> Image.Image:
    if spec.rotate_portrait and subject.width > subject.height * 1.15:
        subject = subject.rotate(90, expand=True, resample=Image.Resampling.BICUBIC)
    if spec.target_width is not None:
        scale = spec.target_width / subject.width
    elif spec.target_height is not None:
        scale = spec.target_height / subject.height
    else:
        scale = 1.0
    scale = min(scale, spec.max_width / subject.width, spec.max_height / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    return subject.resize(size, Image.Resampling.LANCZOS)


def render(subject: Image.Image) -> Image.Image:
    if subject.width > 1280 or subject.height > 960:
        raise RuntimeError(f"Subject {subject.size} violates the 160x120 safe inset")
    canvas = Image.new("RGB", CANVAS_SIZE, BACKGROUND)
    offset = ((CANVAS_SIZE[0] - subject.width) // 2, (CANVAS_SIZE[1] - subject.height) // 2)
    canvas.paste(subject.convert("RGB"), offset, subject.getchannel("A"))
    return canvas


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    suffix = path.suffix.lower()
    with NamedTemporaryFile(suffix=suffix, dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        if suffix == ".png":
            image.save(temporary_path, "PNG", optimize=True, exif=b"")
        elif suffix == ".webp":
            image.save(temporary_path, "WEBP", quality=95, method=6, exact=True, exif=b"", icc_profile=None)
        else:
            raise RuntimeError(f"Unsupported output format: {path}")
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def provenance(slug: str, position: int, source: Path) -> dict[str, object]:
    if FRONT_PAIR_OVERRIDES in source.parents:
        origin = source
        generator = "scripts/build_footwear_front_pair_overrides.py"
        origin_kind = "project-generated-derivative"
    elif GENERATED_OVERRIDES in source.parents:
        origin = source
        generator = "OpenAI image generation from the existing five-frame product reference set"
        origin_kind = "project-generated-original"
    elif slug in APPROVED_SLUGS:
        origin = APPROVED_MANIFEST
        generator = "KICKSBASE approved storefront media pipeline"
        origin_kind = "project-generated-original"
    else:
        origin = CATALOG_GENERATOR
        generator = "scripts/generate_catalog_art.py"
        origin_kind = "project-generated-original"

    origin_hash_mode = hash_mode_for_path(origin)
    return {
        "origin_kind": origin_kind,
        "origin_reference": origin.resolve().relative_to(ROOT.resolve()).as_posix(),
        "origin_hash_mode": origin_hash_mode,
        "origin_sha256": sha256_file(origin, mode=origin_hash_mode),
        "generator": generator,
        "rights": {
            "status": "owned",
            "license_reference": f"KICKSBASE project-generated catalog media: {slug}:{position}",
            "verified_at": "2026-08-02T00:00:00Z",
        },
    }


def build(
    *,
    dry_run: bool,
    only_slugs: set[str] | None = None,
    only_positions: set[int] | None = None,
) -> dict[str, object]:
    slugs = sorted(path.stem for path in CATALOG.glob("*.webp"))
    if len(slugs) != 100 or len(set(slugs)) != 100:
        raise RuntimeError(f"Expected 100 catalog slugs, found {len(slugs)}")
    products: list[dict[str, object]] = []
    for slug in slugs:
        profile = media_profile(slug)
        sources = source_paths(slug)
        outputs = active_paths(slug)
        specs = PROFILE_SPECS[profile]
        if not all(path.is_file() for path in (*sources, *outputs)):
            missing = [str(path) for path in (*sources, *outputs) if not path.is_file()]
            raise RuntimeError(f"{slug}: missing media: {', '.join(missing)}")
        frames: list[dict[str, object]] = []
        for index, (source, output, spec) in enumerate(zip(sources, outputs, specs, strict=True), 1):
            # The eight featured products already have a stricter, source-aware
            # approved builder. Keep those pixels intact and normalize only the
            # 92 legacy sets here so both pipelines remain reproducible.
            selected = only_slugs is None or slug in only_slugs
            selected_position = only_positions is None or index in only_positions
            should_render = selected and selected_position and (
                slug not in APPROVED_SLUGS or GENERATED_OVERRIDES in source.parents
            )
            if should_render:
                rendered = render(fit_subject(subject_cutout(source), spec))
                if not dry_run:
                    save(rendered, output)
            frames.append(
                {
                    "position": index,
                    "file": output.resolve().relative_to(ROOT.resolve()).as_posix(),
                    "role": spec.role,
                    "angle": spec.angle,
                    "composition": spec.composition,
                    **provenance(slug, index, source),
                }
            )
        products.append({"slug": slug, "media_profile": profile, "frames": frames})

    if not dry_run:
        for product in products:
            for frame in product["frames"]:  # type: ignore[index]
                output = ROOT / frame["file"]  # type: ignore[index]
                frame["sha256"] = sha256_file(output)  # type: ignore[index]
        MANIFEST.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "expected_sku_count": 100,
                    "expected_frame_count": 500,
                    "canvas": list(CANVAS_SIZE),
                    "background_rgb": list(BACKGROUND),
                    "origin_notice": (
                        "Project-generated catalog references; not official Poizon or manufacturer photography. "
                        "Visual approval is stored separately so rebuilding pixels cannot approve its own output."
                    ),
                    "products": products,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    return {"products": len(products), "frames": len(products) * 5, "dry_run": dry_run}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", action="append", default=[], metavar="SLUG")
    parser.add_argument("--frame", action="append", default=[], type=int, metavar="POSITION")
    parser.add_argument("--manifest-only", action="store_true")
    args = parser.parse_args()
    if args.manifest_only and (args.only or args.frame):
        parser.error("--manifest-only cannot be combined with --only or --frame")
    if any(position not in {1, 2, 3, 4, 5} for position in args.frame):
        parser.error("--frame must be between 1 and 5")
    selection = set() if args.manifest_only else set(args.only) or None
    positions = set(args.frame) or None
    print(
        json.dumps(
            build(dry_run=args.dry_run, only_slugs=selection, only_positions=positions),
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
