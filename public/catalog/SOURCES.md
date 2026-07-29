# Catalog image provenance

All 100 catalog root images and 400 gallery images are local studio-style visual references. They are
normalized metadata-free WebP files at 1200×900; the browser does not contact
third-party image hosts.

- All visuals use the same cold-studio product-reference direction rendered
  by `scripts/generate_catalog_art.py` and normalized locally.

They are product-card visuals for the storefront, not proof of an exact colour,
material, SKU, size, availability or price match. Brand and model names identify
the target the manager should verify with SKU, tags, packaging and available
seller data before payment.

`sources.json` records the generation method, rights record, file size,
dimensions and SHA-256 hash for each file. Maintainers can rebuild that manifest
with:

```bash
uv run python scripts/build_catalog_manifest.py
```

Weak reference assets are tracked in `catalog-media/regeneration-queue.json`.
Run `npm run media:prompts` to export GPT Image 2.0+ regeneration prompts, then
replace accepted outputs and rebuild this manifest.
