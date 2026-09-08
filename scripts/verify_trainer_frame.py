#!/usr/bin/env python3
"""Read-only pixel measurements for the five-position trainer contract.

This checks the image canvas and framing, not shoe identity or camera angle.
Visual approval must be recorded separately against the measured output hash.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops


SIZE = (1600, 1200)
BACKGROUND = (242, 243, 243)
TARGET_WIDTH = {1: 1184, 2: 1120, 3: 1184}
TARGET_HEIGHT = {4: 760, 5: 840}


def measure(path: Path, position: int) -> dict:
    if position not in range(1, 6):
        raise ValueError("position must be 1 through 5")
    data = path.read_bytes()
    with Image.open(path) as opened:
        opened.load()
        image = opened.convert("RGB")
        result = {
            "file": str(path),
            "position": position,
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
            "format": opened.format,
            "dimensions": list(opened.size),
            "checks": {},
            "visual_identity_and_angle_checked": False,
        }
    checks = result["checks"]
    checks["canvas"] = image.size == SIZE
    background = Image.new("RGB", image.size, BACKGROUND)
    difference = ImageChops.difference(image, background)
    maximum = ImageChops.lighter(ImageChops.lighter(*difference.split()[:2]), difference.split()[2])
    # Ignore tiny encoding/antialias differences; retain meaningful product edges.
    silhouette = maximum.point(lambda value: 255 if value > 16 else 0)
    bbox = silhouette.getbbox()
    result["foreground_bbox"] = list(bbox) if bbox else None
    width, height = image.size
    inset_x, inset_y = round(width * 0.08), round(height * 0.08)
    borders = [(0, 0, width, inset_y), (0, height - inset_y, width, height),
               (0, inset_y, inset_x, height - inset_y),
               (width - inset_x, inset_y, width, height - inset_y)]
    result["border_max_deviation"] = max(maximum.crop(box).getextrema()[1] for box in borders)
    checks["uniform_background_in_safe_margin"] = result["border_max_deviation"] <= 3
    if bbox:
        left, top, right, bottom = bbox
        subject_width, subject_height = right - left, bottom - top
        result["foreground_dimensions"] = [subject_width, subject_height]
        result["margins"] = [left, top, width - right, height - bottom]
        result["center_offset"] = [(left + right - width) / 2, (top + bottom - height) / 2]
        checks["safe_margins"] = left >= inset_x and right <= width - inset_x and top >= inset_y and bottom <= height - inset_y
        checks["centered"] = abs(left + right - width) <= width * 0.05 and abs(top + bottom - height) <= height * 0.05
        if position in TARGET_WIDTH:
            expected = TARGET_WIDTH[position]
            # Tall construction may legitimately hit its height limit first.
            checks["scale"] = (abs(subject_width - expected) <= expected * 0.05 or abs(subject_height - 760) <= 760 * 0.05) and subject_width <= expected * 1.05 and subject_height <= 760 * 1.05
        else:
            expected = TARGET_HEIGHT[position]
            checks["scale"] = abs(subject_height - expected) <= expected * 0.05 and subject_width <= 1184 * 1.05
    else:
        checks.update(safe_margins=False, centered=False, scale=False)
    result["pixel_checks_passed"] = all(checks.values())
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument("--position", type=int, required=True, choices=range(1, 6))
    args = parser.parse_args()
    result = measure(args.file, args.position)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["pixel_checks_passed"] else 1)


if __name__ == "__main__":
    main()
