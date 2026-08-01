from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

import official_media_pipeline as pipeline


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class OfficialMediaPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.sources = self.root / "sources"
        self.sources.mkdir()
        self.source = self.sources / "shoe.png"
        image = Image.new("RGB", (400, 200), "white")
        for x in range(0, 24):
            for y in range(0, 200):
                image.putpixel((x, y), (240, 0, 0))
        for x in range(376, 400):
            for y in range(0, 200):
                image.putpixel((x, y), (0, 0, 240))
        image.save(self.source, "PNG")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def item(self, *, role: str = "primary", angle: str = "side", orientation: str = "toe-right"):
        return {
            "slug": "nike-example-shoe",
            "product_type": "footwear",
            "identifiers": {"spu": "SPU-123", "sku": "SKU-456"},
            "source": {
                "provider": "dewu-poizon-official-export",
                "asset_url": "https://media.partner.example/shoe.png",
                "product_url": "https://partner.example/product/SPU-123",
                "observed_at": "2026-08-01T09:00:00+03:00",
                "local_file": "shoe.png",
                "sha256": file_hash(self.source),
            },
            "rights": {
                "status": "supplier-api",
                "evidence_reference": "supplier-contract-2026-01",
                "verified_by": "catalog-reviewer",
                "verified_at": "2026-08-01T09:05:00+03:00",
                "permitted_uses": ["storefront"],
            },
            "media": {
                "role": role,
                "angle": angle,
                "orientation": orientation,
                "mime_type": "image/png",
            },
            "qa": {
                "status": "approved",
                "product_match_verified": True,
                "source_not_cropped": True,
                "logos_and_text_readable": True,
                "orientation_verified": True,
                "subject_scale_verified": True,
                "reviewer": "catalog-reviewer",
                "reviewed_at": "2026-08-01T09:10:00+03:00",
                "notes": "Official source and orientation reviewed against the SKU.",
            },
        }

    def write_manifest(self, items: list[dict]) -> Path:
        path = self.root / "manifest.json"
        path.write_text(
            json.dumps({"schema_version": 1, "items": items}),
            encoding="utf-8",
        )
        return path

    def test_normalization_preserves_entire_source_and_left_right_order(self) -> None:
        with Image.open(self.source) as source:
            normalized = pipeline.normalize_without_crop_or_mirror(source.convert("RGBA"))

        self.assertEqual(normalized.size, pipeline.CANVAS_SIZE)
        bbox = pipeline.content_bbox(normalized)
        self.assertIsNotNone(bbox)
        assert bbox is not None
        left, top, right, bottom = bbox
        self.assertEqual((right - left, bottom - top), (400, 200))
        self.assertEqual(normalized.getpixel((left, top + 50)), (240, 0, 0))
        self.assertEqual(normalized.getpixel((right - 1, top + 50)), (0, 0, 240))

    def test_primary_footwear_must_be_side_view_with_toe_right(self) -> None:
        item = self.item(orientation="toe-left")
        manifest = self.write_manifest([item])
        with self.assertRaisesRegex(pipeline.PipelineError, "do not mirror"):
            pipeline.load_and_validate_manifest(manifest, self.sources)

    def test_schema_rejects_unknown_fields_at_every_level(self) -> None:
        cases = []
        root_item = self.item()
        cases.append({"schema_version": 1, "items": [root_item], "unexpected": True})
        item_extra = self.item()
        item_extra["unexpected"] = True
        cases.append({"schema_version": 1, "items": [item_extra]})
        qa_extra = self.item()
        qa_extra["qa"]["unexpected"] = True
        cases.append({"schema_version": 1, "items": [qa_extra]})

        for index, payload in enumerate(cases):
            with self.subTest(index=index):
                path = self.root / f"manifest-extra-{index}.json"
                path.write_text(json.dumps(payload), encoding="utf-8")
                with self.assertRaisesRegex(pipeline.PipelineError, "unsupported field"):
                    pipeline.load_and_validate_manifest(path, self.sources)

    def test_schema_requires_qa_notes(self) -> None:
        item = self.item()
        item["qa"].pop("notes")
        manifest = self.write_manifest([item])
        with self.assertRaisesRegex(pipeline.PipelineError, "qa.notes"):
            pipeline.load_and_validate_manifest(manifest, self.sources)

    def test_committed_schema_example_matches_runtime_contract(self) -> None:
        example = pipeline.ROOT / "catalog-media" / "official-media.example.json"
        validated = pipeline.load_and_validate_manifest(example, self.sources)
        self.assertEqual(validated[0]["media"]["orientation"], "toe-right")

    def test_exact_source_duplicates_are_blocked_before_staging(self) -> None:
        first = self.item()
        second = self.item(role="gallery", angle="rear", orientation="rear-facing")
        manifest = self.write_manifest([first, second])
        with self.assertRaisesRegex(pipeline.PipelineError, "exact source duplicate"):
            pipeline.load_and_validate_manifest(manifest, self.sources)

    def test_unapproved_or_unlicensed_source_is_blocked(self) -> None:
        item = self.item()
        item["rights"]["status"] = "unknown"
        manifest = self.write_manifest([item])
        with self.assertRaisesRegex(pipeline.PipelineError, "rights.status"):
            pipeline.load_and_validate_manifest(manifest, self.sources)

    def test_hash_mismatch_is_blocked_before_decode(self) -> None:
        item = self.item()
        item["source"]["sha256"] = "f" * 64
        manifest = self.write_manifest([item])
        validated = pipeline.load_and_validate_manifest(manifest, self.sources)
        with self.assertRaisesRegex(pipeline.PipelineError, "SHA-256 mismatch"):
            pipeline.open_verified_source(validated[0])

    def test_mirrored_exif_orientation_is_rejected(self) -> None:
        mirrored = self.sources / "mirrored.jpg"
        image = Image.new("RGB", (120, 80), "white")
        exif = Image.Exif()
        exif[274] = 2
        image.save(mirrored, "JPEG", exif=exif)
        item = self.item()
        item["source"]["local_file"] = mirrored.name
        item["source"]["sha256"] = file_hash(mirrored)
        item["media"]["mime_type"] = "image/jpeg"
        manifest = self.write_manifest([item])
        validated = pipeline.load_and_validate_manifest(manifest, self.sources)
        with self.assertRaisesRegex(pipeline.PipelineError, "mirrored EXIF"):
            pipeline.open_verified_source(validated[0])

    def test_stage_writes_only_to_staging_and_records_transformation(self) -> None:
        manifest = self.write_manifest([self.item()])
        output = self.root / "staging"
        empty_catalog = self.root / "public" / "catalog"
        (empty_catalog / "gallery").mkdir(parents=True)

        with mock.patch.object(pipeline, "PUBLIC_CATALOG", empty_catalog):
            result = pipeline.stage(manifest, self.sources, output)

        batch = Path(result["batch"])
        self.assertTrue((batch / "nike-example-shoe" / "primary-side.webp").is_file())
        staged_manifest = json.loads((batch / "staged-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(staged_manifest["publication_status"], "staged-not-published")
        self.assertIn("no crop; no mirror", staged_manifest["items"][0]["transform"])
        self.assertEqual(list(empty_catalog.glob("*.webp")), [])

    def test_stage_rejects_any_output_under_public(self) -> None:
        manifest = self.write_manifest([self.item()])
        with self.assertRaisesRegex(pipeline.PipelineError, "must not be inside public"):
            pipeline.stage(manifest, self.sources, pipeline.ROOT / "public" / "catalog" / "unsafe")

    def test_audit_reports_primary_gallery_exact_duplicate(self) -> None:
        catalog = self.root / "public" / "catalog"
        gallery = catalog / "gallery"
        gallery.mkdir(parents=True)
        primary = catalog / "nike-example-shoe.webp"
        duplicate = gallery / "nike-example-shoe-2.webp"
        primary.write_bytes(self.source.read_bytes())
        duplicate.write_bytes(self.source.read_bytes())
        (catalog / "sources.json").write_text(
            json.dumps(
                {
                    "items": [
                        {
                            "slug": "nike-example-shoe",
                            "provenance": {"official_product_photo": False},
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )

        with mock.patch.object(pipeline, "PUBLIC_CATALOG", catalog):
            audit = pipeline.audit_current_catalog()

        self.assertEqual(audit["summary"]["file_count"], 2)
        self.assertEqual(audit["summary"]["exact_duplicate_group_count"], 1)
        self.assertEqual(audit["summary"]["primary_gallery_duplicate_group_count"], 1)
        self.assertEqual(audit["summary"]["confirmed_official_source_count"], 0)


if __name__ == "__main__":
    unittest.main()
