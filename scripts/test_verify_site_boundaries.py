"""Regression tests for the standalone site's public release boundary."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SITE_ROOT = Path(__file__).resolve().parents[1]


class SiteBoundaryVerifierTests(unittest.TestCase):
    def make_fixture(self) -> Path:
        temporary_root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        fixture = temporary_root / "site"
        fixture.mkdir()
        for relative in (
            ".dockerignore",
            ".env.example",
            "Dockerfile",
            "index.html",
            "nginx.conf",
            "package.json",
            "vite.config.ts",
        ):
            shutil.copy2(SITE_ROOT / relative, fixture / relative)
        shutil.copytree(SITE_ROOT / "src", fixture / "src")
        shutil.copytree(SITE_ROOT / "public", fixture / "public")
        (fixture / "scripts").mkdir()
        shutil.copy2(
            SITE_ROOT / "scripts" / "verify_site_boundaries.mjs",
            fixture / "scripts" / "verify_site_boundaries.mjs",
        )
        return fixture

    def run_verifier(self, fixture: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["node", "scripts/verify_site_boundaries.mjs"],
            cwd=fixture,
            capture_output=True,
            check=False,
            text=True,
            timeout=20,
        )

    def test_rejects_secret_material_inside_an_allowed_public_file(self) -> None:
        fixture = self.make_fixture()
        notice = fixture / "public" / "THIRD_PARTY_NOTICES.md"
        notice.write_text(
            notice.read_text(encoding="utf-8") + "\nBOT_TOKEN=123456789:" + "a" * 32 + "\n",
            encoding="utf-8",
        )

        result = self.run_verifier(fixture)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("contains secret-like material", result.stderr)

    def test_rejects_an_unexpected_public_release_artifact(self) -> None:
        fixture = self.make_fixture()
        (fixture / "public" / "customer-export.csv").write_text(
            "telegram_id,name\n123,Test\n",
            encoding="utf-8",
        )

        result = self.run_verifier(fixture)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unexpected release artifact", result.stderr)

    def test_rejects_an_unexpected_catalog_export(self) -> None:
        fixture = self.make_fixture()
        (fixture / "public" / "catalog" / "customer-export.json").write_text(
            '{"telegram_id": 123, "name": "Test"}\n',
            encoding="utf-8",
        )

        result = self.run_verifier(fixture)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unexpected release artifact", result.stderr)


if __name__ == "__main__":
    unittest.main()
