# Product media operations

## Official Poizon/Dewu or supplier originals

`scripts/official_media_pipeline.py` is the only safe path for future official
product media. It is offline and non-destructive by design: it does not download
from arbitrary URLs and it has no command that writes to `public/catalog`.

Before intake, obtain the original file through an approved official Poizon/Dewu
merchant integration or a supplier export whose contract explicitly permits
storefront use. Record the product URL, direct asset URL, SPU and/or SKU, access
time, source SHA-256 and the rights evidence in a batch manifest. Use
`official-media.schema.json`; copy `official-media.example.json` outside the
repository and replace every placeholder with real evidence.

Signal Studio acceptance rules:

- footwear primary: clean side view, toe points right in the source, matching the validated intake contract;
- apparel primary: front view at a consistent source scale;
- 8% minimum composition safe area on the normalized 4:3 canvas;
- whole source remains visible; no crop and no background-removal crop;
- no horizontal mirror because it reverses logos and printed text;
- an exact hash may occupy only one media slot in a batch;
- human review must confirm product match, uncropped source, legible marks,
  orientation and consistent subject scale before staging.

The script only scales uniformly and pads the complete source onto a white
1600x1200 canvas. It rejects unverified rights, missing identifiers, hash
mismatches, duplicate source files, unsafe paths, wrong primary orientation and
mirrored EXIF orientation.

```powershell
# Audit the current 500 files. Read-only except for the JSON report.
npm run media:official:audit

# Validate an intake batch and its local files without creating derivatives.
npm run media:official:validate -- `
  --manifest C:\secure-intake\batch.json `
  --source-root C:\secure-intake\originals

# Create a review-only batch under catalog-media/staging.
npm run media:official:stage -- `
  --manifest C:\secure-intake\batch.json `
  --source-root C:\secure-intake\originals
```

Review `staged-manifest.json` and the images manually. Promotion into the public
catalog is a separate release decision and is intentionally not automated. The
existing 500 images must not be replaced until official provenance and reuse
rights are confirmed.

## Generated reference regeneration (legacy)

The files below describe the older generated-reference workflow. Generated
packshots are not Poizon originals and must never be labelled as official
product photography.

### Workflow

1. Review `regeneration-queue.json`.
   - Each item must exist in `src/catalog/catalog.ts`.
   - Each item must contain a concrete visual weakness, research query and 4-7
     requested views.
2. Run:

   ```bash
   npm run media:prompts
   npm run verify:media-pipeline
   ```

3. For each queued product, clean-parse reliable public product pages before
   image generation. Confirm target silhouette, material, panel geometry, visible
   branding, color family and construction cues.
4. Generate the requested views with GPT Image 2.0 or newer on a pure white
   studio background.
5. Import accepted first 5 views into:
   - `public/catalog/{slug}.webp`
   - `public/catalog/gallery/{slug}-2.webp`
   - `public/catalog/gallery/{slug}-3.webp`
   - `public/catalog/gallery/{slug}-4.webp`
   - `public/catalog/gallery/{slug}-5.webp`

   Extra views remain review assets under `catalog-media/review-renders/`.
6. Rebuild and verify catalog provenance:

   ```bash
   uv run python scripts/build_catalog_manifest.py
   npm run check
   ```

### Acceptance

- Product only, no props, no model, no watermark, no UI chrome.
- Pure white studio background with realistic contact shadow.
- No vector/illustration look, detached fragments, distorted panels, fake labels
  or cropped product edges.
- A generated asset is only a visual reference. A catalog reviewer must verify
  the exact SKU, color and permitted use before it can enter a public release.
