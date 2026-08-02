from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from scripts import verify_approved_storefront_media as gate


class ApprovedStorefrontMediaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.assets = self.root / "assets"
        self.assets.mkdir()
        (self.root / "PROMPTS.md").write_text("test generation prompt", encoding="utf-8")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def write_frame(self, prefix: str, number: int, bbox, *, transparent: bool = False):
        mode = "RGBA" if transparent else "RGB"
        background = gate.BACKGROUND + ((255,) if transparent else ())
        image = Image.new(mode, gate.CANVAS_SIZE, background)
        fill = (30 + number, 50, 70, 255) if transparent else (30 + number, 50, 70)
        ImageDraw.Draw(image).ellipse(bbox, fill=fill)
        name = f"{prefix}-{number}.png"
        path = self.assets / name
        image.save(path)
        return name, hashlib.sha256(path.read_bytes()).hexdigest()

    def frames(self, prefix: str, *, overrides=None):
        boxes = [
            (240, 280, 1360, 880),
            (240, 280, 1360, 880),
            (240, 280, 1360, 880),
            (480, 180, 1120, 1020),
            (400, 180, 1200, 1020),
        ]
        if overrides:
            for index, bbox in overrides.items():
                boxes[index] = bbox
        frames = []
        for index, (role, angle, orientation, composition) in enumerate(
            gate.FRAME_SPECS["footwear"], 1
        ):
            name, digest = self.write_frame(prefix, index, boxes[index - 1])
            frames.append(
                {
                    "file": name,
                    "sha256": digest,
                    "role": role,
                    "angle": angle,
                    "orientation": orientation,
                    "composition": composition,
                    "source_kind": "generated-reference",
                    "generation": {
                        "model": "test-generator",
                        "source_file": f"assets/{name}",
                        "source_sha256": digest,
                        "prompt_reference": "PROMPTS.md",
                    },
                }
            )
        return frames

    @staticmethod
    def sku(sku: str, frames):
        return {
            "sku": sku,
            "product_type": "footwear",
            "rights": {"status": "owned", "evidence_reference": "test fixture"},
            "frames": frames,
        }

    def manifest(self, skus):
        path = self.root / "catalog-media" / "approved.json"
        path.parent.mkdir(exist_ok=True)
        path.write_text(
            json.dumps(
                {
                    "schema_version": 2,
                    "expected_sku_count": len(skus),
                    "canvas": list(gate.CANVAS_SIZE),
                    "background_rgb": list(gate.BACKGROUND),
                    "skus": skus,
                }
            ),
            encoding="utf-8",
        )
        return path

    def test_accepts_a_complete_uniform_five_frame_sku(self):
        gate.verify_manifest(
            self.manifest([self.sku("SABRINA-3", self.frames("shoe"))]),
            self.assets,
        )

    def test_reports_cropped_file_and_frame_order(self):
        frames = self.frames("shoe", overrides={3: (80, 180, 1120, 1020)})
        frames[3]["angle"] = "side"
        with self.assertRaisesRegex(
            gate.MediaQaError,
            r"frame 4.*expected role[\s\S]*shoe-4\.png.*safe inset",
        ):
            gate.verify_manifest(
                self.manifest([self.sku("SABRINA-3", frames)]),
                self.assets,
            )

    def test_reports_transparency_and_duplicate_hashes(self):
        frames = self.frames("shoe")
        name, digest = self.write_frame("alpha", 5, (400, 180, 1200, 1020), transparent=True)
        frames[4].update({"file": name, "sha256": digest})
        frames[3]["file"] = frames[2]["file"]
        frames[3]["sha256"] = frames[2]["sha256"]
        with self.assertRaisesRegex(
            gate.MediaQaError,
            r"duplicate image bytes[\s\S]*mode must be opaque RGB",
        ):
            gate.verify_manifest(
                self.manifest([self.sku("SABRINA-3", frames)]),
                self.assets,
            )

    def test_reports_inconsistent_scale_inside_a_type_and_angle_cohort(self):
        first = self.sku("FIRST", self.frames("first"))
        second = self.sku(
            "SECOND",
            self.frames("second", overrides={0: (144, 280, 1456, 880)}),
        )
        with self.assertRaisesRegex(
            gate.MediaQaError,
            r"footwear/side:single: cohort width spread",
        ):
            gate.verify_manifest(self.manifest([first, second]), self.assets)


if __name__ == "__main__":
    unittest.main()
