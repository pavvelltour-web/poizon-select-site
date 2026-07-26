# Catalog image provenance

All 60 catalog images are local project-generated visual references. They are
normalized metadata-free WebP files at 1200×900; the browser does not contact
third-party image hosts.

- All 60 visuals use the same cold-studio product-reference direction rendered
  by `scripts/generate_catalog_art.py` and normalized locally.

They are not official manufacturer photos and must not be presented as proof of
an exact colour, material, SKU, size, availability or price match. Brand and
model names identify the target the buyer should search for and verify.

`sources.json` records the generation method, rights record, file size,
dimensions and SHA-256 hash for each file. Maintainers can rebuild that manifest
with:

```bash
uv run python scripts/build_catalog_manifest.py
```
