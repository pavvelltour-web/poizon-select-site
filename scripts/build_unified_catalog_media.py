#!/usr/bin/env python3
"""Reframe every active catalog image on one profile-aware studio contract.

The builder never mirrors or stretches a product. It removes only the
border-connected neutral studio backdrop, scales the complete visible subject
uniformly and centers it on the KICKSBASE 4:3 product canvas.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from PIL import Image, ImageChops, ImageFilter, ImageOps

try:
    from scripts.import_ai_contact_sheet import border_connected_background_alpha
    from scripts.portable_hash import hash_mode_for_path, sha256_file
except ModuleNotFoundError:  # Direct execution: python scripts/build_*.py
    from import_ai_contact_sheet import border_connected_background_alpha
    from portable_hash import hash_mode_for_path, sha256_file


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "public" / "catalog"
APPROVED_PRODUCTS = ROOT / "public" / "storefront-media" / "approved" / "products"
GENERATED_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "unified-missing-angles"
FRONT_PAIR_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "unified-front-pairs"
FINAL_SIX_FOOTWEAR_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "final-six-footwear"
BATCH_FOUR_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "batch4-footwear"
BATCH_FIVE_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "batch5-footwear"
BATCH_SIX_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "batch6-footwear"
BATCH_SEVEN_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "batch7-footwear"
BATCH_EIGHT_OVERRIDES = ROOT / "catalog-media" / "generated-reference" / "batch8-footwear"
POIZON_INTAKE_MANIFEST = ROOT / "catalog-media" / "poizon-catalog-media-intake.json"
MANIFEST = ROOT / "catalog-media" / "unified-catalog-media.json"
APPROVED_MANIFEST = ROOT / "catalog-media" / "approved-storefront-media.json"
CATALOG_GENERATOR = ROOT / "scripts" / "generate_catalog_art.py"
CANVAS_SIZE = (1600, 1200)
BACKGROUND = (242, 243, 243)

APPROVED_SLUGS = {
    "anta-kai-1",
    "asics-sky-elite-ff-3",
    "li-ning-wade-808-4-ultra",
    "new-balance-two-wxy-v5",
    "nike-aone",
    "nike-free-metcon-6",
}

# The recovery batches use the card-gallery order approved for KICKSBASE.
# Keeping this opt-in prevents legacy assets from being relabelled before they
# have passed the same source and visual gate.
STRICT_FOOTWEAR_V1_SLUGS = {
    "asics-netburner-ballistic-ff-4",
    "asics-sky-elite-ff-mt-3",
    "converse-chuck-70-high-black",
    "nike-kd-18",
    "nike-sabrina-3",
    "mizuno-wave-luminous-3",
    "mizuno-wave-voltage-2",
    "mizuno-wave-momentum-elite-mid",
    "mizuno-wave-momentum-pro",
}
STRICT_SLIDE_V1_SLUGS = {
    "oofos-ooahh-slide",
}

# These cards have an explicitly reviewed KD18-style third frame. Their
# remaining four frames retain the regular footwear profile, while frame three
# is a compact, overlapping front-three-quarter pair rather than the legacy
# full-width pair treatment.
KD18_F3_FOOTWEAR_SLUGS = frozenset({
    "adidas-campus-00s-core-black",
    "adidas-crazyflight-6-mid",
    "adidas-gazelle-indoor-green",
    "adidas-handball-spezial-core-black",
    "adidas-harden-volume-9",
    "adidas-samba-og-white-black",
    "adidas-stabil-16-indoor",
    "asics-gel-1130-black-pure-silver",
    "asics-gel-kayano-14-white-midnight",
    "asics-gel-kayano-20-glacier-grey",
    "asics-gel-nyc-cream-oyster-grey",
    "asics-gel-tactic-13",
    "asics-metarise-2",
    "asics-rote-japan-lyte-ff-3",
    "asics-sky-elite-ff-3",
    "asics-upcourt-6",
    "mizuno-cyclone-speed-5",
    "mizuno-wave-lightning-z8",
    "mizuno-wave-lightning-z8-mid",
    "mizuno-wave-momentum-3",
    "new-balance-1000-black",
    "new-balance-1906r-silver-metallic",
    "new-balance-2002r-protection-pack",
    "new-balance-530-white-silver-navy",
    "new-balance-9060-rain-cloud",
    "nike-hyperace-3-se",
    "nike-zoom-hyperset-2",
    "puma-fuse-3",
    "salomon-xt-6-white-lunar-rock",
    "vans-old-skool-36-black-white",
})

# This boot was reviewed as a right-facing third-frame pair. Its taller upper
# needs a distinct height envelope without relaxing the compact KD18 framing
# used by the low-cut shoes above.
TALL_KD18_F3_FOOTWEAR_SLUGS = frozenset({"timberland-field-boot-beef-broccoli"})

# Crocs and HOKA have a wider approved first-frame silhouette than the two
# compact Nike slides. Their third frame remains the supplied direct pair.
WIDE_STRICT_SLIDE_V1_SLUGS = frozenset({
    "crocs-mellow-recovery-slide",
    "hoka-ora-recovery-slide-3",
})
KD18_STRICT_SLIDE_V1_SLUGS = frozenset({
    "nike-calm-slide",
    "nike-mind-001-slide-black",
})

SLIDES = {
    "crocs-mellow-recovery-slide",
    "hoka-ora-recovery-slide-3",
    "nike-calm-slide",
    "nike-mind-001-slide-black",
    "oofos-ooahh-slide",
}
APPAREL_OUTERWEAR = {
    "adidas-zne-track-jacket",
    "essentials-hoodie-light-oatmeal",
    "nike-therma-fit-training-hoodie",
    "north-face-1996-nuptse-black",
    "supreme-mm6-zip-hoodie-black",
}
APPAREL_SHORTS = {
    "adidas-crazyflight-shorts",
    "adidas-own-the-run-shorts",
    "nike-pro-compression-shorts",
}
APPAREL_PANTS = {"on-performance-tights"}
APPAREL_TOPS = {
    "asics-actibreeze-match-top",
    "jordan-nigel-sylvester-bike-air-jersey",
    "kith-adidas-messi-tee",
    "mizuno-volleyball-practice-tee",
    "nike-barcelona-ronaldinho-jersey",
    "nike-dri-fit-volleyball-jersey",
    "under-armour-heatgear-top",
}
BALLS = {
    "mikasa-v200w-volleyball",
    "molten-v5m4500-volleyball",
    "molten-v5m5000-flistatec",
    "wilson-evo-nxt-basketball",
}
BAGS = {
    "adidas-tiro-league-duffel",
    "nike-brasilia-training-duffel",
    "nike-hoops-elite-backpack",
}
PROTECTION = {
    "bauerfeind-sports-knee-support",
    "mcdavid-hex-elbow-pads",
    "mcdavid-hex-knee-pads",
    "mizuno-arm-sleeves",
    "mizuno-vs1-ultra-kneepad",
    "mueller-jumpers-knee-strap",
    "nike-essential-volleyball-elbow-pads",
    "nike-vapor-elite-volleyball-kneepads",
}
SOCKS = {
    "nike-everyday-cushion-crew-socks-6pk",
    "stance-icon-crew-socks",
}
BOTTLES = {
    "camelbak-podium-chill-bottle",
    "nike-hyperfuel-water-bottle",
}
RECOVERY = {
    "hyperice-vyper-go-roller",
    "nike-resistance-band-heavy",
    "rocktape-kinesiology-tape-black",
    "theraband-resistance-band-set",
    "triggerpoint-grid-foam-roller",
}
HEADWEAR = {"new-era-yankees-59fifty-black"}

# Only logical frame three is replaced for these products. Frame two stays byte-for-byte
# intact, while hover gets a complete, front three-quarter pair view.
FRONT_PAIR_OVERRIDE_SLUGS = frozenset({
    "adidas-campus-00s-core-black",
    "adidas-crazyflight-6-mid",
    "adidas-gazelle-indoor-green",
    "adidas-handball-spezial-core-black",
    "adidas-harden-volume-9",
    "adidas-samba-og-white-black",
    "adidas-stabil-16-indoor",
    "asics-gel-kayano-14-white-midnight",
    "asics-gel-kayano-20-glacier-grey",
    "asics-gel-nyc-cream-oyster-grey",
    "asics-gel-1130-black-pure-silver",
    "asics-gel-tactic-13",
    "asics-metarise-2",
    "asics-netburner-ballistic-ff-4",
    "asics-sky-elite-ff-mt-3",
    "asics-upcourt-6",
    "converse-chuck-70-high-black",
    "crocs-mellow-recovery-slide",
    "hoka-ora-recovery-slide-3",
    "jordan-luka-4",
    "mizuno-cyclone-speed-5",
    "mizuno-wave-lightning-z8",
    "mizuno-wave-lightning-z8-mid",
    "mizuno-wave-luminous-3",
    "mizuno-wave-momentum-3",
    "mizuno-wave-momentum-elite-mid",
    "mizuno-wave-momentum-pro",
    "mizuno-wave-voltage-2",
    "new-balance-1000-black",
    "new-balance-1906r-silver-metallic",
    "new-balance-2002r-protection-pack",
    "new-balance-530-white-silver-navy",
    "new-balance-9060-rain-cloud",
    "nike-air-force-1-07-white",
    "nike-air-max-95-black-anthracite",
    "nike-calm-slide",
    "nike-dunk-low-panda",
    "nike-gt-cut-academy",
    "nike-hyperace-3-se",
    "nike-ja-3",
    "nike-lebron-nxxt-genisus",
    "nike-mind-001-slide-black",
    "nike-zoom-hyperset-2",
    "nike-zoom-vomero-5-photon-dust",
    "oofos-ooahh-slide",
    "salomon-xt-6-white-lunar-rock",
    "timberland-field-boot-beef-broccoli",
    "vans-old-skool-36-black-white",
    "way-of-wade-all-city-12",
})

# These reviewed legacy alternates were proven to show the wrong shoe, a
# duplicate composition or a cropped subject. Their exact Poizon opposite-side
# sources are the only allowed exceptions to the owner-preserved frame-two rule.
POIZON_FRAME_TWO_REPLACEMENT_SLUGS = frozenset({
    "asics-sky-elite-ff-3",
    "jordan-luka-4",
    "nike-gt-cut-academy",
    "nike-ja-3",
    "nike-lebron-nxxt-genisus",
    "way-of-wade-all-city-12",
})

# Batch 2 is a reviewed direct-source replacement set. Its frame-two sources
# are explicit exceptions to the historical owner-preserved-frame-two policy.
BATCH_TWO_DIRECT_SOURCE_SLUGS = frozenset({
    "adidas-crazyflight-6-mid",
    "adidas-harden-volume-9",
    "asics-gel-tactic-13",
    "asics-metarise-2",
    "nike-hyperace-3-se",
    "nike-zoom-hyperset-2",
})

# Batch 3 binds the six remaining footwear products to their reviewed exact
# product sources. Frame two is intentionally replaced for every B3 product.
BATCH_THREE_DIRECT_SOURCE_SLUGS = frozenset({
    "adidas-stabil-16-indoor",
    "asics-rote-japan-lyte-ff-3",
    "asics-upcourt-6",
    "mizuno-cyclone-speed-5",
    "mizuno-wave-momentum-3",
    "puma-fuse-3",
})

# Batch 4 keeps the same reviewed direct-source activation contract. The
# intake name is historical: it also carries approved official supplier media.
BATCH_FOUR_DIRECT_SOURCE_SLUGS = frozenset({
    "asics-netburner-ballistic-ff-4",
    "asics-sky-elite-ff-mt-3",
    "converse-chuck-70-high-black",
    "crocs-mellow-recovery-slide",
    "hoka-ora-recovery-slide-3",
    "oofos-ooahh-slide",
})

# Batch 5 binds six additional Mizuno products to an owner-locked source
# matrix. Frame two is intentionally replaced only for these reviewed entries.
BATCH_FIVE_DIRECT_SOURCE_SLUGS = frozenset({
    "mizuno-wave-lightning-z8",
    "mizuno-wave-lightning-z8-mid",
    "mizuno-wave-luminous-3",
    "mizuno-wave-momentum-elite-mid",
    "mizuno-wave-momentum-pro",
    "mizuno-wave-voltage-2",
})

# Batch 6 replaces its active frames only with locked direct sources, except
# for the reviewed generated derivatives documented below.
BATCH_SIX_DIRECT_SOURCE_SLUGS = frozenset({
    "asics-gel-1130-black-pure-silver",
    "asics-gel-kayano-14-white-midnight",
    "nike-calm-slide",
    "nike-mind-001-slide-black",
    "nike-air-max-95-black-anthracite",
    "timberland-field-boot-beef-broccoli",
})

# Batch 7 binds six locked lifestyle products to exact official or Poizon
# sources. Salomon frame two remains a generated true opposite-side view, but
# is included here to authorize its reviewed frame-two replacement.
BATCH_SEVEN_DIRECT_SOURCE_SLUGS = frozenset({
    "asics-gel-nyc-cream-oyster-grey",
    "salomon-xt-6-white-lunar-rock",
    "new-balance-9060-rain-cloud",
    "new-balance-2002r-protection-pack",
    "new-balance-1906r-silver-metallic",
    "nike-zoom-vomero-5-photon-dust",
})

BATCH_EIGHT_DIRECT_SOURCE_SLUGS = frozenset({
    "new-balance-530-white-silver-navy",
    "nike-air-force-1-07-white",
    "nike-dunk-low-panda",
    "adidas-samba-og-white-black",
    "adidas-gazelle-indoor-green",
    "adidas-campus-00s-core-black",
})

# These two exact Nike sole PNGs include a supplier ground shadow below the
# outsole. Preserve their official landscape orientation so that shadow never
# becomes a vertical bar; no source pixels are removed or synthesized.
BATCH_EIGHT_NIKE_SOLE_LANDSCAPE_NORMALIZATION = {
    ROOT / "catalog-media/intake/official-brand/nike/nike-air-force-1-07-white-cw2288-111/02.png": {
        "sha256": "a8e3e3c62f9025e0c029f97fe4871dcb3d33e510fd4a5a7b7f480df1dc9c2a16",
    },
    ROOT / "catalog-media/intake/official-brand/nike/nike-dunk-low-panda-dd1391-100/03.png": {
        "sha256": "6c84197604e325ff29993ca4ae09a67f5ee6dc298b73a6be4a8a125964dccca4",
    },
}

# The exact adidas F5 JPEGs place the outsole on a low-contrast studio shadow.
# A path/hash-scoped threshold removes only that shadow; the small Samba
# rotation then makes the complete tread axis upright before the normal fit.
BATCH_EIGHT_ADIDAS_SOLE_NORMALIZATION = {
    ROOT / "catalog-media/intake/official-brand/adidas/adidas-samba-og-white-black-b75806/03.jpg": {
        "sha256": "967b9d4a1497e15a287de136edf6494ba4787a25bddf43b3e4ca80547538d29b",
        "tolerance": 64,
        "rotation_degrees": -2.3,
    },
    ROOT / "catalog-media/intake/official-brand/adidas/adidas-gazelle-indoor-green-ji2062/03.jpg": {
        "sha256": "61c3ca55e8b99c840e00fffe4b2b5e67debbc27cc0ad98cd6645f38f7a86711c",
        "tolerance": 64,
        "rotation_degrees": 0.0,
    },
    ROOT / "catalog-media/intake/official-brand/adidas/adidas-campus-00s-core-black-hq8708/03.jpg": {
        "sha256": "b6ab4072664e46d4c8d974bedff39dbcf2a4fdb5664a8e5d37f6dc93a646da3f",
        "tolerance": 64,
        "rotation_degrees": 0.0,
    },
}

# These Nike product PNGs have a light supplier canvas inset inside their
# image bounds. A higher, source-specific threshold removes that inset before
# the canonical KICKSBASE backdrop is composed; it does not affect any other
# source or product profile.
BATCH_SIX_NIKE_DIRECT_CUTOUT_SOURCES = frozenset({
    ROOT / "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/01-P1.png",
    ROOT / "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/02-P2.png",
    ROOT / "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/03-P3.png",
    ROOT / "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/04-P4.png",
    ROOT / "catalog-media/intake/official-brand/nike/nike-air-max-95-black-anthracite-hf7545-002/01-P1.png",
    ROOT / "catalog-media/intake/official-brand/nike/nike-air-max-95-black-anthracite-hf7545-002/02-P2.png",
    ROOT / "catalog-media/intake/official-brand/nike/nike-air-max-95-black-anthracite-hf7545-002/03-P3.png",
    ROOT / "catalog-media/intake/official-brand/nike/nike-air-max-95-black-anthracite-hf7545-002/05-P5.png",
    ROOT / "catalog-media/intake/official-brand/nike/nike-air-max-95-black-anthracite-hf7545-002/06-P6.png",
})

# The five activated HF7723-001 assets are 1600px Nike source squares with a
# light, nested supplier canvas. This path/hash-scoped threshold extracts only
# the product silhouette before placing it on the canonical studio background.
BATCH_SEVEN_NIKE_VOMERO_5_CUTOUT_NORMALIZATION = {
    ROOT / "catalog-media/intake/official-brand/nike/nike-zoom-vomero-5-photon-dust-hf7723-001/01-P01.jpg": "967c4ee8906eeec7c9938c555a557c9951b756e8aa901a3392c8ca03a2bad1fb",
    ROOT / "catalog-media/intake/official-brand/nike/nike-zoom-vomero-5-photon-dust-hf7723-001/03-P03.jpg": "a047cd688836c3dc57cc934c722ecd80b1667fb0db80d56d94d3795b91edb3cd",
    ROOT / "catalog-media/intake/official-brand/nike/nike-zoom-vomero-5-photon-dust-hf7723-001/05-P05.jpg": "ef0e0a510238a43827703646e565b54fa62d106ce0264df1fa51cce96195bd3b",
    ROOT / "catalog-media/intake/official-brand/nike/nike-zoom-vomero-5-photon-dust-hf7723-001/06-P06.jpg": "4ceb94a4a49fa53c1b3ac4eb8117244ee215a56b02faae824286f2257622a8aa",
    ROOT / "catalog-media/intake/official-brand/nike/nike-zoom-vomero-5-photon-dust-hf7723-001/02-P02.jpg": "d379294d809be935d973ee7bac949268e081defab2b2ea6467f5bdd21ae2089e",
}

# This exact 9060 opposite-side source reaches the footwear F2 max-height
# limiter one percent before the cohort scale floor. The small locked scale-up
# keeps the complete source pixels intact and stays within the safe canvas.
BATCH_SEVEN_FRAME_SCALE_NORMALIZATION = {
    ("new-balance-9060-rain-cloud", 2): {
        "path": ROOT / "catalog-media/intake/official-brand/new-balance/new-balance-9060-rain-cloud/03.jpg",
        "sha256": "7082159b9fa030cdc4d12f798972a5bf37f1a565ba6ffeca3fb20a92657d57f1",
        "multiplier": 1.01,
    },
}

# Nike Air Max 95 P2 is the exact approved F5 sole source. Its wide studio
# ground shadow is below the full outsole, but becomes a detached vertical
# residue after the footwear portrait rotation. The source/hash-scoped matte
# trim removes only rows at and below this verified shadow boundary.
AIR_MAX_95_FIVE_GROUND_SHADOW_CLEANUP = {
    "path": ROOT / "catalog-media/intake/official-brand/nike/nike-air-max-95-black-anthracite-hf7545-002/02-P2.png",
    "sha256": "de5701a121892e21fee2f0c7ab3bc400f07454332fe756a9b3591f99b9b56bef",
    "trim_from_y": 1206,
}

# Timberland ALT6 is an opaque supplier PNG whose low-amplitude studio
# background variance crossed the default foreground threshold. The locked
# path/hash-specific threshold preserves the full boot while excluding only
# that background residue from its cutout bounds.
TIMBERLAND_FIELD_BOOT_F2_CUTOUT_NORMALIZATION = {
    "path": ROOT / "catalog-media/intake/official-brand/timberland/timberland-field-boot-beef-broccoli-tb0a18ahd47/06-ALT6.png",
    "sha256": "104583624152168908502b4cf3238c2fbbcb18ebb5d9cc435946977aa845f254",
    "tolerance": 4,
}

# Stabil and Fuse expose four verified raw source frames. Their generated
# positions are declared separately, so accepting four sources cannot make a
# fifth direct source appear.
BATCH_THREE_FOUR_FRAME_INTAKE_SLUGS = frozenset({
    "adidas-stabil-16-indoor",
    "puma-fuse-3",
})

DIRECT_SOURCE_FRAME_TWO_REPLACEMENT_SLUGS = (
    POIZON_FRAME_TWO_REPLACEMENT_SLUGS
    | BATCH_TWO_DIRECT_SOURCE_SLUGS
    | BATCH_THREE_DIRECT_SOURCE_SLUGS
    | BATCH_FOUR_DIRECT_SOURCE_SLUGS
    | BATCH_FIVE_DIRECT_SOURCE_SLUGS
    | BATCH_SIX_DIRECT_SOURCE_SLUGS
    | BATCH_SEVEN_DIRECT_SOURCE_SLUGS
    | BATCH_EIGHT_DIRECT_SOURCE_SLUGS
)

# These are the reviewed B2 generated and derived overrides. Four positions
# fill missing angles; Crazyflight frame three is a background-normalized
# derivative of the verified official adidas HM5 source.
BATCH_TWO_GENERATED_OVERRIDES: dict[str, dict[int, Path]] = {
    "adidas-harden-volume-9": {
        3: FINAL_SIX_FOOTWEAR_OVERRIDES / "adidas-harden-volume-9-active-3.png",
        4: FINAL_SIX_FOOTWEAR_OVERRIDES / "adidas-harden-volume-9-active-4.png",
    },
    "asics-gel-tactic-13": {
        4: FINAL_SIX_FOOTWEAR_OVERRIDES / "asics-gel-tactic-13-active-4.png",
    },
    "adidas-crazyflight-6-mid": {
        3: FINAL_SIX_FOOTWEAR_OVERRIDES / "adidas-crazyflight-6-mid-active-3.png",
        4: FINAL_SIX_FOOTWEAR_OVERRIDES / "adidas-crazyflight-6-mid-active-4.png",
    },
}

BATCH_TWO_GENERATED_DERIVATIVES: dict[tuple[str, int], dict[str, str]] = {
    ("adidas-crazyflight-6-mid", 3): {
        "kind": "project-generated-derivative",
        "generator": "KICKSBASE background-normalized derivative from approved official adidas HP7037 HM5 product image",
        "source_provider": "adidas-official-product-image",
        "source_url": "https://assets.adidas.com/images/h_2000%2Cf_auto%2Cq_auto%2Cfl_lossy%2Cc_fill%2Cg_auto/7323c9a288eb44b4966c386ec81b4213_9366/Crazyflight_6_Mid_Indoor_Shoes_White_HP7037_HM5.jpg",
        "derived_from_reference": "catalog-media/intake/official-brand/adidas/adidas-crazyflight-6-mid/03-three-quarter-pair.jpg",
        "derived_from_sha256": "42286fd3ff4d77f9e750d140a90133a332f7f5fd7f148069b33fc3239d853412",
        "source_view": "HP7037 HM5",
    },
}

# Batch 3 has seven exact generated missing angles and one deterministic
# derivative. Direct source activations stay in the intake manifest.
BATCH_THREE_GENERATED_OVERRIDES: dict[str, dict[int, Path]] = {
    "adidas-stabil-16-indoor": {
        3: FINAL_SIX_FOOTWEAR_OVERRIDES / "adidas-stabil-16-indoor-active-3.png",
        4: FINAL_SIX_FOOTWEAR_OVERRIDES / "adidas-stabil-16-indoor-active-4.png",
    },
    "mizuno-cyclone-speed-5": {
        3: FINAL_SIX_FOOTWEAR_OVERRIDES / "mizuno-cyclone-speed-5-active-3.png",
        4: FINAL_SIX_FOOTWEAR_OVERRIDES / "mizuno-cyclone-speed-5-active-4.png",
    },
    "mizuno-wave-momentum-3": {
        3: FINAL_SIX_FOOTWEAR_OVERRIDES / "mizuno-wave-momentum-3-active-3.png",
        4: FINAL_SIX_FOOTWEAR_OVERRIDES / "mizuno-wave-momentum-3-active-4.png",
    },
    "puma-fuse-3": {
        4: FINAL_SIX_FOOTWEAR_OVERRIDES / "puma-fuse-3-active-4.png",
        5: FINAL_SIX_FOOTWEAR_OVERRIDES / "puma-fuse-3-active-5.png",
    },
}

BATCH_THREE_GENERATED_DERIVATIVES: dict[tuple[str, int], dict[str, str]] = {
    ("puma-fuse-3", 5): {
        "kind": "project-generated-derivative",
        "generator": (
            "KICKSBASE deterministic exact outsole isolate from locked Poizon P4 "
            "without mirroring"
        ),
        "source_provider": "poizon-public-product-page",
        "source_url": (
            "https://cdn.poizon.com/pro-img/origin-img/20251208/"
            "5fa8e400642549d0a51d54ccd0b264c6.jpg"
        ),
        "derived_from_reference": (
            "catalog-media/intake/poizon-pages/"
            "puma-fuse-3-galactic-gray-black-green-glare/04.jpg"
        ),
        "derived_from_sha256": "6edefe500cde2fdf9ee464f6de43f5518cd6a98eae777b2b4208f12a3cab47aa",
        "source_view": "P4 right-hand outsole",
    },
}

# Batch 4 has one generated missing opposite-side view and two deterministic
# composites of locked official views. Their source sets are pinned here and
# validated before an output can be activated.
BATCH_FOUR_GENERATED_OVERRIDES: dict[str, dict[int, Path]] = {
    "crocs-mellow-recovery-slide": {
        2: BATCH_FOUR_OVERRIDES / "crocs-mellow-recovery-slide-active-2.png",
    },
    "oofos-ooahh-slide": {
        3: BATCH_FOUR_OVERRIDES / "oofos-ooahh-slide-active-3.png",
    },
    "hoka-ora-recovery-slide-3": {
        3: BATCH_FOUR_OVERRIDES / "hoka-ora-recovery-slide-3-active-3.png",
    },
}

BATCH_FOUR_GENERATED_PROVENANCE: dict[tuple[str, int], dict[str, Any]] = {
    ("crocs-mellow-recovery-slide", 2): {
        "kind": "project-generated-original",
        "generated_sha256": "a52b87396e2b9ac99df1a327b90b7f38c602ab37148b6d4002a42dafc8fb5d56",
        "generator": (
            "OpenAI image generation from the locked official Crocs 208392-001 "
            "reference set; direct opposite-side source was unavailable"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "crocs-official-product-image",
        "source_reference_role": "generated-from-locked-official-reference",
        "source_references": [
            {
                "asset_url": "https://media.crocs.com/images/t_standard/f_auto,q_auto/products/208392_001_ALT100/crocs-mellow-recovery-slide-black-side-view",
                "local_file": "catalog-media/intake/official-brand/crocs/crocs-mellow-recovery-slide-black/01-ALT100-side",
                "sha256": "2ad99b3f4f420ecf16266e1c5ee57463640e16068ab265d829e28430f697805a",
                "provider": "crocs-official-product-image",
                "source_view": "ALT100 side",
            },
            {
                "asset_url": "https://media.crocs.com/images/t_standard/f_auto,q_auto/products/208392_001_ALT110/crocs-mellow-recovery-slide-black-pair-view",
                "local_file": "catalog-media/intake/official-brand/crocs/crocs-mellow-recovery-slide-black/02-ALT110-pair",
                "sha256": "45fd4b0aecbaae8d573f6685d7f0f8f9c0ddb83b94893ba2d6401f27990b9f67",
                "provider": "crocs-official-product-image",
                "source_view": "ALT110 pair",
            },
            {
                "asset_url": "https://media.crocs.com/images/t_standard/f_auto,q_auto/products/208392_001_ALT120/crocs-mellow-recovery-slide-black-top-view",
                "local_file": "catalog-media/intake/official-brand/crocs/crocs-mellow-recovery-slide-black/03-ALT120-top",
                "sha256": "193f2a1969d57a1e809d8d8b417ae0c0d83b5c9c6c22f5fb699b23927fecccd7",
                "provider": "crocs-official-product-image",
                "source_view": "ALT120 top",
            },
            {
                "asset_url": "https://media.crocs.com/images/t_standard/f_auto,q_auto/products/208392_001_ALT130/crocs-mellow-recovery-slide-black-bottom-view",
                "local_file": "catalog-media/intake/official-brand/crocs/crocs-mellow-recovery-slide-black/04-ALT130-bottom",
                "sha256": "981856d031c5f8d183a52163346e07767d343c95becbf310960abe30c715fa76",
                "provider": "crocs-official-product-image",
                "source_view": "ALT130 bottom",
            },
            {
                "asset_url": "https://media.crocs.com/images/t_standard/f_auto,q_auto/products/208392_001_ALT140/crocs-mellow-recovery-slide-black-angle-view",
                "local_file": "catalog-media/intake/official-brand/crocs/crocs-mellow-recovery-slide-black/05-ALT140-angle",
                "sha256": "65c5ea55cc9a7d3a25044287adb8cc397d7f7aca0671e500372bd3fcdbfdec4a",
                "provider": "crocs-official-product-image",
                "source_view": "ALT140 angle",
            },
            {
                "asset_url": "https://media.crocs.com/images/t_standard/f_auto,q_auto/products/208392_001_ALT160/crocs-mellow-recovery-slide-black-style-view",
                "local_file": "catalog-media/intake/official-brand/crocs/crocs-mellow-recovery-slide-black/06-ALT160-style",
                "sha256": "0708de86d3bed1cde0b410f5c0cd673554d726e8e6c9d6a94bb6acbb8cb4a4f5",
                "provider": "crocs-official-product-image",
                "source_view": "ALT160 rear/back",
            },
        ],
    },
    ("oofos-ooahh-slide", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "4f251e28534f3a890be8969814f3a9da1b4cfcfa8d1910667610b96afb54faa8",
        "generator": (
            "KICKSBASE deterministic unmirrored pair composite from locked official "
            "OOFOS 1100BLK shot1 lateral and shot2 three-quarter source images"
        ),
        "source_provider": "oofos-official-product-image",
        "source_reference_role": "direct-derived-unmirrored-pair-composite",
        "source_references": [
            {
                "asset_url": "https://www.oofos.com/cdn/shop/products/1100BLK_shot1.jpg?v=1743781788",
                "local_file": "catalog-media/intake/official-brand/oofos/oofos-ooahh-slide-black/01-shot1.jpg",
                "sha256": "89ff89896d09b65ada66c67619ea090d6e4ce7290dc35e1ddba8db398c8135d8",
                "provider": "oofos-official-product-image",
                "source_view": "shot1 lateral",
            },
            {
                "asset_url": "https://www.oofos.com/cdn/shop/products/1100BLK_shot2.jpg?v=1762181900",
                "local_file": "catalog-media/intake/official-brand/oofos/oofos-ooahh-slide-black/02-shot2.jpg",
                "sha256": "abd4d76294c2ade3e16dcd27dcc52a1f5621963af57752415cbf3e76f9618147",
                "provider": "oofos-official-product-image",
                "source_view": "shot2 three-quarter",
            },
        ],
    },
    ("hoka-ora-recovery-slide-3", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "7fb2a88fc06fd23f72e2a4ecaf2d1ba9345620608be8e4c2e041a28bf60ade10",
        "generator": (
            "KICKSBASE deterministic unmirrored pair composite from locked official "
            "HOKA ORA Recovery Slide 3 views 3 and 6"
        ),
        "source_provider": "hoka-official-product-image",
        "source_reference_role": "direct-derived-unmirrored-pair-composite",
        "source_references": [
            {
                "asset_url": "https://media.au.hoka.com/products/ec753a86-e418-4e7e-b280-ca52fbbac2ed/8a26e857/1135061-bblc_bblc_3.jpg",
                "local_file": "catalog-media/intake/official-brand/hoka/hoka-ora-recovery-slide-3-black-black/03_3.jpg",
                "sha256": "8a26e857688513d3ab0734db56aa5bc959923653f505d327f9bd0a4b44c4c65c",
                "provider": "hoka-official-product-image",
                "source_view": "view 3 three-quarter",
            },
            {
                "asset_url": "https://media.au.hoka.com/products/ec753a86-e418-4e7e-b280-ca52fbbac2ed/b2e7ecdd/1135061-bblc_bblc_6.jpg",
                "local_file": "catalog-media/intake/official-brand/hoka/hoka-ora-recovery-slide-3-black-black/06_6.jpg",
                "sha256": "b2e7ecdd260b696ed87725b90ecc556abb6bb46473d0a0dd939733a7c287a1ea",
                "provider": "hoka-official-product-image",
                "source_view": "view 6 three-quarter",
            },
        ],
    },
}

# Five locked B5 galleries lack a direct front-three-quarter pair. Each F3
# source below is an unmirrored deterministic composite of two distinct exact
# views. Momentum Pro has a direct P4 two-shoe F3 source, so it has no override.
BATCH_FIVE_GENERATED_OVERRIDES: dict[str, dict[int, Path]] = {
    "mizuno-wave-lightning-z8": {
        3: BATCH_FIVE_OVERRIDES / "mizuno-wave-lightning-z8-active-3.png",
    },
    "mizuno-wave-lightning-z8-mid": {
        3: BATCH_FIVE_OVERRIDES / "mizuno-wave-lightning-z8-mid-active-3.png",
    },
    "mizuno-wave-luminous-3": {
        3: BATCH_FIVE_OVERRIDES / "mizuno-wave-luminous-3-active-3.png",
    },
    "mizuno-wave-momentum-elite-mid": {
        3: BATCH_FIVE_OVERRIDES / "mizuno-wave-momentum-elite-mid-active-3.png",
    },
    "mizuno-wave-voltage-2": {
        3: BATCH_FIVE_OVERRIDES / "mizuno-wave-voltage-2-active-3.png",
    },
}

BATCH_FIVE_GENERATED_PROVENANCE: dict[tuple[str, int], dict[str, Any]] = {
    ("mizuno-wave-lightning-z8", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "f9eddf4ac9a3545b5bd196f05d050125a05c3e3f158ce4f3f797dc05f319d861",
        "generator": (
            "KICKSBASE deterministic unmirrored pair composite from locked Mizuno "
            "Wave Lightning Z8 V1GA240097 P1 lateral and P6 three-quarter sources; "
            "the locked gallery had no direct F3 pair source"
        ),
        "source_provider": "mizuno-official-product-image",
        "source_reference_role": "direct-derived-unmirrored-pair-composite",
        "source_references": [
            {
                "asset_url": "https://mys.mizuno.com/cdn/shop/files/SH_V1GA240097_25fdf8e2-e0c2-41e1-b362-7a4da9c46124.jpg?v=1757689911&width=5000",
                "download_url": "https://mys.mizuno.com/cdn/shop/files/SH_V1GA240097_25fdf8e2-e0c2-41e1-b362-7a4da9c46124.jpg?v=1757689911&width=5000",
                "local_file": "catalog-media/intake/official-brand/mizuno/mizuno-wave-lightning-z8-white-bellwether-blue-bel-air-blue/01.jpg",
                "sha256": "d767901b5381e099390e29333bfdd1aaf572a252728bf00433d911ea0e76303e",
                "provider": "mizuno-official-product-image",
                "source_view": "P1 lateral side",
            },
            {
                "asset_url": "https://mys.mizuno.com/cdn/shop/files/SH_V1GA240097_11_26dd0a28-458e-415f-a918-e4e4eccc6d22.jpg?v=1757689911&width=5000",
                "download_url": "https://mys.mizuno.com/cdn/shop/files/SH_V1GA240097_11_26dd0a28-458e-415f-a918-e4e4eccc6d22.jpg?v=1757689911&width=5000",
                "local_file": "catalog-media/intake/official-brand/mizuno/mizuno-wave-lightning-z8-white-bellwether-blue-bel-air-blue/06.jpg",
                "sha256": "c1d854d976925838cc2952253712aeed17e5561ba05f268a5ea70f43e8b5f082",
                "provider": "mizuno-official-product-image",
                "source_view": "P6 front three-quarter",
            },
        ],
    },
    ("mizuno-wave-lightning-z8-mid", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "4b16eb880dac4e13e916b4298f9585deb99aaf817e3a0cfcbd23c962e4dc77fc",
        "generator": (
            "KICKSBASE deterministic unmirrored pair composite from locked Mizuno "
            "Wave Lightning Z8 Mid V1GA240597 P1 lateral and P6 three-quarter sources; "
            "the locked gallery had no direct F3 pair source"
        ),
        "source_provider": "mizuno-official-product-image",
        "source_reference_role": "direct-derived-unmirrored-pair-composite",
        "source_references": [
            {
                "asset_url": "https://mys.mizuno.com/cdn/shop/files/SH_V1GA240597_df989e63-9b52-47ad-b3e6-0b8276e380b4.jpg?v=1757689902&width=5000",
                "download_url": "https://mys.mizuno.com/cdn/shop/files/SH_V1GA240597_df989e63-9b52-47ad-b3e6-0b8276e380b4.jpg?v=1757689902&width=5000",
                "local_file": "catalog-media/intake/official-brand/mizuno/mizuno-wave-lightning-z8-mid-white-bellwether-blue-bel-air-blue/01.jpg",
                "sha256": "3f0e0128b078646d560ca8acc610831fedbd6c4fde9514ae55a6b63a83552f79",
                "provider": "mizuno-official-product-image",
                "source_view": "P1 lateral side",
            },
            {
                "asset_url": "https://mys.mizuno.com/cdn/shop/files/SH_V1GA240597_11_a00f89e6-0ca8-4a82-89e8-e48521933046.jpg?v=1757689902&width=5000",
                "download_url": "https://mys.mizuno.com/cdn/shop/files/SH_V1GA240597_11_a00f89e6-0ca8-4a82-89e8-e48521933046.jpg?v=1757689902&width=5000",
                "local_file": "catalog-media/intake/official-brand/mizuno/mizuno-wave-lightning-z8-mid-white-bellwether-blue-bel-air-blue/06.jpg",
                "sha256": "77202b421e5d9806a10d33c6f2a326b8084ffc60b51504a368ac9300e10ea04d",
                "provider": "mizuno-official-product-image",
                "source_view": "P6 front three-quarter",
            },
        ],
    },
    ("mizuno-wave-luminous-3", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "3e3f618834cd7608aa60cc15a3ef3f43f348e6a35edd098e97ed0526bf411adb",
        "generator": (
            "KICKSBASE deterministic unmirrored pair composite from locked Poizon "
            "Mizuno Wave Luminous 3 V1GA242059 P2 lateral and P3 opposite-side sources; "
            "the locked gallery had no direct F3 pair source"
        ),
        "source_provider": "poizon-public-product-image",
        "source_reference_role": "direct-derived-unmirrored-pair-composite",
        "source_references": [
            {
                "asset_url": "https://cdn-img.thepoizon.ru/pro-img/cut-img/20260104/16b56d6cf375442b88bc0a7df381a8a6.jpg?x-oss-process=image%2Fresize%2Cs_720%2Fformat%2Cwebp",
                "download_url": "https://cdn-img.thepoizon.ru/pro-img/cut-img/20260104/16b56d6cf375442b88bc0a7df381a8a6.jpg",
                "local_file": "catalog-media/intake/poizon-pages/mizuno-wave-luminous-3-white-v1ga242059/02.jpg",
                "sha256": "7ed1f5f6744cab5c6b8244621d797e56a4e16d71d515a12ab82935a020a62a9e",
                "provider": "poizon-public-product-image",
                "source_view": "P2 lateral side",
            },
            {
                "asset_url": "https://cdn-img.thepoizon.ru/pro-img/cut-img/20260104/0370805f964a40ae9ea6318754380f57.jpg?x-oss-process=image%2Fresize%2Cs_720%2Fformat%2Cwebp",
                "download_url": "https://cdn-img.thepoizon.ru/pro-img/cut-img/20260104/0370805f964a40ae9ea6318754380f57.jpg",
                "local_file": "catalog-media/intake/poizon-pages/mizuno-wave-luminous-3-white-v1ga242059/03.jpg",
                "sha256": "cb596e3e773104015c626ea73082235308f0447ad1b433248e2d05e47e227ea9",
                "provider": "poizon-public-product-image",
                "source_view": "P3 opposite side",
            },
        ],
    },
    ("mizuno-wave-momentum-elite-mid", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "a4c7b2f190bd7183218bb3c2a211cb543f922a9f826d50269902f98631983afa",
        "generator": (
            "KICKSBASE deterministic unmirrored pair composite from locked Mizuno "
            "Wave Momentum Elite Mid V1GA251759 P1 lateral and P6 three-quarter sources; "
            "the locked gallery had no direct F3 pair source"
        ),
        "source_provider": "mizuno-official-product-image",
        "source_reference_role": "direct-derived-unmirrored-pair-composite",
        "source_references": [
            {
                "asset_url": "https://emea.mizuno.com/dw/image/v2/BDBS_PRD/on/demandware.static/-/Sites-masterCatalog_Mizuno/default/dw593be4ff/SS26/Footwear/SH_V1GA251759_00.png?sh=95&sw=95",
                "download_url": "https://emea.mizuno.com/dw/image/v2/BDBS_PRD/on/demandware.static/-/Sites-masterCatalog_Mizuno/default/dw593be4ff/SS26/Footwear/SH_V1GA251759_00.png?sh=2000&sw=2000",
                "local_file": "catalog-media/intake/official-brand/mizuno/mizuno-wave-momentum-elite-mid-white-black-fiery-red/01.png",
                "sha256": "d49b2460ef6bd7a0f6ce28a410bf9d1ede279c4e3c8943a333b2b14e2e4fc115",
                "provider": "mizuno-official-product-image",
                "source_view": "P1 lateral side",
            },
            {
                "asset_url": "https://emea.mizuno.com/dw/image/v2/BDBS_PRD/on/demandware.static/-/Sites-masterCatalog_Mizuno/default/dw93c27cc2/SS26/Footwear/SH_V1GA251759_11.png?sh=95&sw=95",
                "download_url": "https://emea.mizuno.com/dw/image/v2/BDBS_PRD/on/demandware.static/-/Sites-masterCatalog_Mizuno/default/dw93c27cc2/SS26/Footwear/SH_V1GA251759_11.png?sh=2000&sw=2000",
                "local_file": "catalog-media/intake/official-brand/mizuno/mizuno-wave-momentum-elite-mid-white-black-fiery-red/06.png",
                "sha256": "3a1d5ac4a745a451ec7a6ce3fdb753171333ed52ec6d9fc7ec962da4e62ca044",
                "provider": "mizuno-official-product-image",
                "source_view": "P6 front three-quarter",
            },
        ],
    },
    ("mizuno-wave-voltage-2", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "f8d7ebda9f0eb0449b689388770f58e4571c3c19e7e7ebce4a45c20d9f3a0a68",
        "generator": (
            "KICKSBASE deterministic unmirrored pair composite from locked Mizuno "
            "Wave Voltage 2 V1GA246016 P1 lateral and P6 three-quarter sources; "
            "the locked gallery had no direct F3 pair source"
        ),
        "source_provider": "mizuno-official-product-image",
        "source_reference_role": "direct-derived-unmirrored-pair-composite",
        "source_references": [
            {
                "asset_url": "https://emea.mizuno.com/dw/image/v2/BDBS_PRD/on/demandware.static/-/Sites-masterCatalog_Mizuno/default/dw338875b1/AW25/Footwear/SH_V1GA246016_00.png?sh=95&sw=95",
                "download_url": "https://emea.mizuno.com/dw/image/v2/BDBS_PRD/on/demandware.static/-/Sites-masterCatalog_Mizuno/default/dw338875b1/AW25/Footwear/SH_V1GA246016_00.png?sh=2000&sw=2000",
                "local_file": "catalog-media/intake/official-brand/mizuno/mizuno-wave-voltage-2-white-black-frozen-emerald/01.png",
                "sha256": "80adf754953065922c39c9895c74400019899ee93b52e3bba31d9af8fa12879d",
                "provider": "mizuno-official-product-image",
                "source_view": "P1 lateral side",
            },
            {
                "asset_url": "https://emea.mizuno.com/dw/image/v2/BDBS_PRD/on/demandware.static/-/Sites-masterCatalog_Mizuno/default/dwb8bb638c/AW25/Footwear/SH_V1GA246016_05.png?sh=95&sw=95",
                "download_url": "https://emea.mizuno.com/dw/image/v2/BDBS_PRD/on/demandware.static/-/Sites-masterCatalog_Mizuno/default/dwb8bb638c/AW25/Footwear/SH_V1GA246016_05.png?sh=2000&sw=2000",
                "local_file": "catalog-media/intake/official-brand/mizuno/mizuno-wave-voltage-2-white-black-frozen-emerald/06.png",
                "sha256": "a0e609223491b67821eeb50b0b57780264352f4ddd47f64056997029f14f5290",
                "provider": "mizuno-official-product-image",
                "source_view": "P6 front three-quarter",
            },
        ],
    },
}

# Batch 6 has two owner-authorized missing true-rear references plus one
# canonical Mind F3 pair derivative. Every input below is an exact official
# binary, pinned before the generated frame can be activated.
BATCH_SIX_GENERATED_OVERRIDES: dict[str, dict[int, Path]] = {
    "nike-calm-slide": {
        4: BATCH_SIX_OVERRIDES / "nike-calm-slide-active-4.png",
    },
    "nike-mind-001-slide-black": {
        3: BATCH_SIX_OVERRIDES / "nike-mind-001-slide-black-active-3.png",
        4: BATCH_SIX_OVERRIDES / "nike-mind-001-slide-black-active-4.png",
    },
}

BATCH_SIX_GENERATED_PROVENANCE: dict[tuple[str, int], dict[str, Any]] = {
    ("nike-calm-slide", 4): {
        "kind": "project-generated-derivative",
        "generated_sha256": "dcf4bc95aeffe935f70b73dc3202f8ce23a488d5b7d9f5efc28f58c0a229fa4e",
        "generator": (
            "OpenAI image generation from the locked official Nike Calm FD4116-001 "
            "Black/Black reference set; direct true-rear pair source was unavailable"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "nike-official-product-image",
        "source_reference_role": "generated-from-locked-official-reference",
        "source_references": [
            {
                "asset_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/d3bbbc21-03a4-46c6-adc1-3066a1ea7e96/NIKE+CALM+SLIDE.png",
                "download_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/d3bbbc21-03a4-46c6-adc1-3066a1ea7e96/NIKE+CALM+SLIDE.png",
                "local_file": "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/01-P1.png",
                "sha256": "0f1796854bf004d5a5fb05f504637ee1ed8e5869e11eb23a76449a6924a3050e",
                "provider": "nike-official-product-image",
                "source_view": "P1 front-three-quarter pair",
            },
            {
                "asset_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/4898b598-226c-41c6-8ad9-c7a8c9daa42b/NIKE+CALM+SLIDE.png",
                "download_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/4898b598-226c-41c6-8ad9-c7a8c9daa42b/NIKE+CALM+SLIDE.png",
                "local_file": "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/02-P2.png",
                "sha256": "fca4cb759590b4e487fe878d7eb34dc65397d09c50d90ece6585aff0dcef3f01",
                "provider": "nike-official-product-image",
                "source_view": "P2 direct side",
            },
            {
                "asset_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/82fdb902-f636-4df4-a9e0-84c358e9bf55/NIKE+CALM+SLIDE.png",
                "download_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/82fdb902-f636-4df4-a9e0-84c358e9bf55/NIKE+CALM+SLIDE.png",
                "local_file": "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/03-P3.png",
                "sha256": "d7e2df8cd31108c641f80cbbdd9787515e342e810fd6bb9efa6cba1b25c106d4",
                "provider": "nike-official-product-image",
                "source_view": "P3 sole",
            },
            {
                "asset_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/04121a5c-b63b-44e3-b9be-71d0a084488d/NIKE+CALM+SLIDE.png",
                "download_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/04121a5c-b63b-44e3-b9be-71d0a084488d/NIKE+CALM+SLIDE.png",
                "local_file": "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/04-P4.png",
                "sha256": "cee331606b578de1cc52ded7eba2984b707e47e7f08a16c692e1e08ab9c89d79",
                "provider": "nike-official-product-image",
                "source_view": "P4 opposite side",
            },
            {
                "asset_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/e25bb32c-cd0f-4cb1-9791-a3332b30c2f7/NIKE+CALM+SLIDE.png",
                "download_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/e25bb32c-cd0f-4cb1-9791-a3332b30c2f7/NIKE+CALM+SLIDE.png",
                "local_file": "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/05-P5.png",
                "sha256": "8ec83988ca925a9d1cdcb2f44c8f7b37761133ab9725d2ff1572cf0a2e010107",
                "provider": "nike-official-product-image",
                "source_view": "P5 top pair",
            },
            {
                "asset_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/e6db6318-0d00-4fa6-b48b-b7567eaeebba/NIKE+CALM+SLIDE.png",
                "download_url": "https://static.nike.com/a/images/w_1600,q_auto,f_auto/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/e6db6318-0d00-4fa6-b48b-b7567eaeebba/NIKE+CALM+SLIDE.png",
                "local_file": "catalog-media/intake/official-brand/nike/nike-calm-slide-fd4116-001-black-black/06-P6.png",
                "sha256": "a6e62068a23c3a9b4f13c71324984243ce9a481d2b69aed77f00603f76b37e16",
                "provider": "nike-official-product-image",
                "source_view": "P6 material detail",
            },
        ],
    },
    ("nike-mind-001-slide-black", 4): {
        "kind": "project-generated-derivative",
        "generated_sha256": "1e33c715ca092df444f316f75af9ae934dfdfed1b4eaea4c868a4c48e31e5b4d",
        "generator": (
            "OpenAI image generation from the locked official Fragment x Nike Mind 001 "
            "IQ8502-001 Black reference set; direct true-rear pair source was unavailable"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "nike-official-product-image",
        "source_reference_role": "generated-from-locked-official-reference",
        "source_references": [
            {
                "asset_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/0d475f9f-2c80-47db-94d7-7277cf87d117/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "download_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/0d475f9f-2c80-47db-94d7-7277cf87d117/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "local_file": "catalog-media/intake/official-brand/nike/nike-mind-001-slide-black-iq8502-001/01-P1.png",
                "sha256": "3f612e2a10a43752d834431a445bbfa182572f568af26a966ea3647e618014e3",
                "provider": "nike-official-product-image",
                "source_view": "P1 front-three-quarter pair",
            },
            {
                "asset_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/c0c43254-bd93-4c37-ba4e-2fa3d805d119/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "download_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/c0c43254-bd93-4c37-ba4e-2fa3d805d119/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "local_file": "catalog-media/intake/official-brand/nike/nike-mind-001-slide-black-iq8502-001/02-P2.png",
                "sha256": "f9401d0f89ec0e565813604b250fbacc16b3f88f10f055e205a8541c04be693b",
                "provider": "nike-official-product-image",
                "source_view": "P2 direct side",
            },
            {
                "asset_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/ec54b8bd-dc6c-469a-8e2d-f2742073ea2d/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "download_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/ec54b8bd-dc6c-469a-8e2d-f2742073ea2d/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "local_file": "catalog-media/intake/official-brand/nike/nike-mind-001-slide-black-iq8502-001/03-P3.png",
                "sha256": "a2461bfa20758f5b9e8408f8146e254d2b12e418885b7916b9aa0d224c0a8ebc",
                "provider": "nike-official-product-image",
                "source_view": "P3 sole",
            },
            {
                "asset_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/89b2b46c-8c81-40d9-a58f-0f5782dc4db4/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "download_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/89b2b46c-8c81-40d9-a58f-0f5782dc4db4/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "local_file": "catalog-media/intake/official-brand/nike/nike-mind-001-slide-black-iq8502-001/04-P4.png",
                "sha256": "2e929429872691dc0f200b3b5141d60d0bdd9e91168a4f301c1200e2ddc566a6",
                "provider": "nike-official-product-image",
                "source_view": "P4 opposite side",
            },
            {
                "asset_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/7ff37c0c-0c90-4bfa-a903-97440725b517/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "download_url": "https://static.nike.com/a/images/w_1920,q_auto,f_auto/7ff37c0c-0c90-4bfa-a903-97440725b517/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
                "local_file": "catalog-media/intake/official-brand/nike/nike-mind-001-slide-black-iq8502-001/05-P5.png",
                "sha256": "670b2d77ba410e7b274c4ea793e161b35a63647e7a9528e4bce812fd36316d21",
                "provider": "nike-official-product-image",
                "source_view": "P5 top pair",
            },
        ],
    },
}

# Mind P1 is a locked official pair but reads sole-forward in the gallery.
# F3 and F4 intentionally share the same verified five-image reference set.
BATCH_SIX_GENERATED_PROVENANCE[("nike-mind-001-slide-black", 3)] = {
    "kind": "project-generated-derivative",
    "generated_sha256": "d519580ef2efdd7570dce6355b13822abb035457f7fa01f16bc08c6761ef6aee",
    "generator": (
        "OpenAI image generation from the locked official Fragment x Nike Mind 001 "
        "IQ8502-001 Black reference set; direct P1 read sole-forward, so an "
        "unmirrored canonical front-three-quarter pair derivative was required"
    ),
    "source_provider": "kicksbase-generated-reference",
    "reference_provider": "nike-official-product-image",
    "source_reference_role": "generated-from-locked-official-reference",
    "source_references": BATCH_SIX_GENERATED_PROVENANCE[
        ("nike-mind-001-slide-black", 4)
    ]["source_references"],
}

# Batch 7 has two OpenAI-derived missing angles and one deterministic pair
# composite. Every generated output is hash-pinned and traces back to the
# exact local source binaries used to create it.
BATCH_SEVEN_GENERATED_OVERRIDES: dict[str, dict[int, Path]] = {
    "salomon-xt-6-white-lunar-rock": {
        2: BATCH_SEVEN_OVERRIDES / "salomon-xt-6-white-lunar-rock-active-2.png",
    },
    "new-balance-2002r-protection-pack": {
        3: BATCH_SEVEN_OVERRIDES / "new-balance-2002r-protection-pack-active-3.png",
        4: BATCH_SEVEN_OVERRIDES / "new-balance-2002r-protection-pack-active-4.png",
    },
}

BATCH_SEVEN_GENERATED_PROVENANCE: dict[tuple[str, int], dict[str, Any]] = {
    ("salomon-xt-6-white-lunar-rock", 2): {
        "kind": "project-generated-derivative",
        "generated_sha256": "52f5427b39176c6984989daed9f6908fe6a6be955714b72c208f13ebc8cc6966",
        "generator": (
            "OpenAI gpt-image-2 true opposite-side single reconstruction from the "
            "locked official Salomon XT-6 L41252900 White/White/Lunar Rock source set; "
            "the resulting shoe is not mirrored"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "salomon-official-product-image",
        "source_reference_role": "generated-true-opposite-side-single-from-locked-official-reference",
        "source_references": [
            {
                "asset_url": "https://cdn.dam.salomon.com/0efa70ed-89aa-439d-9f7b-b2f400da0fbf/L41252900/PNG-2000px-max-72dpi.png",
                "download_url": "https://cdn.dam.salomon.com/0efa70ed-89aa-439d-9f7b-b2f400da0fbf/L41252900/PNG-2000px-max-72dpi.png",
                "local_file": "catalog-media/intake/official-brand/salomon/salomon-xt-6-white-lunar-rock/01.png",
                "sha256": "480b9eb07920a5080529c5881d2333934b1d90b0340b5dc71121b5d6a2d4df30",
                "provider": "salomon-official-product-image",
                "source_view": "official 01 direct side",
            },
            {
                "asset_url": "https://cdn.dam.salomon.com/87e9eb95-d898-405b-8fd5-b2f400db7d4d/L41252900/PNG-2000px-max-72dpi.png",
                "download_url": "https://cdn.dam.salomon.com/87e9eb95-d898-405b-8fd5-b2f400db7d4d/L41252900/PNG-2000px-max-72dpi.png",
                "local_file": "catalog-media/intake/official-brand/salomon/salomon-xt-6-white-lunar-rock/04.png",
                "sha256": "f724b58e9951a62bd7f9f7703e7ecf062a005648ccb03e6ce578ae8251d36982",
                "provider": "salomon-official-product-image",
                "source_view": "official 04 top pair",
            },
            {
                "asset_url": "https://cdn.dam.salomon.com/0fc35e80-84c1-431a-b48f-b2f400d9c752/L41252900/PNG-2000px-max-72dpi.png",
                "download_url": "https://cdn.dam.salomon.com/0fc35e80-84c1-431a-b48f-b2f400d9c752/L41252900/PNG-2000px-max-72dpi.png",
                "local_file": "catalog-media/intake/official-brand/salomon/salomon-xt-6-white-lunar-rock/05.png",
                "sha256": "ebb679c4041c1ff141876da65fa9c6bf285933e1bbac278fb39899f1ec785fb0",
                "provider": "salomon-official-product-image",
                "source_view": "official 05 full pair",
            },
            {
                "asset_url": "https://cdn.dam.salomon.com/381c452e-4bf1-4e84-8f24-b2f400da4561/L41252900/PNG-2000px-max-72dpi.png",
                "download_url": "https://cdn.dam.salomon.com/381c452e-4bf1-4e84-8f24-b2f400da4561/L41252900/PNG-2000px-max-72dpi.png",
                "local_file": "catalog-media/intake/official-brand/salomon/salomon-xt-6-white-lunar-rock/06.png",
                "sha256": "0b13c3d62dea0133fc512dddc88f1bfb2eb5a9bd75232e21803676a04f809340",
                "provider": "salomon-official-product-image",
                "source_view": "official 06 rear pair",
            },
            {
                "asset_url": "https://cdn.dam.salomon.com/218f1819-feca-4c6c-bbc0-b2f800b5dcf7/L41252900/PNG-2000px-max-72dpi.png",
                "download_url": "https://cdn.dam.salomon.com/218f1819-feca-4c6c-bbc0-b2f800b5dcf7/L41252900/PNG-2000px-max-72dpi.png",
                "local_file": "catalog-media/intake/official-brand/salomon/salomon-xt-6-white-lunar-rock/07.png",
                "sha256": "cd343d39d0655b3af4eae3c15035b8fc7d38cf6d59f11d8f8d39d9d24593b34e",
                "provider": "salomon-official-product-image",
                "source_view": "official 07 sole",
            },
        ],
    },
    ("new-balance-2002r-protection-pack", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "4622fac36f4869ca62d6e53ccedc4e2e1f043d9c87cc5711b216ddc8499a90e0",
        "generator": (
            "scripts/build_batch7_footwear_derivatives.py deterministic unmirrored "
            "complete-pair composite from two distinct locked official New Balance "
            "M2002RDA source views"
        ),
        "source_provider": "new-balance-official-product-image",
        "source_reference_role": "direct-derived-unmirrored-complete-pair-composite",
        "source_references": [
            {
                "asset_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_02_i?$pdpflexf2$&wid=1600&hei=1200",
                "download_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_02_i?$pdpflexf2$&wid=1600&hei=1200",
                "local_file": "catalog-media/intake/official-brand/new-balance/new-balance-2002r-protection-pack/02.jpg",
                "sha256": "279c43f2c49c20b2dea1d5566396390bab32babc40dadc6bee965470cd50e4cf",
                "provider": "new-balance-official-product-image",
                "source_view": "official 02 direct side",
            },
            {
                "asset_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_05_i?$pdpflexf2$&wid=1600&hei=1200",
                "download_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_05_i?$pdpflexf2$&wid=1600&hei=1200",
                "local_file": "catalog-media/intake/official-brand/new-balance/new-balance-2002r-protection-pack/05.jpg",
                "sha256": "d9023e1714883b88895225dce8b5adb7aaac9e339a593697b7e5c2eaa6d1ac22",
                "provider": "new-balance-official-product-image",
                "source_view": "official 05 front-three-quarter",
            },
        ],
    },
    ("new-balance-2002r-protection-pack", 4): {
        "kind": "project-generated-derivative",
        "generated_sha256": "ced7d311c395ea04e4a727e1a066ad4f3b3edbe3decf26ff9836e64d0ee9f260",
        "generator": (
            "OpenAI gpt-image-2 true rear-pair reconstruction from the complete "
            "locked official New Balance M2002RDA source set; the pair is not mirrored"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "new-balance-official-product-image",
        "source_reference_role": "generated-true-rear-pair-from-locked-official-reference",
        "source_references": [
            {
                "asset_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_02_i?$pdpflexf2$&wid=1600&hei=1200",
                "download_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_02_i?$pdpflexf2$&wid=1600&hei=1200",
                "local_file": "catalog-media/intake/official-brand/new-balance/new-balance-2002r-protection-pack/02.jpg",
                "sha256": "279c43f2c49c20b2dea1d5566396390bab32babc40dadc6bee965470cd50e4cf",
                "provider": "new-balance-official-product-image",
                "source_view": "official 02 direct side",
            },
            {
                "asset_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_03_i?$pdpflexf2$&wid=1600&hei=1200",
                "download_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_03_i?$pdpflexf2$&wid=1600&hei=1200",
                "local_file": "catalog-media/intake/official-brand/new-balance/new-balance-2002r-protection-pack/03.jpg",
                "sha256": "e2a0d9d212677411329616147c008554e1b0596d6d844321049aa8ab0165a095",
                "provider": "new-balance-official-product-image",
                "source_view": "official 03 true opposite side",
            },
            {
                "asset_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_04_i?$pdpflexf2$&wid=1600&hei=1200",
                "download_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_04_i?$pdpflexf2$&wid=1600&hei=1200",
                "local_file": "catalog-media/intake/official-brand/new-balance/new-balance-2002r-protection-pack/04.jpg",
                "sha256": "c32c866fa7acbdc280276fa1edb988fa9406919db9097e7076c351cc44e08051",
                "provider": "new-balance-official-product-image",
                "source_view": "official 04 top",
            },
            {
                "asset_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_05_i?$pdpflexf2$&wid=1600&hei=1200",
                "download_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_05_i?$pdpflexf2$&wid=1600&hei=1200",
                "local_file": "catalog-media/intake/official-brand/new-balance/new-balance-2002r-protection-pack/05.jpg",
                "sha256": "d9023e1714883b88895225dce8b5adb7aaac9e339a593697b7e5c2eaa6d1ac22",
                "provider": "new-balance-official-product-image",
                "source_view": "official 05 front-three-quarter",
            },
            {
                "asset_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_06_i?$pdpflexf2$&wid=1600&hei=1200",
                "download_url": "https://nb.scene7.com/is/image/NB/M2002RDA_nb_06_i?$pdpflexf2$&wid=1600&hei=1200",
                "local_file": "catalog-media/intake/official-brand/new-balance/new-balance-2002r-protection-pack/06.jpg",
                "sha256": "f50c0976652f72f85d938ce72b8dd975f7b783726548deae4014abcedaffc5f8",
                "provider": "new-balance-official-product-image",
                "source_view": "official 06 sole",
            },
        ],
    },
}

# Batch 8 uses five reviewed image-generation exceptions and two deterministic
# exact-pixel derivatives. Each output and every input binary is hash-pinned.
BATCH_EIGHT_GENERATED_OVERRIDES: dict[str, dict[int, Path]] = {
    "new-balance-530-white-silver-navy": {
        3: BATCH_EIGHT_OVERRIDES / "new-balance-530-white-silver-navy-active-3.png",
        4: BATCH_EIGHT_OVERRIDES / "new-balance-530-white-silver-navy-active-4.png",
    },
    "adidas-samba-og-white-black": {
        3: BATCH_EIGHT_OVERRIDES / "adidas-samba-og-white-black-active-3.png",
        4: BATCH_EIGHT_OVERRIDES / "adidas-samba-og-white-black-active-4.png",
    },
    "adidas-gazelle-indoor-green": {
        3: BATCH_EIGHT_OVERRIDES / "adidas-gazelle-indoor-green-active-3.png",
        4: BATCH_EIGHT_OVERRIDES / "adidas-gazelle-indoor-green-active-4.png",
    },
    "adidas-campus-00s-core-black": {
        4: BATCH_EIGHT_OVERRIDES / "adidas-campus-00s-core-black-active-4.png",
    },
}

_B8_NB_PRODUCT_URL = "https://www.newbalance.com/pd/530/MR530SG.html"
_B8_ADIDAS_SAMBA_URL = "https://www.adidas.com/us/samba-og-shoes/B75806.html"
_B8_ADIDAS_GAZELLE_URL = "https://www.adidas.co.uk/gazelle-indoor-shoes/JI2062.html"
_B8_ADIDAS_CAMPUS_URL = "https://www.adidas.com/us/campus-00s-shoes/HQ8708.html"


def batch_eight_adidas_official_references(
    *, product_url: str, source_dir: str, references: tuple[tuple[int, str, str], ...]
) -> list[dict[str, str]]:
    return [
        {
            "asset_url": product_url,
            "download_url": product_url,
            "local_file": f"catalog-media/intake/official-brand/adidas/{source_dir}/{position:02d}.jpg",
            "sha256": digest,
            "provider": "adidas-official-product-image",
            "source_view": view,
        }
        for position, digest, view in references
    ]

BATCH_EIGHT_MR530_REFERENCES = [
    {
        "asset_url": f"https://nb.scene7.com/is/image/NB/MR530SG_nb_{position:02d}_i?$pdpflexf2$&wid=1600&hei=1200",
        "download_url": f"https://nb.scene7.com/is/image/NB/MR530SG_nb_{position:02d}_i?$pdpflexf2$&wid=1600&hei=1200",
        "local_file": f"catalog-media/intake/official-brand/new-balance/new-balance-530-white-silver-navy-mr530sg/{position:02d}.jpg",
        "sha256": digest,
        "provider": "new-balance-official-product-image",
        "source_view": view,
    }
    for position, digest, view in (
        (2, "d0abc256b3df6872e2bccb18cbda65c34b508a44b6177fe932e7f42457fb5c3e", "official 02 direct side"),
        (3, "f296a43c2bf55b16f98c2b77efd4ad974c279fe1b299d5975e02181d606ef1eb", "official 03 true opposite side"),
        (4, "18047726ea0a7d7375ff2eb8cb7becdb33057da1a43e451fb167bc20d75120f1", "official 04 front-three-quarter reference"),
        (6, "99d631019d942250463428839d4de68ac8bf03ef261b52476db4fdea391487eb", "official 06 sole reference"),
    )
]

BATCH_EIGHT_MR530_POIZON_REFERENCES = [
    {
        "asset_url": "https://www.poizon.com/",
        "download_url": "https://www.poizon.com/",
        "local_file": (
            "catalog-media/intake/poizon-pages/new-balance-530-white-silver-navy-mr530sg/"
            f"poizon-product-{position:02d}.webp"
        ),
        "sha256": digest,
        "provider": "poizon-public-product-image",
        "source_view": f"licensed Poizon exact MR530SG reference {position:02d}",
    }
    for position, digest in (
        (1, "b3b7b17a5644227a55a60f655603ebe919696c93c86846d8e8884908412c0df9"),
        (2, "4294bf2987ee8ea436e22da8ce1126c0bfb59bc0f221e21d4942066d8f86c346"),
        (3, "c48e76564a8a3270691828784ea9a085b03c6d058a1062870e1271b1b9edfbb9"),
        (4, "4123846b26cbc1c249acd4d691c07fc9b54e7bf48aa9be4c53954b717d0caf1c"),
        (5, "fe1c86477ad217d573fccb72c2cae5048bcbb152dd7d068a41a8ca484c5c905c"),
    )
]

BATCH_EIGHT_SAMBA_REAR_REFERENCES = batch_eight_adidas_official_references(
    product_url=_B8_ADIDAS_SAMBA_URL,
    source_dir="adidas-samba-og-white-black-b75806",
    references=(
        (1, "e68282a334035bc9b947c6220a50cf20aeb2cf01fc4f34cd73e926ca802b02db", "official 01 direct side"),
        (4, "12f4a4a8514406fe47c278c42bdd1ba69488bd6b663d3da6f2c117dab139bf2d", "official 04 pair reference"),
        (5, "de23f7103a346c9a6ebd355af3624710cdbbb5597beb2aa3e41b0ed1ab7ef20c", "official 05 rear-three-quarter reference"),
        (6, "986acc66689c04a0828d9fabb23a2cfb7b54b2de4b404c43224f6aeafcf0d34d", "official 06 opposite side"),
    ),
) + [
    {
        "asset_url": "https://www.poizon.com/",
        "download_url": "https://www.poizon.com/",
        "local_file": "catalog-media/intake/poizon-pages/adidas-samba-og-white-black-b75806/poizon-03.jpg",
        "sha256": "68457d5c170482e834a441ae89542afa856dea40d2231b1964dc5103e06315b2",
        "provider": "poizon-public-product-image",
        "source_view": "licensed Poizon exact B75806 rear reference",
    }
]

BATCH_EIGHT_GAZELLE_REAR_REFERENCES = batch_eight_adidas_official_references(
    product_url=_B8_ADIDAS_GAZELLE_URL,
    source_dir="adidas-gazelle-indoor-green-ji2062",
    references=(
        (1, "9345b454f0ee7c7fdf76d4e58414b0eb5a8cfac24de7ff6aa60496e406189545", "official 01 direct side"),
        (3, "61c3ca55e8b99c840e00fffe4b2b5e67debbc27cc0ad98cd6645f38f7a86711c", "official 03 sole reference"),
        (5, "78efe02e68c2312c05ca6053b74f99f9be71d2a43ce9696bbb7a5361de5007c4", "official 05 rear-three-quarter reference"),
        (6, "ebc94cb9fea5a5d2466cf1c5b8378842d186332e6c124158ae8bedb45a1b8e91", "official 06 opposite side"),
        (8, "92acb390e917a5345fe4954617ed8684e49328c1f8115a77b36ee4e56a4eb283", "official 08 pair reference"),
    ),
)

BATCH_EIGHT_CAMPUS_REAR_REFERENCES = batch_eight_adidas_official_references(
    product_url=_B8_ADIDAS_CAMPUS_URL,
    source_dir="adidas-campus-00s-core-black-hq8708",
    references=(
        (1, "d4f669a73255296355fc62d25b469b95f30310049557dc0f9649529015b58464", "official 01 direct side"),
        (3, "b6ab4072664e46d4c8d974bedff39dbcf2a4fdb5664a8e5d37f6dc93a646da3f", "official 03 sole reference"),
        (4, "bd249d36befa6ad76852ef903fe393e68efd6da4ea14792389ae3474a6ba34be", "official 04 pair reference"),
        (5, "444a18680012a92de135481e76ed87e551e444f9b03f105d492bfb36cfb379f4", "official 05 rear-three-quarter reference"),
        (6, "4327a7e6987dff33f885465b33c47373abe4270bb2f2e7b2422b41f4f5d5b143", "official 06 opposite side"),
    ),
)

BATCH_EIGHT_GENERATED_PROVENANCE: dict[tuple[str, int], dict[str, Any]] = {
    ("new-balance-530-white-silver-navy", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "64c1ce0f05e5399cebadee85f65f9acd8ec0fe6ac494379a05d5d5922bbaff2f",
        "generator": (
            "OpenAI gpt-image-2 unmirrored complete front-three-quarter pair from "
            "the locked exact New Balance MR530SG reference set, followed only by "
            "scripts/build_batch8_mr530_label_corrections.py exact official ABZORB glyph repair"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "new-balance-official-product-image",
        "source_reference_role": "generated-complete-unmirrored-pair-from-locked-exact-reference",
        "source_references": BATCH_EIGHT_MR530_REFERENCES + [
            {
                "asset_url": _B8_NB_PRODUCT_URL,
                "download_url": _B8_NB_PRODUCT_URL,
                "local_file": "catalog-media/intake/official-brand/new-balance/new-balance-530-white-silver-navy-mr530sg/02-label-reference.jpg",
                "sha256": "e3c31b9eac4df2b2b949f349b0814d403b3ce13d18f16f9bb2b69463fce10eb5",
                "provider": "new-balance-official-product-image",
                "source_view": "official native-resolution ABZORB glyph reference",
            }
        ],
    },
    ("new-balance-530-white-silver-navy", 4): {
        "kind": "project-generated-derivative",
        "generated_sha256": "9f04d36ad2663d4f8e3631445b387e73dc33a4e97016e0d7703c5a87a9c08dd9",
        "generator": (
            "OpenAI gpt-image-2 true-rear single reconstruction from the locked "
            "exact New Balance MR530SG official and licensed Poizon reference set"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "new-balance-official-and-poizon-product-image",
        "source_reference_role": "generated-true-rear-single-from-locked-exact-reference",
        "source_references": BATCH_EIGHT_MR530_REFERENCES + BATCH_EIGHT_MR530_POIZON_REFERENCES,
    },
    ("adidas-samba-og-white-black", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "398e48419d61e250fbf7013cf757885c804b24f5ea208902a7cb04b35a85a3e0",
        "generator": (
            "scripts/build_batch8_footwear_derivatives.py deterministic complete "
            "unmirrored pair composite from two distinct exact B75806 sources"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "adidas-official-and-poizon-product-image",
        "source_reference_role": "direct-derived-unmirrored-complete-pair-composite",
        "source_references": [
            {
                "asset_url": _B8_ADIDAS_SAMBA_URL,
                "download_url": _B8_ADIDAS_SAMBA_URL,
                "local_file": "catalog-media/intake/official-brand/adidas/adidas-samba-og-white-black-b75806/04.jpg",
                "sha256": "12f4a4a8514406fe47c278c42bdd1ba69488bd6b663d3da6f2c117dab139bf2d",
                "provider": "adidas-official-product-image",
                "source_view": "official 04 pair input",
            },
            {
                "asset_url": "https://www.poizon.com/",
                "download_url": "https://www.poizon.com/",
                "local_file": "catalog-media/intake/poizon-pages/adidas-samba-og-white-black-b75806/poizon-03.jpg",
                "sha256": "68457d5c170482e834a441ae89542afa856dea40d2231b1964dc5103e06315b2",
                "provider": "poizon-public-product-image",
                "source_view": "licensed Poizon exact B75806 opposite view",
            },
        ],
    },
    ("adidas-samba-og-white-black", 4): {
        "kind": "project-generated-derivative",
        "generated_sha256": "bc03949ecd1841c738325875276c73e83f6ce1d2ddb47b95fb9736eb82a94b34",
        "generator": (
            "OpenAI gpt-image-2 strict true-rear single reconstruction from the locked "
            "exact adidas B75806 official and licensed Poizon reference set"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "adidas-official-and-poizon-product-image",
        "source_reference_role": "generated-true-rear-single-from-locked-exact-reference",
        "source_references": BATCH_EIGHT_SAMBA_REAR_REFERENCES,
    },
    ("adidas-gazelle-indoor-green", 3): {
        "kind": "project-generated-derivative",
        "generated_sha256": "8ccd32502b3eb2950d1422dedc4ad7e6575b69d9b90d9e2529596dc99d90c292",
        "generator": (
            "scripts/build_batch8_footwear_derivatives.py deterministic crop and "
            "reframe of the locked exact JI2062 official pair; only detached spare laces excluded"
        ),
        "source_provider": "adidas-official-product-image",
        "reference_provider": "adidas-official-product-image",
        "source_reference_role": "direct-derived-complete-pair-reframe",
        "source_references": [
            {
                "asset_url": _B8_ADIDAS_GAZELLE_URL,
                "download_url": _B8_ADIDAS_GAZELLE_URL,
                "local_file": "catalog-media/intake/official-brand/adidas/adidas-gazelle-indoor-green-ji2062/08.jpg",
                "sha256": "92acb390e917a5345fe4954617ed8684e49328c1f8115a77b36ee4e56a4eb283",
                "provider": "adidas-official-product-image",
                "source_view": "official 08 full pair with detached spare laces",
            }
        ],
    },
    ("adidas-gazelle-indoor-green", 4): {
        "kind": "project-generated-derivative",
        "generated_sha256": "10974e654702e457a0b6bef210835efe51543122f86b8aa4f27c7aa6f5c8d194",
        "generator": (
            "OpenAI gpt-image-2 strict true-rear single reconstruction from the locked "
            "exact adidas JI2062 official reference set"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "adidas-official-product-image",
        "source_reference_role": "generated-true-rear-single-from-locked-exact-reference",
        "source_references": BATCH_EIGHT_GAZELLE_REAR_REFERENCES,
    },
    ("adidas-campus-00s-core-black", 4): {
        "kind": "project-generated-derivative",
        "generated_sha256": "bac933e6cac79455b4edca5a7aff0e4b5c7733ff4e1d2d0b49629a846a0b3127",
        "generator": (
            "OpenAI gpt-image-2 strict true-rear single reconstruction from the locked "
            "exact adidas HQ8708 official reference set"
        ),
        "source_provider": "kicksbase-generated-reference",
        "reference_provider": "adidas-official-product-image",
        "source_reference_role": "generated-true-rear-single-from-locked-exact-reference",
        "source_references": BATCH_EIGHT_CAMPUS_REAR_REFERENCES,
    },
}


@dataclass(frozen=True)
class FrameSpec:
    role: str
    angle: str
    composition: str
    target_width: int | None = None
    target_height: int | None = None
    max_width: int = 1280
    max_height: int = 960
    rotate_portrait: bool = False
    min_scale: float = 0.85
    max_scale: float = 1.06
    cohort_tolerance: float | None = None


PROFILE_SPECS: dict[str, tuple[FrameSpec, ...]] = {
    "footwear": (
        FrameSpec("primary", "side", "single", target_width=1184, max_height=760, cohort_tolerance=0.25),
        FrameSpec("gallery", "opposite-side", "single", target_width=1120, max_height=760, cohort_tolerance=0.25),
        FrameSpec("gallery", "three-quarter", "pair", target_width=1184, max_height=760, cohort_tolerance=0.25),
        FrameSpec("gallery", "rear", "single-or-pair", target_height=760, max_width=1184, cohort_tolerance=0.10),
        FrameSpec("gallery", "sole", "single-or-pair", target_height=840, max_width=1152, rotate_portrait=True, min_scale=0.90, cohort_tolerance=0.16),
    ),
    "kd18-f3-footwear-v1": (
        FrameSpec("primary", "side", "single", target_width=1184, max_height=760, cohort_tolerance=0.25),
        FrameSpec("gallery", "opposite-side", "single", target_width=1120, max_height=760, cohort_tolerance=0.25),
        FrameSpec("gallery", "three-quarter", "pair", target_width=925, max_height=500),
        FrameSpec("gallery", "rear", "single-or-pair", target_height=760, max_width=1184, cohort_tolerance=0.12),
        FrameSpec("gallery", "sole", "single-or-pair", target_height=840, max_width=1152, rotate_portrait=True, min_scale=0.90, cohort_tolerance=0.25),
    ),
    "tall-kd18-f3-footwear-v1": (
        FrameSpec("primary", "side", "single", target_width=1184, max_height=760),
        FrameSpec("gallery", "opposite-side", "single", target_width=1120, max_height=760),
        FrameSpec("gallery", "three-quarter", "pair", target_width=925, max_height=680),
        FrameSpec("gallery", "rear", "single-or-pair", target_height=760, max_width=1184, cohort_tolerance=0.10),
        FrameSpec("gallery", "sole", "single-or-pair", target_height=840, max_width=1152, rotate_portrait=True, min_scale=0.90, cohort_tolerance=0.16),
    ),
    "slide": (
        FrameSpec("primary", "side", "single-or-pair", target_width=1088, max_height=720),
        FrameSpec("gallery", "opposite-side", "single-or-pair", target_width=1040, max_height=720),
        FrameSpec("gallery", "three-quarter", "pair", target_width=1056, max_height=760),
        FrameSpec("gallery", "rear", "pair", target_width=960, max_height=780),
        FrameSpec("gallery", "sole", "single-or-pair", target_width=1000, max_height=780),
    ),
    "strict-footwear-v1": (
        FrameSpec("primary", "side", "single", target_width=940, max_height=760),
        FrameSpec("gallery", "three-quarter", "single", target_width=960, max_height=760),
        FrameSpec("gallery", "three-quarter", "pair", target_width=925, max_height=500),
        FrameSpec("gallery", "rear", "pair", target_height=680, max_width=1000, cohort_tolerance=0.14),
        FrameSpec("gallery", "sole", "single", target_width=985, max_height=680),
    ),
    "strict-slide-v1": (
        FrameSpec("primary", "side", "single", target_width=940, max_height=720),
        FrameSpec("gallery", "three-quarter", "single", target_width=1040, max_height=720),
        FrameSpec("gallery", "three-quarter", "pair", target_width=1040, max_height=760),
        FrameSpec("gallery", "rear", "pair", target_width=860, max_height=720),
        FrameSpec("gallery", "sole", "single", target_width=960, max_height=680),
    ),
    "wide-strict-slide-v1": (
        FrameSpec("primary", "side", "single", target_width=1088, max_height=720),
        FrameSpec("gallery", "three-quarter", "single", target_width=1040, max_height=720),
        FrameSpec("gallery", "three-quarter", "pair", target_width=1040, max_height=760),
        FrameSpec("gallery", "rear", "pair", target_width=860, max_height=720),
        FrameSpec("gallery", "sole", "single", target_width=960, max_height=680),
    ),
    "kd18-strict-slide-v1": (
        FrameSpec("primary", "side", "single", target_width=940, max_height=720),
        FrameSpec("gallery", "three-quarter", "single", target_width=1040, max_height=720),
        FrameSpec("gallery", "three-quarter", "pair", target_width=925, max_height=500),
        FrameSpec("gallery", "rear", "pair", target_width=860, max_height=720),
        FrameSpec("gallery", "sole", "single", target_width=960, max_height=680),
    ),
    "apparel-top": (
        FrameSpec("primary", "front", "single", target_height=900, max_width=1040),
        FrameSpec("gallery", "rear", "single", target_height=900, max_width=1040),
        FrameSpec("gallery", "alternate-front", "single", target_height=860, max_width=1040),
        FrameSpec("gallery", "side", "single", target_height=840, max_width=940),
        FrameSpec("gallery", "detail", "single-detail", target_width=840, max_height=760),
    ),
    "apparel-outerwear": (
        FrameSpec("primary", "front", "single", target_height=900, max_width=1040),
        FrameSpec("gallery", "rear", "single", target_height=900, max_width=1040),
        FrameSpec("gallery", "alternate-front", "single", target_height=860, max_width=1040),
        FrameSpec("gallery", "side", "single", target_height=840, max_width=940),
        FrameSpec("gallery", "detail", "single-detail", target_width=840, max_height=760),
    ),
    "apparel-shorts": (
        FrameSpec("primary", "front", "single", target_height=800, max_width=1040),
        FrameSpec("gallery", "rear", "single", target_height=800, max_width=1040),
        FrameSpec("gallery", "alternate-front", "single", target_height=780, max_width=1040),
        FrameSpec("gallery", "side", "single", target_height=780, max_width=900),
        FrameSpec("gallery", "detail", "single-detail", target_width=820, max_height=720),
    ),
    "apparel-pants": (
        FrameSpec("primary", "front", "single", target_height=920, max_width=820),
        FrameSpec("gallery", "rear", "single", target_height=920, max_width=820),
        FrameSpec("gallery", "alternate-front", "single", target_height=900, max_width=820),
        FrameSpec("gallery", "side", "single", target_height=900, max_width=720),
        FrameSpec("gallery", "detail", "single-detail", target_width=780, max_height=760),
    ),
    "ball": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_height=780, max_width=880)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
    "basketball": (
        FrameSpec("primary", "three-quarter", "single", target_height=780, max_width=880),
        FrameSpec("gallery", "front", "single", target_height=780, max_width=880),
        FrameSpec("gallery", "rear", "single", target_height=780, max_width=880),
        FrameSpec("gallery", "detail", "single", target_height=780, max_width=880),
        FrameSpec("gallery", "detail", "single", target_height=780, max_width=880),
    ),
    "bag": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_width=1000, max_height=820)
        for index, angle in enumerate(("three-quarter", "side", "rear", "front", "detail"))
    ),
    "protection": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single-or-pair", target_height=840, max_width=1040)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
    "socks": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single-or-set", target_height=840, max_width=1040)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
    "bottle": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_height=840, max_width=760)
        for index, angle in enumerate(("front", "alternate", "rear", "top", "detail"))
    ),
    "recovery": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single-or-set", target_width=960, max_height=840)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
    "headwear": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_width=900, max_height=820)
        for index, angle in enumerate(("three-quarter", "side", "rear", "underside", "detail"))
    ),
    "small-accessory": tuple(
        FrameSpec("primary" if index == 0 else "gallery", angle, "single", target_width=820, max_height=760)
        for index, angle in enumerate(("front", "alternate", "rear", "side", "detail"))
    ),
}


def media_profile(slug: str) -> str:
    if slug in STRICT_FOOTWEAR_V1_SLUGS:
        return "strict-footwear-v1"
    if slug in WIDE_STRICT_SLIDE_V1_SLUGS:
        return "wide-strict-slide-v1"
    if slug in KD18_STRICT_SLIDE_V1_SLUGS:
        return "kd18-strict-slide-v1"
    if slug in STRICT_SLIDE_V1_SLUGS:
        return "strict-slide-v1"
    if slug in KD18_F3_FOOTWEAR_SLUGS:
        return "kd18-f3-footwear-v1"
    if slug in TALL_KD18_F3_FOOTWEAR_SLUGS:
        return "tall-kd18-f3-footwear-v1"
    if slug == "wilson-evo-nxt-basketball":
        return "basketball"
    cohorts = (
        (SLIDES, "slide"),
        (APPAREL_TOPS, "apparel-top"),
        (APPAREL_OUTERWEAR, "apparel-outerwear"),
        (APPAREL_SHORTS, "apparel-shorts"),
        (APPAREL_PANTS, "apparel-pants"),
        (BALLS, "ball"),
        (BAGS, "bag"),
        (PROTECTION, "protection"),
        (SOCKS, "socks"),
        (BOTTLES, "bottle"),
        (RECOVERY, "recovery"),
        (HEADWEAR, "headwear"),
    )
    for slugs, profile in cohorts:
        if slug in slugs:
            return profile
    return "footwear"


def active_paths(slug: str) -> tuple[Path, ...]:
    if slug in APPROVED_SLUGS:
        root = APPROVED_PRODUCTS / slug
        return (
            root / "01-side.png",
            root / "03-side.png",
            root / "02-three-quarter.png",
            root / "04-rear.png",
            root / "05-sole.png",
        )
    return (
        CATALOG / f"{slug}.webp",
        CATALOG / "gallery" / f"{slug}-2.webp",
        CATALOG / "gallery" / f"{slug}-3.webp",
        CATALOG / "gallery" / f"{slug}-4.webp",
        CATALOG / "gallery" / f"{slug}-5.webp",
    )


@lru_cache(maxsize=1)
def approved_poizon_replacements() -> dict[str, dict[int, dict[str, Any]]]:
    """Return explicitly reviewed active-to-source Poizon frame replacements."""

    if not POIZON_INTAKE_MANIFEST.is_file():
        return {}
    try:
        payload = json.loads(POIZON_INTAKE_MANIFEST.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Invalid Poizon intake manifest: {POIZON_INTAKE_MANIFEST}") from error
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        raise RuntimeError(f"Poizon intake manifest must use schema_version 1: {POIZON_INTAKE_MANIFEST}")

    result: dict[str, dict[int, dict[str, Any]]] = {}
    products = payload.get("products")
    if not isinstance(products, list):
        raise RuntimeError(f"Poizon intake manifest products must be an array: {POIZON_INTAKE_MANIFEST}")
    for product in products:
        if not isinstance(product, dict) or product.get("qa", {}).get("status") != "approved":
            continue
        slug = product.get("slug")
        frames = product.get("frames")
        if not isinstance(slug, str) or not isinstance(frames, list):
            raise RuntimeError("Approved Poizon intake entries need slug and frames")
        source_frames: dict[int, dict[str, Any]] = {}
        for frame in frames:
            if not isinstance(frame, dict):
                raise RuntimeError(f"{slug}: Poizon intake frame must be an object")
            position = frame.get("position")
            local_file = frame.get("local_file")
            expected_hash = frame.get("sha256")
            if (
                not isinstance(position, int)
                or isinstance(position, bool)
                or position < 1
                or position > 20
                or not isinstance(local_file, str)
                or not isinstance(expected_hash, str)
            ):
                raise RuntimeError(f"{slug}: Poizon intake frame metadata is incomplete")
            path = (ROOT / local_file).resolve()
            try:
                path.relative_to(ROOT.resolve())
            except ValueError as error:
                raise RuntimeError(f"{slug}: Poizon intake source escapes the project root") from error
            if not path.is_file() or sha256_file(path) != expected_hash:
                raise RuntimeError(f"{slug}: Poizon intake source is missing or no longer matches its hash")
            if position in source_frames:
                raise RuntimeError(f"{slug}: Poizon intake has duplicate frame {position}")
            source_frames[position] = {**frame, "path": path, "product": product}
        minimum_source_frames = 4 if slug in BATCH_THREE_FOUR_FRAME_INTAKE_SLUGS else 5
        if len(source_frames) < minimum_source_frames:
            raise RuntimeError(
                f"{slug}: Approved Poizon intake requires at least {minimum_source_frames} source frames"
            )
        activation = product.get("activation")
        source_positions = activation.get("source_positions") if isinstance(activation, dict) else None
        if not isinstance(source_positions, dict) or not source_positions:
            raise RuntimeError(f"{slug}: Approved Poizon intake requires explicit activation.source_positions")
        replacements: dict[int, dict[str, Any]] = {}
        for active_raw, source_position in source_positions.items():
            try:
                active_position = int(active_raw)
            except (TypeError, ValueError) as error:
                raise RuntimeError(f"{slug}: active Poizon replacement position is invalid") from error
            if active_position not in {1, 2, 3, 4, 5}:
                raise RuntimeError(f"{slug}: active Poizon replacement position must be between 1 and 5")
            if active_position == 2 and slug not in DIRECT_SOURCE_FRAME_TWO_REPLACEMENT_SLUGS:
                raise RuntimeError(f"{slug}: frame two must stay owner-preserved and cannot be replaced")
            if source_position not in source_frames:
                raise RuntimeError(f"{slug}: active frame {active_position} references an unavailable Poizon source frame")
            if active_position in replacements:
                raise RuntimeError(f"{slug}: approved Poizon activation has duplicate active frame {active_position}")
            replacements[active_position] = source_frames[source_position]
        result[slug] = replacements
    return result


def source_paths(slug: str) -> tuple[Path, ...]:
    paths = list(active_paths(slug))
    overrides = {
        1: GENERATED_OVERRIDES / f"{slug}-opposite-side.png",
        2: GENERATED_OVERRIDES / f"{slug}-front.png",
        3: GENERATED_OVERRIDES / f"{slug}-rear.png",
        4: GENERATED_OVERRIDES / f"{slug}-sole.png",
    }
    for index, override in overrides.items():
        if override.is_file():
            paths[index] = override
    front_pair = FRONT_PAIR_OVERRIDES / f"{slug}-front-three-quarter-pair.webp"
    if slug in FRONT_PAIR_OVERRIDE_SLUGS and front_pair.is_file():
        paths[2] = front_pair
    # An approved activation map binds only reviewer-verified direct source
    # angles to active gallery roles. Frame two changes only for explicit
    # audited exceptions above.
    poizon = approved_poizon_replacements().get(slug)
    if poizon:
        for position, source in poizon.items():
            paths[position - 1] = source["path"]
    for position, override in BATCH_TWO_GENERATED_OVERRIDES.get(slug, {}).items():
        if not override.is_file():
            raise RuntimeError(f"{slug}: approved generated B2 source is missing: {override}")
        paths[position - 1] = override
    for position, override in BATCH_THREE_GENERATED_OVERRIDES.get(slug, {}).items():
        if not override.is_file():
            raise RuntimeError(f"{slug}: approved generated B3 source is missing: {override}")
        paths[position - 1] = override
    for position, override in BATCH_FOUR_GENERATED_OVERRIDES.get(slug, {}).items():
        metadata = BATCH_FOUR_GENERATED_PROVENANCE.get((slug, position))
        if not override.is_file() or not metadata:
            raise RuntimeError(f"{slug}: approved generated B4 source is missing: {override}")
        if sha256_file(override) != metadata["generated_sha256"]:
            raise RuntimeError(f"{slug}: approved generated B4 source no longer matches its hash")
        paths[position - 1] = override
    for position, override in BATCH_FIVE_GENERATED_OVERRIDES.get(slug, {}).items():
        metadata = BATCH_FIVE_GENERATED_PROVENANCE.get((slug, position))
        if not override.is_file() or not metadata:
            raise RuntimeError(f"{slug}: approved generated B5 source is missing: {override}")
        if sha256_file(override) != metadata["generated_sha256"]:
            raise RuntimeError(f"{slug}: approved generated B5 source no longer matches its hash")
        paths[position - 1] = override
    for position, override in BATCH_SIX_GENERATED_OVERRIDES.get(slug, {}).items():
        metadata = BATCH_SIX_GENERATED_PROVENANCE.get((slug, position))
        if not override.is_file() or not metadata:
            raise RuntimeError(f"{slug}: approved generated B6 source is missing: {override}")
        if sha256_file(override) != metadata["generated_sha256"]:
            raise RuntimeError(f"{slug}: approved generated B6 source no longer matches its hash")
        paths[position - 1] = override
    for position, override in BATCH_SEVEN_GENERATED_OVERRIDES.get(slug, {}).items():
        metadata = BATCH_SEVEN_GENERATED_PROVENANCE.get((slug, position))
        if not override.is_file() or not metadata:
            raise RuntimeError(f"{slug}: approved generated B7 source is missing: {override}")
        if sha256_file(override) != metadata["generated_sha256"]:
            raise RuntimeError(f"{slug}: approved generated B7 source no longer matches its hash")
        paths[position - 1] = override
    for position, override in BATCH_EIGHT_GENERATED_OVERRIDES.get(slug, {}).items():
        metadata = BATCH_EIGHT_GENERATED_PROVENANCE.get((slug, position))
        if not override.is_file() or not metadata:
            raise RuntimeError(f"{slug}: approved generated B8 source is missing: {override}")
        if sha256_file(override) != metadata["generated_sha256"]:
            raise RuntimeError(f"{slug}: approved generated B8 source no longer matches its hash")
        paths[position - 1] = override
    return tuple(paths)


def border_key(image: Image.Image) -> tuple[int, int, int]:
    width, height = image.size
    samples = (
        image.getpixel((0, 0)),
        image.getpixel((width - 1, 0)),
        image.getpixel((0, height - 1)),
        image.getpixel((width - 1, height - 1)),
    )
    return tuple(sorted(pixel[channel] for pixel in samples)[len(samples) // 2] for channel in range(3))


def subject_cutout(path: Path) -> Image.Image:
    with Image.open(path) as opened:
        opened.load()
        normalized = ImageOps.exif_transpose(opened)
        palette_normalization = BATCH_EIGHT_NIKE_SOLE_LANDSCAPE_NORMALIZATION.get(path.resolve())
        if "A" in normalized.getbands() or (
            palette_normalization is not None and "transparency" in normalized.info
        ):
            rgba = normalized.convert("RGBA")
            alpha = rgba.getchannel("A")
            # Some supplier PNGs declare an alpha channel but keep it fully opaque.
            # A handful carry only isolated transparent pixels, so require a
            # meaningful transparent area before trusting the alpha silhouette.
            transparent_pixels = sum(alpha.histogram()[:255])
            if transparent_pixels >= max(1, alpha.width * alpha.height // 100):
                if palette_normalization is not None and sha256_file(path) != palette_normalization["sha256"]:
                    raise RuntimeError("Batch 8 Nike sole source no longer matches its locked hash")
                bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
                if bbox is None:
                    raise RuntimeError(f"No product foreground found in {path}")
                return rgba.crop(bbox)
        rgb = normalized.convert("RGB")
    resolved_path = path.resolve()
    key = border_key(rgb)
    if (
        GENERATED_OVERRIDES in path.parents
        or FRONT_PAIR_OVERRIDES in path.parents
        or FINAL_SIX_FOOTWEAR_OVERRIDES in path.parents
        or BATCH_FOUR_OVERRIDES in path.parents
        or BATCH_FIVE_OVERRIDES in path.parents
        or BATCH_SIX_OVERRIDES in path.parents
        or BATCH_SEVEN_OVERRIDES in path.parents
        or BATCH_EIGHT_OVERRIDES in path.parents
    ):
        alpha = border_connected_background_alpha(rgb, tolerance=4)
    else:
        difference = ImageChops.difference(rgb, Image.new("RGB", rgb.size, key))
        maximum = ImageChops.lighter(
            ImageChops.lighter(difference.getchannel("R"), difference.getchannel("G")),
            difference.getchannel("B"),
        )
        vomero_expected_hash = BATCH_SEVEN_NIKE_VOMERO_5_CUTOUT_NORMALIZATION.get(resolved_path)
        timberland_normalization = TIMBERLAND_FIELD_BOOT_F2_CUTOUT_NORMALIZATION
        adidas_sole_normalization = BATCH_EIGHT_ADIDAS_SOLE_NORMALIZATION.get(resolved_path)
        if vomero_expected_hash is not None:
            if sha256_file(path) != vomero_expected_hash:
                raise RuntimeError("Nike Vomero 5 cutout source no longer matches its locked hash")
            tolerance = 16
        elif resolved_path == timberland_normalization["path"]:
            if sha256_file(path) != timberland_normalization["sha256"]:
                raise RuntimeError("Timberland F2 cutout source no longer matches its locked hash")
            tolerance = timberland_normalization["tolerance"]
        elif adidas_sole_normalization is not None:
            if sha256_file(path) != adidas_sole_normalization["sha256"]:
                raise RuntimeError("Batch 8 adidas sole source no longer matches its locked hash")
            tolerance = adidas_sole_normalization["tolerance"]
        else:
            tolerance = (
                16
                if resolved_path in BATCH_SIX_NIKE_DIRECT_CUTOUT_SOURCES
                else (8 if min(key) >= 250 else 3)
            )
        alpha = maximum.point(lambda value: 255 if value > tolerance else 0)
        alpha = alpha.filter(ImageFilter.GaussianBlur(0.45))
    cleanup = AIR_MAX_95_FIVE_GROUND_SHADOW_CLEANUP
    if resolved_path == cleanup["path"]:
        if sha256_file(path) != cleanup["sha256"]:
            raise RuntimeError("Air Max 95 F5 cleanup source no longer matches its locked hash")
        alpha.paste(0, (0, cleanup["trim_from_y"], rgb.width, rgb.height))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox is None:
        raise RuntimeError(f"No product foreground found in {path}")
    return rgba.crop(bbox)


def fit_subject(subject: Image.Image, spec: FrameSpec) -> Image.Image:
    if spec.rotate_portrait and subject.width > subject.height * 1.15:
        subject = subject.rotate(90, expand=True, resample=Image.Resampling.BICUBIC)
    if spec.target_width is not None:
        scale = spec.target_width / subject.width
    elif spec.target_height is not None:
        scale = spec.target_height / subject.height
    else:
        scale = 1.0
    scale = min(scale, spec.max_width / subject.width, spec.max_height / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    return subject.resize(size, Image.Resampling.LANCZOS)


def fit_locked_frame_subject(slug: str, position: int, source: Path, spec: FrameSpec) -> Image.Image:
    subject = subject_cutout(source)
    adidas_sole = BATCH_EIGHT_ADIDAS_SOLE_NORMALIZATION.get(source.resolve())
    if adidas_sole is not None:
        if sha256_file(source) != adidas_sole["sha256"] or position != 5:
            raise RuntimeError(f"{slug}: Batch 8 adidas sole source no longer matches its locked path/hash")
        rotation = adidas_sole["rotation_degrees"]
        if rotation:
            subject = subject.rotate(
                rotation,
                expand=True,
                resample=Image.Resampling.BICUBIC,
                fillcolor=(0, 0, 0, 0),
            )
    landscape = BATCH_EIGHT_NIKE_SOLE_LANDSCAPE_NORMALIZATION.get(source.resolve())
    if landscape is not None:
        if sha256_file(source) != landscape["sha256"] or position != 5:
            raise RuntimeError(f"{slug}: Batch 8 Nike sole source no longer matches its locked path/hash")
        spec = FrameSpec(
            spec.role,
            spec.angle,
            spec.composition,
            target_width=1152,
            max_height=760,
        )
    fitted = fit_subject(subject, spec)
    normalization = BATCH_SEVEN_FRAME_SCALE_NORMALIZATION.get((slug, position))
    if normalization is None:
        return fitted
    if source.resolve() != normalization["path"] or sha256_file(source) != normalization["sha256"]:
        raise RuntimeError(f"{slug}: Batch 7 scale source no longer matches its locked path/hash")
    multiplier = normalization["multiplier"]
    return fitted.resize(
        (round(fitted.width * multiplier), round(fitted.height * multiplier)),
        Image.Resampling.LANCZOS,
    )


def render(subject: Image.Image) -> Image.Image:
    if subject.width > 1280 or subject.height > 960:
        raise RuntimeError(f"Subject {subject.size} violates the 160x120 safe inset")
    canvas = Image.new("RGB", CANVAS_SIZE, BACKGROUND)
    offset = ((CANVAS_SIZE[0] - subject.width) // 2, (CANVAS_SIZE[1] - subject.height) // 2)
    canvas.paste(subject.convert("RGB"), offset, subject.getchannel("A"))
    return canvas


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    suffix = path.suffix.lower()
    with NamedTemporaryFile(suffix=suffix, dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        if suffix == ".png":
            image.save(temporary_path, "PNG", optimize=True, exif=b"")
        elif suffix == ".webp":
            image.save(
                temporary_path,
                "WEBP",
                lossless=True,
                method=6,
                exact=True,
                exif=b"",
                icc_profile=None,
            )
        else:
            raise RuntimeError(f"Unsupported output format: {path}")
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def verified_batch_four_source_references(metadata: dict[str, Any]) -> list[dict[str, str]]:
    references = metadata.get("source_references")
    if not isinstance(references, list) or not references:
        raise RuntimeError("Batch 4 generated source has no locked source references")
    verified: list[dict[str, str]] = []
    for reference in references:
        if not isinstance(reference, dict):
            raise RuntimeError("Batch 4 generated source reference must be an object")
        asset_url = reference.get("asset_url")
        local_file = reference.get("local_file")
        digest = reference.get("sha256")
        provider = reference.get("provider")
        source_view = reference.get("source_view")
        if not all(isinstance(value, str) and value for value in (asset_url, local_file, digest, provider, source_view)):
            raise RuntimeError("Batch 4 generated source reference metadata is incomplete")
        if not asset_url.startswith("https://"):
            raise RuntimeError("Batch 4 generated source reference must use HTTPS")
        path = (ROOT / local_file).resolve()
        try:
            path.relative_to(ROOT.resolve())
        except ValueError as error:
            raise RuntimeError("Batch 4 generated source reference escapes the project root") from error
        if not path.is_file() or sha256_file(path) != digest:
            raise RuntimeError("Batch 4 generated source reference no longer matches its hash")
        verified.append(
            {
                "asset_url": asset_url,
                "local_file": local_file,
                "sha256": digest,
                "provider": provider,
                "source_view": source_view,
            }
        )
    return verified


def verified_batch_five_source_references(metadata: dict[str, Any]) -> list[dict[str, str]]:
    references = metadata.get("source_references")
    if not isinstance(references, list) or not references:
        raise RuntimeError("Batch 5 generated source has no locked source references")
    verified: list[dict[str, str]] = []
    for reference in references:
        if not isinstance(reference, dict):
            raise RuntimeError("Batch 5 generated source reference must be an object")
        asset_url = reference.get("asset_url")
        download_url = reference.get("download_url")
        local_file = reference.get("local_file")
        digest = reference.get("sha256")
        provider = reference.get("provider")
        source_view = reference.get("source_view")
        if not all(
            isinstance(value, str) and value
            for value in (asset_url, download_url, local_file, digest, provider, source_view)
        ):
            raise RuntimeError("Batch 5 generated source reference metadata is incomplete")
        if not asset_url.startswith("https://") or not download_url.startswith("https://"):
            raise RuntimeError("Batch 5 generated source reference must use HTTPS")
        path = (ROOT / local_file).resolve()
        try:
            path.relative_to(ROOT.resolve())
        except ValueError as error:
            raise RuntimeError("Batch 5 generated source reference escapes the project root") from error
        if not path.is_file() or sha256_file(path) != digest:
            raise RuntimeError("Batch 5 generated source reference no longer matches its hash")
        verified.append(
            {
                "asset_url": asset_url,
                "download_url": download_url,
                "local_file": local_file,
                "sha256": digest,
                "provider": provider,
                "source_view": source_view,
            }
        )
    return verified


def verified_batch_six_source_references(metadata: dict[str, Any]) -> list[dict[str, str]]:
    references = metadata.get("source_references")
    if not isinstance(references, list) or not references:
        raise RuntimeError("Batch 6 generated source has no locked source references")
    verified: list[dict[str, str]] = []
    for reference in references:
        if not isinstance(reference, dict):
            raise RuntimeError("Batch 6 generated source reference must be an object")
        asset_url = reference.get("asset_url")
        download_url = reference.get("download_url")
        local_file = reference.get("local_file")
        digest = reference.get("sha256")
        provider = reference.get("provider")
        source_view = reference.get("source_view")
        if not all(
            isinstance(value, str) and value
            for value in (asset_url, download_url, local_file, digest, provider, source_view)
        ):
            raise RuntimeError("Batch 6 generated source reference metadata is incomplete")
        if not asset_url.startswith("https://") or not download_url.startswith("https://"):
            raise RuntimeError("Batch 6 generated source reference must use HTTPS")
        path = (ROOT / local_file).resolve()
        try:
            path.relative_to(ROOT.resolve())
        except ValueError as error:
            raise RuntimeError("Batch 6 generated source reference escapes the project root") from error
        if not path.is_file() or sha256_file(path) != digest:
            raise RuntimeError("Batch 6 generated source reference no longer matches its hash")
        verified.append(
            {
                "asset_url": asset_url,
                "download_url": download_url,
                "local_file": local_file,
                "sha256": digest,
                "provider": provider,
                "source_view": source_view,
            }
        )
    return verified


def verified_batch_seven_source_references(metadata: dict[str, Any]) -> list[dict[str, str]]:
    references = metadata.get("source_references")
    if not isinstance(references, list) or not references:
        raise RuntimeError("Batch 7 generated source has no locked source references")
    verified: list[dict[str, str]] = []
    for reference in references:
        if not isinstance(reference, dict):
            raise RuntimeError("Batch 7 generated source reference must be an object")
        asset_url = reference.get("asset_url")
        download_url = reference.get("download_url")
        local_file = reference.get("local_file")
        digest = reference.get("sha256")
        provider = reference.get("provider")
        source_view = reference.get("source_view")
        if not all(
            isinstance(value, str) and value
            for value in (asset_url, download_url, local_file, digest, provider, source_view)
        ):
            raise RuntimeError("Batch 7 generated source reference metadata is incomplete")
        if not asset_url.startswith("https://") or not download_url.startswith("https://"):
            raise RuntimeError("Batch 7 generated source reference must use HTTPS")
        path = (ROOT / local_file).resolve()
        try:
            path.relative_to(ROOT.resolve())
        except ValueError as error:
            raise RuntimeError("Batch 7 generated source reference escapes the project root") from error
        if not path.is_file() or sha256_file(path) != digest:
            raise RuntimeError("Batch 7 generated source reference no longer matches its hash")
        verified.append(
            {
                "asset_url": asset_url,
                "download_url": download_url,
                "local_file": local_file,
                "sha256": digest,
                "provider": provider,
                "source_view": source_view,
            }
        )
    return verified


def verified_batch_eight_source_references(metadata: dict[str, Any]) -> list[dict[str, str]]:
    references = metadata.get("source_references")
    if not isinstance(references, list) or not references:
        raise RuntimeError("Batch 8 generated source has no locked source references")
    verified: list[dict[str, str]] = []
    for reference in references:
        if not isinstance(reference, dict):
            raise RuntimeError("Batch 8 generated source reference must be an object")
        asset_url = reference.get("asset_url")
        download_url = reference.get("download_url")
        local_file = reference.get("local_file")
        digest = reference.get("sha256")
        provider = reference.get("provider")
        source_view = reference.get("source_view")
        if not all(
            isinstance(value, str) and value
            for value in (asset_url, download_url, local_file, digest, provider, source_view)
        ):
            raise RuntimeError("Batch 8 generated source reference metadata is incomplete")
        if not asset_url.startswith("https://") or not download_url.startswith("https://"):
            raise RuntimeError("Batch 8 generated source reference must use HTTPS")
        path = (ROOT / local_file).resolve()
        try:
            path.relative_to(ROOT.resolve())
        except ValueError as error:
            raise RuntimeError("Batch 8 generated source reference escapes the project root") from error
        if not path.is_file() or sha256_file(path) != digest:
            raise RuntimeError("Batch 8 generated source reference no longer matches its hash")
        verified.append(
            {
                "asset_url": asset_url,
                "download_url": download_url,
                "local_file": local_file,
                "sha256": digest,
                "provider": provider,
                "source_view": source_view,
            }
        )
    return verified


def provenance(slug: str, position: int, source: Path) -> dict[str, object]:
    derivative_metadata: dict[str, Any] | None = None
    source_references: list[dict[str, str]] | None = None
    source_reference_role: str | None = None
    reference_provider: str | None = None
    source_view: str | None = None
    source_download_url: str | None = None
    source_product_url: str | None = None
    source_spu: str | None = None
    source_sku: str | None = None
    poizon_frame = approved_poizon_replacements().get(slug, {}).get(position)
    if poizon_frame and source.resolve() == poizon_frame["path"]:
        product = poizon_frame["product"]
        rights = product["rights"]
        source_provenance = poizon_frame.get("provenance")
        if not isinstance(source_provenance, dict):
            source_provenance = {}
        origin = source
        generator = source_provenance.get(
            "generator",
            "Poizon public product-page intake and KICKSBASE profile-aware normalizer",
        )
        origin_kind = source_provenance.get("kind", "poizon-original")
        if source.resolve() == AIR_MAX_95_FIVE_GROUND_SHADOW_CLEANUP["path"]:
            generator = (
                f"{generator}; deterministic cleanup removed only the locked P2 "
                "studio-ground-shadow matte at source rows y>=1206 before portrait rotation"
            )
        if source.resolve() == TIMBERLAND_FIELD_BOOT_F2_CUTOUT_NORMALIZATION["path"]:
            generator = (
                f"{generator}; deterministic locked ALT6 cutout normalization excluded only "
                "studio-background variance at or below threshold 4 before profile fit"
            )
        if source.resolve() in BATCH_SEVEN_NIKE_VOMERO_5_CUTOUT_NORMALIZATION:
            generator = (
                f"{generator}; deterministic locked HF7723-001 cutout normalization excluded only "
                "the verified nested Nike studio canvas at threshold 16 before profile fit"
            )
        if (slug, position) in BATCH_SEVEN_FRAME_SCALE_NORMALIZATION:
            generator = (
                f"{generator}; deterministic locked U9060GRY F2 profile fit enlarged the complete "
                "source by 1 percent to meet the footwear cohort scale floor without crop or recolor"
            )
        if source.resolve() in BATCH_EIGHT_NIKE_SOLE_LANDSCAPE_NORMALIZATION:
            generator = (
                f"{generator}; deterministic path/hash-locked Nike F5 profile fit preserved "
                "the official landscape sole orientation so its supplier shadow remains below the outsole"
            )
        if source.resolve() in BATCH_EIGHT_ADIDAS_SOLE_NORMALIZATION:
            generator = (
                f"{generator}; deterministic path/hash-locked adidas F5 normalization "
                "removed only the low-contrast studio shadow and aligned the complete tread upright"
            )
        license_reference = source_provenance.get("license_reference", rights["evidence_reference"])
        rights_status = source_provenance.get("rights_status", rights["status"])
        rights_verified_at = source_provenance.get("verified_at", rights["verified_at"])
        source_provider = poizon_frame.get("provider", product.get("source", {}).get("provider"))
        source_url = poizon_frame.get("asset_url")
        source_download_url = (
            poizon_frame.get("retrieval_url")
            if isinstance(poizon_frame.get("retrieval_url"), str)
            else None
        )
        source_view = poizon_frame.get("source_view") if isinstance(poizon_frame.get("source_view"), str) else None
        if isinstance(source_provenance.get("product_url"), str):
            source_product_url = source_provenance["product_url"]
        product_source = product.get("source")
        if source_product_url is None and isinstance(product_source, dict) and isinstance(product_source.get("product_url"), str):
            source_product_url = product_source["product_url"]
        identifiers = product.get("identifiers")
        if isinstance(identifiers, dict):
            source_spu = identifiers.get("spu") if isinstance(identifiers.get("spu"), str) else None
            source_sku = identifiers.get("sku") if isinstance(identifiers.get("sku"), str) else None
    elif FRONT_PAIR_OVERRIDES in source.parents:
        origin = source
        generator = "scripts/build_footwear_front_pair_overrides.py"
        origin_kind = "project-generated-derivative"
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-02T00:00:00Z"
        source_provider = "kicksbase-generated-reference"
        source_url = None
    elif FINAL_SIX_FOOTWEAR_OVERRIDES in source.parents:
        origin = source
        derivative_metadata = (
            BATCH_TWO_GENERATED_DERIVATIVES.get((slug, position))
            or BATCH_THREE_GENERATED_DERIVATIVES.get((slug, position))
        )
        is_batch_three_generated = (slug, position) in {
            (batch_slug, batch_position)
            for batch_slug, positions in BATCH_THREE_GENERATED_OVERRIDES.items()
            for batch_position in positions
        }
        generator = (
            derivative_metadata["generator"]
            if derivative_metadata
            else (
                "OpenAI image generation from the exact approved Batch 3 source set"
                if is_batch_three_generated
                else "OpenAI image generation from the exact approved Batch 2 source set"
            )
        )
        origin_kind = (
            derivative_metadata["kind"]
            if derivative_metadata
            else "project-generated-original"
        )
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-10T00:00:00Z"
        source_provider = (
            derivative_metadata["source_provider"]
            if derivative_metadata
            else "kicksbase-generated-reference"
        )
        source_url = derivative_metadata["source_url"] if derivative_metadata else None
    elif BATCH_FOUR_OVERRIDES in source.parents:
        metadata = BATCH_FOUR_GENERATED_PROVENANCE.get((slug, position))
        if not metadata:
            raise RuntimeError(f"{slug}: missing B4 generated provenance metadata for frame {position}")
        origin = source
        source_references = verified_batch_four_source_references(metadata)
        generator = metadata["generator"]
        origin_kind = metadata["kind"]
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-10T00:00:00Z"
        source_provider = metadata["source_provider"]
        source_url = None
        source_reference_role = metadata["source_reference_role"]
        reference_provider = metadata.get("reference_provider")
    elif BATCH_FIVE_OVERRIDES in source.parents:
        metadata = BATCH_FIVE_GENERATED_PROVENANCE.get((slug, position))
        if not metadata:
            raise RuntimeError(f"{slug}: missing B5 generated provenance metadata for frame {position}")
        origin = source
        source_references = verified_batch_five_source_references(metadata)
        generator = metadata["generator"]
        origin_kind = metadata["kind"]
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-10T00:00:00Z"
        source_provider = metadata["source_provider"]
        source_url = None
        source_reference_role = metadata["source_reference_role"]
        reference_provider = metadata.get("reference_provider")
    elif BATCH_SIX_OVERRIDES in source.parents:
        metadata = BATCH_SIX_GENERATED_PROVENANCE.get((slug, position))
        if not metadata:
            raise RuntimeError(f"{slug}: missing B6 generated provenance metadata for frame {position}")
        origin = source
        source_references = verified_batch_six_source_references(metadata)
        generator = metadata["generator"]
        origin_kind = metadata["kind"]
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-10T00:00:00Z"
        source_provider = metadata["source_provider"]
        source_url = None
        source_reference_role = metadata["source_reference_role"]
        reference_provider = metadata.get("reference_provider")
    elif BATCH_SEVEN_OVERRIDES in source.parents:
        metadata = BATCH_SEVEN_GENERATED_PROVENANCE.get((slug, position))
        if not metadata:
            raise RuntimeError(f"{slug}: missing B7 generated provenance metadata for frame {position}")
        origin = source
        source_references = verified_batch_seven_source_references(metadata)
        generator = metadata["generator"]
        origin_kind = metadata["kind"]
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-10T00:00:00Z"
        source_provider = metadata["source_provider"]
        source_url = None
        source_reference_role = metadata["source_reference_role"]
        reference_provider = metadata.get("reference_provider")
    elif BATCH_EIGHT_OVERRIDES in source.parents:
        metadata = BATCH_EIGHT_GENERATED_PROVENANCE.get((slug, position))
        if not metadata:
            raise RuntimeError(f"{slug}: missing B8 generated provenance metadata for frame {position}")
        origin = source
        source_references = verified_batch_eight_source_references(metadata)
        generator = metadata["generator"]
        origin_kind = metadata["kind"]
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-10T00:00:00Z"
        source_provider = metadata["source_provider"]
        source_url = None
        source_reference_role = metadata["source_reference_role"]
        reference_provider = metadata.get("reference_provider")
    elif GENERATED_OVERRIDES in source.parents:
        origin = source
        generator = "OpenAI image generation from the existing five-frame product reference set"
        origin_kind = "project-generated-original"
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-02T00:00:00Z"
        source_provider = "kicksbase-generated-reference"
        source_url = None
    elif slug in APPROVED_SLUGS:
        origin = APPROVED_MANIFEST
        generator = "KICKSBASE approved storefront media pipeline"
        origin_kind = "project-generated-original"
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-02T00:00:00Z"
        source_provider = "kicksbase-approved-storefront-media"
        source_url = None
    else:
        origin = CATALOG_GENERATOR
        generator = "scripts/generate_catalog_art.py"
        origin_kind = "project-generated-original"
        license_reference = f"KICKSBASE project-generated catalog media: {slug}:{position}"
        rights_status = "owned"
        rights_verified_at = "2026-08-02T00:00:00Z"
        source_provider = "kicksbase-generated-reference"
        source_url = None

    origin_hash_mode = hash_mode_for_path(origin)
    result: dict[str, object] = {
        "origin_kind": origin_kind,
        "origin_reference": origin.resolve().relative_to(ROOT.resolve()).as_posix(),
        "origin_hash_mode": origin_hash_mode,
        "origin_sha256": sha256_file(origin, mode=origin_hash_mode),
        "generator": generator,
        "rights": {
            "status": rights_status,
            "license_reference": license_reference,
            "verified_at": rights_verified_at,
        },
    }
    if isinstance(source_provider, str):
        result["source_provider"] = source_provider
    if isinstance(source_url, str):
        result["source_url"] = source_url
    if isinstance(source_download_url, str):
        result["download_url"] = source_download_url
    if isinstance(source_product_url, str):
        result["product_url"] = source_product_url
        result["source_spu"] = source_spu
        result["source_sku"] = source_sku
    if source_references is not None:
        result["source_references"] = source_references
    if isinstance(source_reference_role, str):
        result["source_reference_role"] = source_reference_role
    if isinstance(reference_provider, str):
        result["reference_provider"] = reference_provider
    if isinstance(source_view, str):
        result["source_view"] = source_view
    if derivative_metadata:
        result["derived_from_reference"] = derivative_metadata["derived_from_reference"]
        result["derived_from_sha256"] = derivative_metadata["derived_from_sha256"]
        result["source_view"] = derivative_metadata["source_view"]
    return result


def build(
    *,
    dry_run: bool,
    only_slugs: set[str] | None = None,
    only_positions: set[int] | None = None,
) -> dict[str, object]:
    slugs = sorted(path.stem for path in CATALOG.glob("*.webp"))
    if len(slugs) != 100 or len(set(slugs)) != 100:
        raise RuntimeError(f"Expected 100 catalog slugs, found {len(slugs)}")
    products: list[dict[str, object]] = []
    for slug in slugs:
        profile = media_profile(slug)
        sources = source_paths(slug)
        outputs = active_paths(slug)
        specs = PROFILE_SPECS[profile]
        if not all(path.is_file() for path in (*sources, *outputs)):
            missing = [str(path) for path in (*sources, *outputs) if not path.is_file()]
            raise RuntimeError(f"{slug}: missing media: {', '.join(missing)}")
        frames: list[dict[str, object]] = []
        for index, (source, output, spec) in enumerate(zip(sources, outputs, specs, strict=True), 1):
            # The eight featured products already have a stricter, source-aware
            # approved builder. Keep those pixels intact and normalize only the
            # 92 legacy sets here so both pipelines remain reproducible.
            selected = only_slugs is None or slug in only_slugs
            selected_position = only_positions is None or index in only_positions
            poizon_frame = approved_poizon_replacements().get(slug, {}).get(index)
            is_direct_source = (
                poizon_frame is not None and source.resolve() == poizon_frame["path"]
            )
            owner_preserved_frame = (
                index == 2 and slug not in DIRECT_SOURCE_FRAME_TWO_REPLACEMENT_SLUGS
            )
            should_render = not owner_preserved_frame and selected and selected_position and (
                slug not in APPROVED_SLUGS
                or GENERATED_OVERRIDES in source.parents
                or FINAL_SIX_FOOTWEAR_OVERRIDES in source.parents
                or is_direct_source
            )
            if should_render:
                rendered = render(fit_locked_frame_subject(slug, index, source, spec))
                if not dry_run:
                    save(rendered, output)
            frames.append(
                {
                    "position": index,
                    "file": output.resolve().relative_to(ROOT.resolve()).as_posix(),
                    "role": spec.role,
                    "angle": spec.angle,
                    "composition": spec.composition,
                    **provenance(slug, index, source),
                }
            )
        products.append({"slug": slug, "media_profile": profile, "frames": frames})

    if not dry_run:
        for product in products:
            for frame in product["frames"]:  # type: ignore[index]
                output = ROOT / frame["file"]  # type: ignore[index]
                frame["sha256"] = sha256_file(output)  # type: ignore[index]
        MANIFEST.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "expected_sku_count": 100,
                    "expected_frame_count": 500,
                    "canvas": list(CANVAS_SIZE),
                    "background_rgb": list(BACKGROUND),
                    "origin_notice": (
                        "Project-generated references and reviewed Poizon originals may coexist. "
                        "Visual approval is stored separately so rebuilding pixels cannot approve its own output."
                    ),
                    "products": products,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    return {"products": len(products), "frames": len(products) * 5, "dry_run": dry_run}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", action="append", default=[], metavar="SLUG")
    parser.add_argument("--frame", action="append", default=[], type=int, metavar="POSITION")
    parser.add_argument("--manifest-only", action="store_true")
    args = parser.parse_args()
    if args.manifest_only and (args.only or args.frame):
        parser.error("--manifest-only cannot be combined with --only or --frame")
    if any(position not in {1, 2, 3, 4, 5} for position in args.frame):
        parser.error("--frame must be between 1 and 5")
    if 2 in args.frame and (
        not args.only
        or any(slug not in DIRECT_SOURCE_FRAME_TWO_REPLACEMENT_SLUGS for slug in args.only)
    ):
        parser.error("--frame 2 requires only an explicitly reviewed replacement slug")
    selection = set() if args.manifest_only else set(args.only) or None
    positions = set(args.frame) or None
    print(
        json.dumps(
            build(dry_run=args.dry_run, only_slugs=selection, only_positions=positions),
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
