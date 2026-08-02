# Unified Catalog Media Manifest

`unified-catalog-media.json` is the release gate manifest for the active
catalog gallery. It is independent from `approved-storefront-media.json`.

The root object must contain:

```json
{
  "schema_version": 1,
  "expected_sku_count": 100,
  "expected_frame_count": 500,
  "canvas": [1600, 1200],
  "background_rgb": [242, 243, 243],
  "products": []
}
```

Each product needs a unique `sku` or canonical catalog `slug`, one
`media_profile`, and exactly five active frames. Supported profiles are:

```
footwear, slide, apparel-top, apparel-outerwear, apparel-shorts,
apparel-pants, ball, bag, protection, socks, bottle, recovery, headwear,
small-accessory
```

Frame order is defined once by `PROFILE_SPECS` in
`scripts/build_unified_catalog_media.py` and imported by the verifier. Every
frame has this shape:

```json
{
  "file": "public/catalog/example-01.webp",
  "sha256": "lowercase-64-character-sha256",
  "role": "primary",
  "angle": "side",
  "composition": "single",
  "origin_kind": "project-generated-original",
  "origin_reference": "scripts/generate_catalog_art.py",
  "origin_sha256": "lowercase-64-character-sha256",
  "generator": "scripts/generate_catalog_art.py",
  "rights": {
    "status": "owned",
    "license_reference": "KICKSBASE project-generated catalog media: example:1",
    "verified_at": "2026-08-02T00:00:00Z"
  }
}
```

All 500 `file` and `origin_reference` values are resolved relative to the
project root. The origin may be a source reference or the reproducible
generator, but it must never be silently presented as official provider media.

`unified-catalog-media-review.json` is deliberately separate. It binds a
manual visual review to the exact SHA-256 of the generated manifest. Rebuilding
the catalog invalidates that approval until the new pixels have been reviewed.

The gate compares the SKU set with `public/catalog/sources.json`, requires the
exact storefront path for every frame, and rejects non-uniform backgrounds,
wrong canvas dimensions, unsafe margins, off-center products, inconsistent
same-profile scale, global duplicate paths or hashes, incomplete provenance,
missing rights metadata, or a stale visual review record.

Run it with:

```powershell
python scripts/verify_unified_catalog_media.py --manifest catalog-media/unified-catalog-media.json --review catalog-media/unified-catalog-media-review.json --project-root .
```
