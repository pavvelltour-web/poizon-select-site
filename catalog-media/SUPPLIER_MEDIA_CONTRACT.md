# Supplier catalogue media integration

The current manifest inventories 176 supplier footwear identities, with no
approved local output frames yet. The remaining 24 active footwear cards use
the separate legacy catalogue media path. The source-selection plan, raw image
candidates and final output approval are separate records.

`src/landing/supplier-catalog-media.ts` exports `getSupplierCatalogMedia`.
Call it with the authoritative `slug`, `productRef` and original `images`.
It returns local media only when the exact slug and product reference match,
all five ordered views exist, every visual review is approved, and no angle is
missing. Otherwise it returns the supplied original images unchanged. The
storefront adapter remains responsible for applying this result to cards and
detail galleries; this foundation does not change the adapter or pricing.

Accepted output URLs are `/catalog/supplier/<slug>-<position>.webp`, positions
1 through 5. Files must be 1600x1200 WebP without appended metadata or animation.
Every active file is recorded once with dimensions, byte size, SHA-256,
truthful provenance and output-hash-bound visual approval. Extra public files,
stale approvals, borrowed supplier URLs and duplicate images fail verification.

Supplier sources record exact URL, project-relative intake path and input hash.
Official sources additionally identify their publisher, product page and actual
reuse evidence. Generated references identify `built-in image_gen`, a UTC time
with whole seconds, LF-normalized prompt hash/path, and exact product reference
images with URL/path/hash chains. Do not label generated frames as official
photographs. Composition references from another model are kept separately from
the identity reference list. Native generation sidecars are working evidence;
they are not automatically approved final manifest entries.

`npm run verify:assets` checks integrity and explicitly reports incomplete
coverage. `npm run verify:media-supplier` requires every supplier gallery to be
complete and reviewed and is included in `verify:release`. A normal development
build passing does not mean the media standard or release gate has passed.

For independent catalogue coverage verification, run the supplier verifier with
`--catalog-metadata <absolute-path-to-current-supplier-metadata.json>`; it checks
the footwear slug/reference inventory and supplier source URL membership.

`scripts/verify_trainer_frame.py` measures canvas, background, clear margins,
centering and scale without modifying image files. It does not verify shoe
identity, left/right anatomy or camera angle; those need individual visual QA.
The exact composition contract is in `TRAINER_STANDARD_20260908.md`.
