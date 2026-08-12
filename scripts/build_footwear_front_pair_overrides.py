#!/usr/bin/env python3
"""Build reproducible logical-frame-three footwear pair sources.

The script only derives the third logical frame for the audited weak sets. It
does not overwrite a product's second gallery image and does not claim an
official Poizon or manufacturer source. Official supplier media still takes
priority when it is supplied through the offline source-validation pipeline.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps

try:
    from scripts.build_unified_catalog_media import (
        CANVAS_SIZE,
        FRONT_PAIR_OVERRIDE_SLUGS,
        FRONT_PAIR_OVERRIDES,
        active_paths,
        media_profile,
        subject_cutout,
    )
except ModuleNotFoundError:  # Direct execution: python scripts/build_*.py
    from build_unified_catalog_media import (
        CANVAS_SIZE,
        FRONT_PAIR_OVERRIDE_SLUGS,
        FRONT_PAIR_OVERRIDES,
        active_paths,
        media_profile,
        subject_cutout,
    )


SOURCE_BACKGROUND = (255, 255, 255)
MIN_SAFE_INSET = (160, 120)
# A few source frames already provide the complete front-three-quarter pair;
# using them directly avoids extracting an additional shoe and creating a
# visually false third item. The selector is only for source selection, never
# for overwriting the referenced active frame.
PRECOMPOSED_PAIR_SOURCES = {
    "asics-gel-1130-black-pure-silver": "primary",
    "crocs-mellow-recovery-slide": "primary",
    "nike-lebron-nxxt-genisus": "opposite",
    "nike-mind-001-slide-black": "primary",
    "oofos-ooahh-slide": "primary",
    "timberland-field-boot-beef-broccoli": "primary",
    "way-of-wade-all-city-12": "primary",
}


def contain_and_rotate(
    image: Image.Image,
    maximum: tuple[int, int],
    rotation: float,
) -> Image.Image:
    contained = ImageOps.contain(image, maximum, Image.Resampling.LANCZOS)
    return contained.rotate(
        rotation,
        expand=True,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(255, 255, 255, 0),
    )


def render_centered(slug: str, composition: Image.Image) -> Image.Image:

    bbox = composition.getbbox()
    if bbox is None:
        raise RuntimeError(f"{slug}: no footwear foreground was extracted")
    left, top, right, bottom = bbox
    offset = (
        CANVAS_SIZE[0] // 2 - (left + right) // 2,
        CANVAS_SIZE[1] // 2 - (top + bottom) // 2,
    )
    centered = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    centered.alpha_composite(composition, offset)
    centered_bbox = centered.getbbox()
    if centered_bbox is None:
        raise RuntimeError(f"{slug}: pair composition is empty")
    left, top, right, bottom = centered_bbox
    if (
        left < MIN_SAFE_INSET[0]
        or top < MIN_SAFE_INSET[1]
        or CANVAS_SIZE[0] - right < MIN_SAFE_INSET[0]
        or CANVAS_SIZE[1] - bottom < MIN_SAFE_INSET[1]
    ):
        raise RuntimeError(f"{slug}: pair composition violates the safe inset: {centered_bbox}")

    output = Image.new("RGB", CANVAS_SIZE, SOURCE_BACKGROUND)
    output.paste(centered.convert("RGB"), mask=centered.getchannel("A"))
    return output


def pair_source(slug: str) -> Image.Image:
    primary, opposite, front, _, _ = active_paths(slug)
    profile = media_profile(slug)

    if source_name := PRECOMPOSED_PAIR_SOURCES.get(slug):
        composition = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
        source_by_name = {
            "primary": primary,
            "opposite": opposite,
            "front": front,
        }
        pair = contain_and_rotate(subject_cutout(source_by_name[source_name]), (1120, 700), 0.0)
        composition.alpha_composite(
            pair,
            (CANVAS_SIZE[0] // 2 - pair.width // 2, CANVAS_SIZE[1] // 2 - pair.height // 2),
        )
        return render_centered(slug, composition)

    # Slides in this cohort have two individual product views. The original
    # third frame can already contain a pair from the wrong angle, so it is not
    # used as a component of the replacement logical frame three.
    if profile == "slide":
        rear_source, front_source = opposite, primary
    else:
        rear_source, front_source = primary, front

    rear_shoe = contain_and_rotate(subject_cutout(rear_source), (560, 440), -4.0)
    front_shoe = contain_and_rotate(subject_cutout(front_source), (660, 560), 2.0)
    composition = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    composition.alpha_composite(rear_shoe, (230, 560 - rear_shoe.height // 2))
    composition.alpha_composite(front_shoe, (700, 560 - front_shoe.height // 2))
    return render_centered(slug, composition)


def output_path(slug: str) -> Path:
    return FRONT_PAIR_OVERRIDES / f"{slug}-front-three-quarter-pair.webp"


def build(*, only_slugs: set[str] | None, dry_run: bool, overwrite: bool) -> dict[str, object]:
    targets = sorted(FRONT_PAIR_OVERRIDE_SLUGS if only_slugs is None else only_slugs)
    unknown = sorted(set(targets) - FRONT_PAIR_OVERRIDE_SLUGS)
    if unknown:
        raise RuntimeError(f"Unknown front-pair targets: {', '.join(unknown)}")

    written: list[str] = []
    for slug in targets:
        target = output_path(slug)
        if target.exists() and not overwrite:
            raise RuntimeError(f"{target} already exists; use --overwrite to rebuild it")
        if dry_run:
            written.append(target.as_posix())
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        pair_source(slug).save(
            target,
            "WEBP",
            quality=98,
            method=6,
            exact=True,
            exif=b"",
            icc_profile=None,
        )
        written.append(target.as_posix())
    return {"targets": len(written), "files": written, "dry_run": dry_run}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", action="append", default=[], metavar="SLUG")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    print(
        json.dumps(
            build(
                only_slugs=set(args.only) or None,
                dry_run=args.dry_run,
                overwrite=args.overwrite,
            ),
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
