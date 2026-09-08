# Trainer media standard, 8 September 2026

Status: IN_PROGRESS. This document records the requested standard, not completed
catalogue coverage or a public release approval.

## Reference and scope

The owner selected the existing Nike LeBron NXXT Genisus card as the visual
reference. Its five active files were individually inspected and measured in
the media worktree. That historical reference is labelled Monopoly Persian
Violet, IB1272-501. It defines composition only: the current priced record says
EP / Solid Outsole and has different sources. Exact current SKU and colourway
evidence decides product identity; reference styling must not replace it.

| Position | View | Composition | Subject target |
| --- | --- | --- | --- |
| 1 | Lateral side, toe left | One shoe | 1184 px wide |
| 2 | Medial side, toe right | One shoe | 1120 px wide |
| 3 | Front three-quarter, toes toward lower left | Overlapping pair | 1184 px wide |
| 4 | Straight rear | Pair | 760 px high |
| 5 | Outsole, heel up and toe down | One shoe, vertical | 840 px high |

All frames use a 1600 x 1200 canvas, neutral cold-grey RGB(242,243,243), uniform
scaling and centred placement. Preserve at least 8% clear margins, all visible
product edges, authentic proportions, colour, materials, panel construction,
logos and lettering. Do not mirror shoes. Side and front views are constrained
to 760 px high; rear views to 1184 px wide. The LeBron outsole has a clear
179 px top margin; it is not cropped and does not need replacement.

The verified current baseline is storefront commit
`ac97505dc28992e2af907810e9c2f3792fc126ce`. The production response saved as
`production-actual-catalog.json` has 200 cards: 191 footwear, 5 apparel and
4 accessories. Nine verified colourways extend the target to 209 total cards,
including 200 footwear: 176 supplier-metadata cards and 24 active legacy cards.
The nine identities are bound to the final `added-media-metadata.json` SHA-256
`1849a685b8325968b2b43c4ca70185b670202f8128b7a1da91072b03c94dd5c8`.
All 200 footwear cards are in scope. Use all available source positions,
including those beyond position five. Current intake contains 1145 supplier
originals (1089 baseline and 56 new-colourway sources), all visually reviewed.
Selected source candidates are not completed or approved normalized outputs.

The historical metadata supplied at task start described 90 additions and
does not represent the current catalogue. Downloaded files may be reused only
after exact current source-URL and hash matching. A historical 295-frame
legacy audit is reduced to the current 24-card intersection before repairs.
The LeBron primary SHA-256 is unchanged on the verified baseline:
`f6a295c362f9e2f8a49f7fd4adc335e3698d83ad673a36ea56952281f42c265f`.

## Source and review rules

Prefer an existing exact model and colourway source in the requested view. The
owner authorizes online source selection and built-in image generation for
missing views; earlier editorial-only guidance does not prohibit this task.
Generated references must retain that classification. A public CDN URL proves
where a file was downloaded, not a manufacturer photograph or a reuse licence.
Keep exact download URLs, timestamps, immutable input hashes and output hashes.

Review every selected output and record view, composition, colour identity,
uncropped boundaries, scale, background and branding. Automated file and pixel
checks supplement the visual review. Explicitly record missing views and
unreviewed output; never turn a partial inventory into a complete-status claim.

## Impact map

- Entry: supplier catalogue merge and existing catalogue media resolution.
- Graphify scope: `SupplierCatalogProduct`, `supplier-catalog.ts`, media/gallery
  manifest nodes, catalogue assets verification.
- Owned source: new `src/landing/supplier-catalog-media.ts`; media-only scripts,
  tests and `catalog-media/`; assets under `public/catalog/`.
- Adapter: coordinated with the independent storefront UI task.
- Database and backend: no changes.
- External activity: public image downloads and built-in `image_gen` only.
- Verification: complete inventory, per-frame visual review, dimensions,
  hashes, safe margins, provenance and relevant frontend tests/build.
- Deployment: none in this task. No restarts of port 4173, backend or CRM.

Private contact sheets and source audit evidence are stored under the parent
project's `.codex-artifacts/catalog-refresh-20260908/` directory.
