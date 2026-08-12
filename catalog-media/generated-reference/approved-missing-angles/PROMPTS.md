# Approved missing-angle generation record

Generated with the built-in `gpt-image-2` workflow on 2026-08-01. Every
generation used the existing Open Design stage, hover and gallery frames for the
same product as strict identity references.

Common prompt contract:

- photorealistic ecommerce product packshot;
- exact referenced SKU, colourway, materials, panels and visible marks;
- footwear frame contract: single side toe-left, pair three-quarter, single
  opposite side toe-right, pair straight rear, pair straight outsole;
- complete product, generous padding, no crop, no mirror, no redesign;
- flat chroma-key background without gradient, floor, shadow, text or watermark;
- generated references must never be labelled as Poizon or brand originals.

Generated source files in this directory cover the missing opposite-side, rear
and sole views for the eight featured footwear SKUs. Filename suffix
`-chroma.png` is the immutable generation result; public derivatives are built
by `scripts/build_approved_storefront_media.py`.

The `nike-sabrina-3-rear-chroma.png` source replaces the cropped rear export.
It was regenerated from all five exact Sabrina 3 colourway references with the
same contract, requiring both complete shoes and generous margin on every edge.
