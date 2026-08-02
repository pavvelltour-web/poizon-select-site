from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from scripts import verify_unified_catalog_media as gate


class UnifiedCatalogMediaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.assets = self.root / "public" / "catalog"
        self.assets.mkdir(parents=True)
        self.templates = self.create_templates("footwear")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    @staticmethod
    def centered_bbox(
        spec: object,
        *,
        scale: float = 1.0,
    ) -> tuple[int, int, int, int]:
        if spec.target_width is not None:  # type: ignore[attr-defined]
            width = round(spec.target_width * scale)  # type: ignore[attr-defined]
            height = round(spec.max_height * 0.6 * scale)  # type: ignore[attr-defined]
        else:
            width = round(spec.max_width * 0.6 * scale)  # type: ignore[attr-defined]
            height = round(spec.target_height * scale)  # type: ignore[attr-defined]
        left = (gate.CANVAS_SIZE[0] - width) // 2
        top = (gate.CANVAS_SIZE[1] - height) // 2
        return left, top, left + width, top + height

    def write_image(
        self,
        name: str,
        bbox: tuple[int, int, int, int],
        *,
        color: tuple[int, int, int],
    ) -> tuple[str, str]:
        image = Image.new("RGB", gate.CANVAS_SIZE, gate.BACKGROUND)
        left, top, right, bottom = bbox
        ImageDraw.Draw(image).rectangle(
            (left, top, right - 1, bottom - 1),
            fill=color,
        )
        path = self.assets / name
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path)
        return path.relative_to(self.root).as_posix(), hashlib.sha256(path.read_bytes()).hexdigest()

    def create_templates(self, profile: str) -> list[tuple[str, str]]:
        frames: list[tuple[str, str]] = []
        for index, spec in enumerate(gate.FRAME_SPECS[profile], 1):
            frames.append(
                self.write_image(
                    f"template-{profile}-{index}.png",
                    self.centered_bbox(spec),
                    color=(25 + index, 50 + index, 75 + index),
                )
            )
        return frames

    def copy_with_marker(self, source_relative: str, destination_relative: str, marker: str) -> str:
        source = self.root / source_relative
        destination = self.root / destination_relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        with destination.open("ab") as output:
            output.write(marker.encode("ascii"))
        return hashlib.sha256(destination.read_bytes()).hexdigest()

    @staticmethod
    def provenance(sku: str, frame: int, source_file: str, source_hash: str) -> dict[str, object]:
        return {
            "origin_kind": "project-generated-original",
            "origin_reference": source_file,
            "origin_sha256": source_hash,
            "generator": "test fixture",
            "rights": {
                "status": "owned",
                "license_reference": f"test fixture {sku}:{frame}",
                "verified_at": "2026-08-02T00:00:00Z",
            },
        }

    def product(self, number: int, profile: str = "footwear") -> dict[str, object]:
        sku = f"test-sku-{number:03d}"
        frames: list[dict[str, object]] = []
        for index, spec in enumerate(gate.FRAME_SPECS[profile], 1):
            source_file, source_digest = self.templates[index - 1]
            destination_file = (
                f"public/catalog/{sku}.webp"
                if index == 1
                else f"public/catalog/gallery/{sku}-{index}.webp"
            )
            digest = self.copy_with_marker(
                source_file,
                destination_file,
                f"{sku}:{index}",
            )
            frames.append(
                {
                    "file": destination_file,
                    "sha256": digest,
                    "role": spec.role,
                    "angle": spec.angle,
                    "composition": spec.composition,
                    **self.provenance(sku, index, source_file, source_digest),
                }
            )
        return {"sku": sku, "media_profile": profile, "frames": frames}

    def payload(self, count: int = gate.EXPECTED_SKU_COUNT) -> dict[str, object]:
        return {
            "schema_version": 1,
            "expected_sku_count": gate.EXPECTED_SKU_COUNT,
            "expected_frame_count": gate.EXPECTED_SKU_COUNT * gate.EXPECTED_FRAMES_PER_SKU,
            "canvas": list(gate.CANVAS_SIZE),
            "background_rgb": list(gate.BACKGROUND),
            "products": [self.product(index) for index in range(count)],
        }

    def manifest(self, payload: dict[str, object]) -> Path:
        path = self.root / "catalog-media" / "unified-catalog-media.json"
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def verify(self, payload: dict[str, object]) -> None:
        manifest = self.manifest(payload)
        products = payload.get("products", [])
        source_manifest = self.root / "public" / "catalog" / "sources.json"
        source_manifest.write_text(
            json.dumps({"items": [{"slug": product["sku"]} for product in products]}),
            encoding="utf-8",
        )
        review_path = self.root / "catalog-media" / "unified-catalog-media-review.json"
        review_path.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "status": "approved",
                    "reviewer_type": "agent-assisted-manual",
                    "reviewed_at": "2026-08-02T00:00:00Z",
                    "reviewed_frame_count": 500,
                    "manifest_sha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
                    "checks": ["complete subject", "safe margins", "angle order", "consistent background"],
                }
            ),
            encoding="utf-8",
        )
        gate.verify_manifest(manifest, self.root, review_path)

    def test_accepts_a_complete_uniform_100_by_5_catalog(self) -> None:
        self.verify(self.payload())

    def test_declares_the_complete_profile_contract(self) -> None:
        self.assertEqual(
            gate.MEDIA_PROFILES,
            {
                "footwear",
                "slide",
                "apparel-top",
                "apparel-outerwear",
                "apparel-shorts",
                "apparel-pants",
                "ball",
                "bag",
                "protection",
                "socks",
                "bottle",
                "recovery",
                "headwear",
                "small-accessory",
            },
        )
        self.assertTrue(all(len(sequence) == 5 for sequence in gate.FRAME_SPECS.values()))

    def test_rejects_an_incomplete_catalog(self) -> None:
        payload = self.payload(1)
        with self.assertRaisesRegex(gate.MediaQaError, r"exactly 100 products"):
            self.verify(payload)

    def test_detects_an_unsafe_inset(self) -> None:
        payload = self.payload(1)
        unsafe_file, unsafe_hash = self.write_image(
            "unsafe.png",
            (80, 312, 1168, 888),
            color=(120, 80, 40),
        )
        frame = payload["products"][0]["frames"][0]  # type: ignore[index]
        frame["file"] = unsafe_file
        frame["sha256"] = unsafe_hash
        with self.assertRaisesRegex(gate.MediaQaError, r"safe inset X requires at least 160px"):
            self.verify(payload)

    def test_detects_inconsistent_scale_in_a_profile_frame_cohort(self) -> None:
        payload = self.payload(2)
        spec = gate.FRAME_SPECS["footwear"][0]
        scale_file, scale_hash = self.write_image(
            "cohort-scale.png",
            self.centered_bbox(spec, scale=0.82),
            color=(140, 90, 45),
        )
        frame = payload["products"][1]["frames"][0]  # type: ignore[index]
        frame["file"] = scale_file
        frame["sha256"] = scale_hash
        with self.assertRaisesRegex(gate.MediaQaError, r"footwear frame 1 side/single: cohort scale spread"):
            self.verify(payload)

    def test_detects_duplicate_path_and_hash_inside_a_sku(self) -> None:
        payload = self.payload(1)
        frames = payload["products"][0]["frames"]  # type: ignore[index]
        frames[1]["file"] = frames[0]["file"]
        frames[1]["sha256"] = frames[0]["sha256"]
        with self.assertRaisesRegex(gate.MediaQaError, r"duplicate active file[\s\S]*duplicate active hash"):
            self.verify(payload)

    def test_detects_wrong_profile_frame_order(self) -> None:
        payload = self.payload(1)
        frame = payload["products"][0]["frames"][3]  # type: ignore[index]
        frame["angle"] = "side"
        with self.assertRaisesRegex(gate.MediaQaError, r"frame 4: expected role/angle/composition"):
            self.verify(payload)

    def test_detects_missing_provenance_and_rights(self) -> None:
        payload = self.payload(1)
        frame = payload["products"][0]["frames"][0]  # type: ignore[index]
        del frame["origin_reference"]
        del frame["rights"]
        with self.assertRaisesRegex(
            gate.MediaQaError,
            r"origin_reference must be an existing root-relative file[\s\S]*rights metadata is required",
        ):
            self.verify(payload)


if __name__ == "__main__":
    unittest.main()
