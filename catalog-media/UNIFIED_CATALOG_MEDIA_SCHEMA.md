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
  "origin_hash_mode": "text-lf",
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
generator. A reviewed Poizon source is explicitly recorded as
`origin_kind: "poizon-original"` and retains its immutable local source file,
product-page evidence and rights record in the intake manifest.
`origin_hash_mode` is `text-lf` for known text sources and normalizes only
CRLF/CR line endings to LF before hashing; it is `binary` for image and other
binary origins and always hashes exact bytes.

`poizon-catalog-media-intake.json` is a separate source-review record. An
entry is usable only when its QA status is `approved` and it declares
`activation.source_positions`, an explicit map from active positions to the
reviewed Poizon source positions. Position `2` remains owner-preserved by
default. It may be activated only for the small code-reviewed exception list
where manual comparison proved that the legacy frame shows the wrong shoe,
another colorway, a duplicate composition, or a cropped subject. An intake may
activate only a subset of positions when a Poizon page does not contain a
canonical rear or sole view; unlisted active frames stay on their existing
reviewed source.

`unified-catalog-media-review.json` is deliberately separate. It must declare
`"manifest_sha256_mode": "text-lf"` and binds a manual visual review to the
line-ending-portable SHA-256 of the generated manifest. Rebuilding the catalog
invalidates that approval until the new pixels have been reviewed.

The gate compares the SKU set with `public/catalog/sources.json`, requires the
exact storefront path for every frame, and rejects non-uniform backgrounds,
wrong canvas dimensions, unsafe margins, off-center products, inconsistent
same-profile scale, global duplicate paths or hashes, incomplete provenance,
missing rights metadata, or a stale visual review record.

Run it with:

```powershell
python scripts/verify_unified_catalog_media.py --manifest catalog-media/unified-catalog-media.json --review catalog-media/unified-catalog-media-review.json --project-root .
```
