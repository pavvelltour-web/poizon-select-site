from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.portable_hash import BINARY_HASH_MODE, TEXT_LF_HASH_MODE, hash_mode_for_path, sha256_file


class PortableHashTests(unittest.TestCase):
    def test_text_hash_normalizes_crlf_and_lf(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / "origin.py"
            path.write_bytes(b"alpha\r\nbeta\r\n")
            crlf_hash = sha256_file(path, mode=TEXT_LF_HASH_MODE)
            binary_crlf_hash = sha256_file(path, mode=BINARY_HASH_MODE)
            path.write_bytes(b"alpha\nbeta\n")
            self.assertEqual(crlf_hash, sha256_file(path, mode=TEXT_LF_HASH_MODE))
            self.assertNotEqual(binary_crlf_hash, sha256_file(path, mode=BINARY_HASH_MODE))

    def test_binary_hash_preserves_byte_differences(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / "origin.webp"
            path.write_bytes(b"RIFF\x00\r\nWEBP")
            crlf_hash = sha256_file(path)
            path.write_bytes(b"RIFF\x00\nWEBP")
            self.assertNotEqual(crlf_hash, sha256_file(path))
            self.assertEqual(hash_mode_for_path(path), BINARY_HASH_MODE)

    def test_known_text_suffix_uses_text_lf_mode(self) -> None:
        self.assertEqual(hash_mode_for_path(Path("manifest.json")), TEXT_LF_HASH_MODE)
        self.assertEqual(hash_mode_for_path(Path("builder.py")), TEXT_LF_HASH_MODE)


if __name__ == "__main__":
    unittest.main()
