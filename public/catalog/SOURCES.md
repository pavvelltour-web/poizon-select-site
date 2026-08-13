# Catalog image provenance

All 100 catalog root images and 400 gallery images are local studio-style visual references. They are
normalized metadata-free WebP files at 1600×1200; the browser does not contact
third-party image hosts.

- All visuals use the same cold-studio product-reference direction rendered
  by `scripts/generate_catalog_art.py` and normalized locally.

They are product-card visuals for the storefront, not proof of an exact colour,
material, SKU, size, availability or price match. Brand and model names identify
the search target; ordering is enabled only for a server-published SKU, size,
availability and price.

`sources.json` records the generation method, rights record, file size,
dimensions and SHA-256 hash for each file. Maintainers can rebuild that manifest
with:

```bash
uv run python scripts/build_catalog_manifest.py
```

Weak reference assets are tracked in `catalog-media/regeneration-queue.json`.
Run `npm run media:prompts` to export GPT Image 2.0+ regeneration prompts, then
replace accepted outputs and rebuild this manifest.

Future official Poizon/Dewu or supplier originals must first pass the offline,
non-destructive intake described in `catalog-media/README.md`. The intake records
the direct source URL, product URL, SPU/SKU, observation time, rights evidence,
source and output hashes, media role, angle, product type, orientation and manual
QA. It does not publish, crop, mirror or overwrite catalog files.
