from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image, ImageDraw

from scripts import build_unified_catalog_media as builder


class SubjectCutoutTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.path = Path(self.temporary.name) / "source.png"

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_uses_a_meaningful_transparent_silhouette(self) -> None:
        image = Image.new("RGBA", (200, 120), (255, 255, 255, 0))
        ImageDraw.Draw(image).rectangle((40, 35, 159, 84), fill=(20, 30, 40, 255))
        image.save(self.path)

        subject = builder.subject_cutout(self.path)

        self.assertLessEqual(subject.width, 121)
        self.assertLessEqual(subject.height, 51)

    def test_ignores_an_isolated_transparent_pixel_in_an_opaque_png(self) -> None:
        image = Image.new("RGBA", (200, 120), (255, 255, 255, 255))
        ImageDraw.Draw(image).rectangle((40, 35, 159, 84), fill=(20, 30, 40, 255))
        image.putpixel((0, 0), (255, 255, 255, 0))
        image.save(self.path)

        subject = builder.subject_cutout(self.path)

        self.assertLess(subject.width, 160)
        self.assertLess(subject.height, 90)

    def test_uses_the_locked_timberland_tolerance_for_low_amplitude_background_noise(self) -> None:
        image = Image.new("RGBA", (200, 120), (242, 242, 242, 255))
        drawing = ImageDraw.Draw(image)
        drawing.rectangle((10, 10, 189, 109), fill=(238, 238, 238, 255))
        drawing.rectangle((40, 35, 159, 84), fill=(20, 30, 40, 255))
        image.save(self.path)

        broad_subject = builder.subject_cutout(self.path)
        normalization = {
            "path": self.path.resolve(),
            "sha256": hashlib.sha256(self.path.read_bytes()).hexdigest(),
            "tolerance": 4,
        }
        with mock.patch.object(builder, "TIMBERLAND_FIELD_BOOT_F2_CUTOUT_NORMALIZATION", normalization):
            subject = builder.subject_cutout(self.path)

        self.assertGreater(broad_subject.width, 170)
        self.assertLess(subject.width, 140)
        self.assertLess(subject.height, 70)

    def test_rejects_a_changed_locked_timberland_cutout_source(self) -> None:
        image = Image.new("RGBA", (200, 120), (242, 242, 242, 255))
        ImageDraw.Draw(image).rectangle((40, 35, 159, 84), fill=(20, 30, 40, 255))
        image.save(self.path)
        normalization = {
            "path": self.path.resolve(),
            "sha256": "0" * 64,
            "tolerance": 4,
        }

        with mock.patch.object(builder, "TIMBERLAND_FIELD_BOOT_F2_CUTOUT_NORMALIZATION", normalization):
            with self.assertRaisesRegex(RuntimeError, "Timberland F2 cutout source no longer matches"):
                builder.subject_cutout(self.path)

    def test_lossless_webp_keeps_the_exact_catalog_background(self) -> None:
        output = Path(self.temporary.name) / "output.webp"
        image = Image.new("RGB", builder.CANVAS_SIZE, builder.BACKGROUND)
        ImageDraw.Draw(image).rectangle((500, 400, 1099, 799), fill=(25, 50, 75))

        builder.save(image, output)

        with Image.open(output) as saved:
            self.assertEqual(saved.convert("RGB").getpixel((0, 0)), builder.BACKGROUND)


class ApprovedPoizonReplacementTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.manifest = self.root / "catalog-media" / "poizon-catalog-media-intake.json"
        self.manifest.parent.mkdir(parents=True)

    def tearDown(self) -> None:
        builder.approved_poizon_replacements.cache_clear()
        self.temporary.cleanup()

    def write_manifest(self, slug: str, activation: dict[str, int], count: int = 8) -> None:
        frames = []
        for position in range(1, count + 1):
            relative = Path("catalog-media") / "intake" / slug / f"{position:02}.jpg"
            source = self.root / relative
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_bytes(f"{slug}:{position}".encode("ascii"))
            frames.append(
                {
                    "position": position,
                    "local_file": relative.as_posix(),
                    "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                }
            )
        self.manifest.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "products": [
                        {
                            "slug": slug,
                            "qa": {"status": "approved"},
                            "activation": {"source_positions": activation},
                            "frames": frames,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )

    def replacements(self) -> dict[str, dict[int, dict[str, object]]]:
        builder.approved_poizon_replacements.cache_clear()
        with (
            mock.patch.object(builder, "ROOT", self.root),
            mock.patch.object(builder, "POIZON_INTAKE_MANIFEST", self.manifest),
        ):
            return builder.approved_poizon_replacements()

    def test_accepts_extended_source_positions_for_a_reviewed_frame_two_replacement(self) -> None:
        self.write_manifest("nike-ja-3", {"1": 1, "2": 4, "5": 8})

        replacements = self.replacements()["nike-ja-3"]

        self.assertEqual(set(replacements), {1, 2, 5})
        self.assertEqual(replacements[2]["position"], 4)
        self.assertEqual(replacements[5]["position"], 8)

    def test_accepts_sky_frame_two_after_mixed_colorway_review(self) -> None:
        self.write_manifest("asics-sky-elite-ff-3", {"1": 1, "2": 2}, count=6)

        replacements = self.replacements()["asics-sky-elite-ff-3"]

        self.assertEqual(set(replacements), {1, 2})
        self.assertEqual(replacements[2]["position"], 2)

    def test_accepts_reviewed_batch_three_four_frame_stabil_intake(self) -> None:
        self.write_manifest(
            "adidas-stabil-16-indoor",
            {"1": 1, "2": 3, "5": 4},
            count=4,
        )

        replacements = self.replacements()["adidas-stabil-16-indoor"]

        self.assertEqual(set(replacements), {1, 2, 5})
        self.assertEqual(replacements[2]["position"], 3)
        self.assertEqual(replacements[5]["position"], 4)

    def test_rejects_four_frame_intake_outside_narrow_batch_three_allowance(self) -> None:
        self.write_manifest("unreviewed-four-frame", {"1": 1}, count=4)

        with self.assertRaisesRegex(RuntimeError, "at least 5 source frames"):
            self.replacements()

    def test_rejects_frame_two_for_a_non_exception_slug(self) -> None:
        self.write_manifest("asics-gel-kayano-14", {"2": 2}, count=6)

        with self.assertRaisesRegex(RuntimeError, "frame two must stay owner-preserved"):
            self.replacements()


if __name__ == "__main__":
    unittest.main()
