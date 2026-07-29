# Product Media Regeneration

This folder is the committed control plane for replacing weak generated catalog
references with stricter GPT Image 2.0+ ecommerce packshots.

## Workflow

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

## Acceptance

- Product only, no props, no model, no watermark, no UI chrome.
- Pure white studio background with realistic contact shadow.
- No vector/illustration look, detached fragments, distorted panels, fake labels
  or cropped product edges.
- The generated asset is still a visual reference: manager verification of exact
  SKU, color, size, tags, packaging, seller and availability remains mandatory.
