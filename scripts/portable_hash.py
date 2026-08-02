"""Deterministic content hashes across Windows and Unix checkouts."""

from __future__ import annotations

import hashlib
from pathlib import Path


TEXT_LF_HASH_MODE = "text-lf"
BINARY_HASH_MODE = "binary"
HASH_MODES = frozenset({TEXT_LF_HASH_MODE, BINARY_HASH_MODE})
TEXT_SUFFIXES = frozenset({
    ".css", ".csv", ".html", ".json", ".js", ".jsx", ".md", ".mjs",
    ".py", ".svg", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml",
})


def hash_mode_for_path(path: Path) -> str:
    return TEXT_LF_HASH_MODE if path.suffix.lower() in TEXT_SUFFIXES else BINARY_HASH_MODE


def sha256_file(path: Path, *, mode: str = BINARY_HASH_MODE) -> str:
    if mode not in HASH_MODES:
        raise ValueError(f"Unsupported hash mode: {mode}")
    payload = path.read_bytes()
    if mode == TEXT_LF_HASH_MODE:
        payload = payload.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    return hashlib.sha256(payload).hexdigest()
