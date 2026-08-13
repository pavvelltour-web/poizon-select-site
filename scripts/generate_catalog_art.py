#!/usr/bin/env python3
"""Generate the standalone catalog's original demo product references.

The output is deliberately non-official: these are clean raster product cutouts
created inside the project, not manufacturer photos and not proof of exact
colour/material/SKU. Runtime and production builds use only committed WebP
files. This optional helper writes to generated/catalog-art and cannot overwrite
the exact catalog by default.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "generated" / "catalog-art"
PUBLISH = ROOT / "public" / "catalog"
PUBLISH_GALLERY = PUBLISH / "gallery"
PHOTO_SOURCE = ROOT / "public" / "brand" / "kicksbase-hero.webp"
WIDTH, HEIGHT = 1400, 1050
OUTPUT_SIZE = (1200, 900)
SCALE = 2
GALLERY_VIEW_COUNT = 5
FOOTWEAR_CROPS = (
    (540, 405, 1120, 860),
    (865, 245, 1365, 650),
    (1160, 145, 1565, 465),
)
JERSEY_CROP = (1040, 585, 1600, 1000)


@dataclass(frozen=True)
class ProductArt:
    slug: str
    category: str
    silhouette: str
    primary: str
    secondary: str
    accent: str


SPORT_PRODUCTS = (
    ProductArt("asics-sky-elite-ff-3", "sneakers", "runner", "#dce7f4", "#f8fbfd", "#1d5fd1"),
    ProductArt(
        "asics-sky-elite-ff-mt-3", "sneakers", "basketball", "#e5edf5", "#27384d", "#4d7dc9"
    ),
    ProductArt("asics-metarise-2", "sneakers", "basketball", "#edf1f5", "#38444f", "#8aa7cc"),
    ProductArt(
        "asics-netburner-ballistic-ff-4", "sneakers", "runner", "#d9e4ec", "#f5f8fa", "#365c88"
    ),
    ProductArt("asics-gel-tactic-13", "sneakers", "court", "#eef3f6", "#778899", "#264c73"),
    ProductArt("mizuno-wave-lightning-z8", "sneakers", "runner", "#dce9f5", "#ffffff", "#2f73b8"),
    ProductArt(
        "mizuno-wave-lightning-z8-mid", "sneakers", "basketball", "#253445", "#eaf0f5", "#5a84ad"
    ),
    ProductArt(
        "mizuno-wave-momentum-elite-mid", "sneakers", "basketball", "#e2e9ef", "#394a5c", "#6e91b3"
    ),
    ProductArt("mizuno-wave-momentum-pro", "sneakers", "court", "#edf1f4", "#44586b", "#7a9aba"),
    ProductArt("mizuno-wave-luminous-3", "sneakers", "runner", "#d7e4ef", "#f9fbfc", "#406f9e"),
    ProductArt("mizuno-wave-voltage-2", "sneakers", "court", "#eef3f6", "#607386", "#2b5c8c"),
    ProductArt("nike-zoom-hyperset-2", "sneakers", "basketball", "#233142", "#e6edf3", "#7698b8"),
    ProductArt("nike-hyperace-3-se", "sneakers", "runner", "#e8eef3", "#35495d", "#527ba5"),
    ProductArt(
        "adidas-crazyflight-6-mid", "sneakers", "basketball", "#dce5ed", "#f7fafc", "#315f8d"
    ),
    ProductArt("nike-metcon-10", "sneakers", "court", "#304052", "#e4ebf0", "#7190ad"),
    ProductArt("reebok-nano-x5", "sneakers", "runner", "#e5ecf2", "#43566a", "#517ba4"),
    ProductArt("adidas-dropset-3", "sneakers", "court", "#d9e3eb", "#26394c", "#6f91b1"),
    ProductArt(
        "under-armour-tribase-reign-6", "sneakers", "court", "#edf2f5", "#4a5d6f", "#315f89"
    ),
    ProductArt("hoka-ora-recovery-slide-3", "other", "slide", "#d8e5ee", "#f5f9fb", "#4d7699"),
    ProductArt("nike-calm-slide", "other", "slide", "#344659", "#e7edf2", "#7194b4"),
    ProductArt(
        "nike-dri-fit-volleyball-jersey", "other", "jersey", "#dbe6ef", "#f7fafc", "#376b9a"
    ),
    ProductArt("mizuno-volleyball-practice-tee", "other", "tee", "#e7edf2", "#42596d", "#6f94b5"),
    ProductArt("asics-actibreeze-match-top", "other", "tee", "#d9e5ee", "#f7fafc", "#2e658f"),
    ProductArt("adidas-crazyflight-shorts", "other", "shorts", "#2d4154", "#dfe8ef", "#6f92b1"),
    ProductArt("nike-pro-compression-shorts", "other", "shorts", "#243547", "#e7edf2", "#6488a9"),
    ProductArt("under-armour-heatgear-top", "other", "tee", "#dfe8ef", "#3c5268", "#6a91b2"),
    ProductArt("adidas-own-the-run-shorts", "other", "shorts", "#dbe5ec", "#334b61", "#7899b7"),
    ProductArt("on-performance-tights", "other", "tights", "#2c4054", "#e6edf2", "#678cae"),
    ProductArt(
        "nike-therma-fit-training-hoodie", "other", "hoodie", "#dce6ee", "#40566b", "#6e91b0"
    ),
    ProductArt("adidas-zne-track-jacket", "other", "zip-hoodie", "#33495f", "#e2eaf0", "#7899b6"),
)


LIFESTYLE_PRODUCTS = (
    ProductArt(
        "asics-gel-1130-black-pure-silver", "sneakers", "runner", "#20242a", "#d4d9df", "#f4f5f6"
    ),
    ProductArt(
        "asics-gel-nyc-cream-oyster-grey", "sneakers", "runner", "#d8d0bf", "#8a8b88", "#f2eee5"
    ),
    ProductArt(
        "asics-gel-kayano-14-white-midnight", "sneakers", "runner", "#f5f5f2", "#1b273c", "#bdc3c8"
    ),
    ProductArt(
        "salomon-xt-6-white-lunar-rock", "sneakers", "trail", "#efeee9", "#92938d", "#30383e"
    ),
    ProductArt(
        "new-balance-9060-rain-cloud", "sneakers", "chunky", "#aeb2b4", "#e4e3df", "#777c80"
    ),
    ProductArt(
        "new-balance-2002r-protection-pack", "sneakers", "runner", "#c7c2b8", "#6c7072", "#e7e3da"
    ),
    ProductArt(
        "new-balance-530-white-silver-navy", "sneakers", "runner", "#f6f5f1", "#b7bcc1", "#253955"
    ),
    ProductArt(
        "new-balance-1906r-silver-metallic", "sneakers", "runner", "#ccd0d2", "#f2f1ed", "#2c3439"
    ),
    ProductArt(
        "nike-zoom-vomero-5-photon-dust", "sneakers", "runner", "#d8d5cc", "#f1f0eb", "#8b8c89"
    ),
    ProductArt(
        "nike-air-max-95-black-anthracite", "sneakers", "air", "#17191d", "#4d5257", "#898d91"
    ),
    ProductArt("nike-air-force-1-07-white", "sneakers", "court", "#f7f6f2", "#d8d9d8", "#ffffff"),
    ProductArt("nike-dunk-low-panda", "sneakers", "court", "#f4f3ef", "#181a1d", "#d9dad9"),
    ProductArt("air-jordan-4-black-cat", "sneakers", "basketball", "#121416", "#3a3d40", "#696d70"),
    ProductArt("air-jordan-5-wolf-grey", "sneakers", "basketball", "#8c8d8c", "#d9d9d6", "#f2f1ed"),
    ProductArt(
        "air-jordan-1-low-white-black", "sneakers", "court", "#f4f3ee", "#15171a", "#d4d4d1"
    ),
    ProductArt(
        "adidas-samba-og-white-black", "classics", "classic", "#f5f4ef", "#17191c", "#b99462"
    ),
    ProductArt(
        "adidas-gazelle-indoor-green", "classics", "classic", "#1f604c", "#f2eee4", "#b98955"
    ),
    ProductArt(
        "adidas-campus-00s-core-black", "classics", "classic", "#1b1d20", "#e9e5db", "#c8b48a"
    ),
    ProductArt(
        "converse-chuck-70-high-black", "classics", "high-top", "#15171a", "#e9e5da", "#bf9a5f"
    ),
    ProductArt(
        "vans-old-skool-36-black-white", "classics", "classic", "#1b1e21", "#f1efe8", "#b99567"
    ),
    ProductArt(
        "essentials-hoodie-light-oatmeal", "other", "hoodie", "#d9d0be", "#eee9de", "#898276"
    ),
    ProductArt("north-face-1996-nuptse-black", "other", "puffer", "#17191c", "#32363a", "#757a7e"),
    ProductArt(
        "supreme-mm6-zip-hoodie-black", "other", "zip-hoodie", "#17191b", "#323539", "#e8e5dd"
    ),
    ProductArt(
        "jordan-nigel-sylvester-bike-air-jersey", "other", "jersey", "#d5533c", "#f1eade", "#20252c"
    ),
    ProductArt(
        "nike-barcelona-ronaldinho-jersey", "other", "jersey", "#243f92", "#8b253e", "#e6ba4a"
    ),
    ProductArt("kith-adidas-messi-tee", "other", "tee", "#e6e0d5", "#34383d", "#9e978a"),
    ProductArt("nike-mind-001-slide-black", "other", "slide", "#17191c", "#363a3f", "#777b80"),
    ProductArt(
        "timberland-field-boot-beef-broccoli", "other", "boot", "#7e5b34", "#304234", "#c29a5f"
    ),
    ProductArt("nike-hoops-elite-backpack", "other", "backpack", "#191c20", "#31363b", "#b49750"),
    ProductArt("new-era-yankees-59fifty-black", "other", "cap", "#17191c", "#34383d", "#e7e4dc"),
)

PRODUCTS = SPORT_PRODUCTS + LIFESTYLE_PRODUCTS


def sc(value: float) -> int:
    return round(value * SCALE)


def box(coords: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(sc(value) for value in coords)  # type: ignore[return-value]


def points(coords: tuple[tuple[float, float], ...]) -> list[tuple[int, int]]:
    return [(sc(x), sc(y)) for x, y in coords]


def create_background(index: int, accent: str) -> Image.Image:
    image = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), "#f8fafc")
    draw = ImageDraw.Draw(image)
    top = (255, 255, 255)
    bottom = (239, 243, 248)
    for y in range(HEIGHT * SCALE):
        t = y / (HEIGHT * SCALE - 1)
        color = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        draw.line((0, y, WIDTH * SCALE, y), fill=color)

    studio = Image.new("RGBA", image.size, (0, 0, 0, 0))
    studio_draw = ImageDraw.Draw(studio)
    studio_draw.rectangle(box((0, 705, WIDTH, HEIGHT)), fill="#edf2f7")
    studio_draw.line(points(((0, 705), (WIDTH, 705))), fill="#dbe3ec", width=sc(3))

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    offset = ((index * 31) % 120) - 60
    glow_draw.ellipse(box((840 + offset, 120, 1280 + offset, 560)), fill=accent + "18")
    glow = glow.filter(ImageFilter.GaussianBlur(sc(45)))

    return Image.alpha_composite(Image.alpha_composite(image.convert("RGBA"), studio), glow)


def shadow_layer() -> Image.Image:
    shadow = Image.new("RGBA", (WIDTH * SCALE, HEIGHT * SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse(box((245, 735, 1180, 900)), fill=(10, 18, 30, 48))
    return shadow.filter(ImageFilter.GaussianBlur(sc(36)))


def draw_shoe(image: Image.Image, product: ProductArt, index: int) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    high = product.silhouette in {"basketball", "high-top"}
    chunky = product.silhouette in {"chunky", "basketball"}
    trail = product.silhouette == "trail"
    classic = product.category == "classics"
    lift = 105 if high else 28
    rear = 300 if high else 350
    toe = 1175 if chunky else 1135
    sole_top = 695 if chunky else 720
    sole_bottom = 845 if chunky else 825
    stroke = "#26303a"
    gum = "#b89155" if classic or index % 3 == 0 else "#e9edf2"

    upper = (
        (rear, 662),
        (rear + 64, 500 - lift),
        (515, 410 - lift),
        (676, 510 - lift // 2),
        (812, 620),
        (1008, 656),
        (toe, 710),
        (1060, sole_top + 10),
        (812, sole_top - 4),
        (595, 694),
    )
    draw.polygon(points(upper), fill=product.primary, outline=stroke, width=sc(4))
    draw.rounded_rectangle(
        box((310, sole_top, toe + 38, sole_bottom)),
        radius=sc(42 if chunky else 34),
        fill=product.secondary,
        outline=stroke,
        width=sc(4),
    )
    draw.rounded_rectangle(
        box((348, sole_bottom - 52, toe + 8, sole_bottom - 10)),
        radius=sc(20),
        fill=gum,
        outline="#9aa4ad",
        width=sc(2),
    )
    for x in range(388, toe - 10, 74 if trail else 92):
        draw.rounded_rectangle(
            box((x, sole_bottom - 45, x + 34, sole_bottom - 17)),
            radius=sc(8),
            fill="#29313a" if trail else "#c5cbd2",
        )
    if high:
        draw.rounded_rectangle(
            box((358, 308 - lift // 2, 592, 690)),
            radius=sc(58),
            fill=product.primary,
            outline=stroke,
            width=sc(4),
        )

    # Layered panel construction resembles a retail product portrait without
    # reproducing any protected brand mark.
    draw.polygon(
        points(((500, 650), (594, 476 - lift // 2), (764, 566), (720, 688))),
        fill="#ffffffcc",
        outline="#9ca7b2",
        width=sc(3),
    )
    draw.rounded_rectangle(
        box((748, 555, 980, 672)),
        radius=sc(34),
        fill=product.accent + "dd",
        outline="#31465c",
        width=sc(3),
    )
    draw.rounded_rectangle(
        box((405, 558 - lift // 2, 550, 700)),
        radius=sc(48),
        fill=product.secondary + "e8",
        outline="#7f8b97",
        width=sc(3),
    )
    if classic:
        draw.polygon(
            points(((490, 652), (620, 505 - lift // 4), (760, 625), (665, 699))),
            fill=product.secondary,
            outline="#7f8b97",
            width=sc(3),
        )
    else:
        for x in range(545, 705, 22):
            draw.line(
                points(((x, 505 - lift // 2), (x + 112, 650))),
                fill="#ffffff66",
                width=sc(2),
            )
        for y in range(536 - lift // 2, 654, 24):
            draw.line(points(((535, y), (720, y + 42))), fill="#25384a22", width=sc(2))
        for offset in (0, 44, 88):
            draw.line(
                points(((560 + offset, 536 - lift // 3), (738 + offset, 676))),
                fill="#f8fbff",
                width=sc(13 if product.silhouette == "runner" else 10),
            )
            draw.line(
                points(((568 + offset, 540 - lift // 3), (746 + offset, 680))),
                fill=product.accent,
                width=sc(7 if product.silhouette == "runner" else 5),
            )
    for step in range(5):
        y = 500 + step * 34 - lift // 2
        draw.ellipse(box((522, y, 548, y + 26)), fill="#26303a", outline="#f8fbff", width=sc(2))
        draw.ellipse(
            box((712, y + 34, 738, y + 60)),
            fill="#26303a",
            outline="#f8fbff",
            width=sc(2),
        )
        draw.line(
            points(((544, y + 14), (718, y + 46))),
            fill="#f6f7f8",
            width=sc(7),
        )
        draw.line(points(((718, y + 14), (544, y + 48))), fill="#e2e8ef", width=sc(5))
    if trail:
        for x in range(430, 1020, 70):
            draw.polygon(
                points(
                    ((x, sole_bottom - 4), (x + 32, sole_bottom + 22), (x + 56, sole_bottom - 4))
                ),
                fill="#30353a",
            )
    if product.silhouette == "air":
        for x in range(470, 940, 95):
            draw.rounded_rectangle(
                box((x, 770, x + 68, 805)),
                radius=sc(14),
                fill="#0c1015",
                outline="#777d83",
                width=sc(3),
            )

    highlight = Image.new("RGBA", image.size, (0, 0, 0, 0))
    high_draw = ImageDraw.Draw(highlight)
    high_draw.line(points(((430, 430 - lift // 2), (880, 650))), fill="#ffffff55", width=sc(18))
    high_draw.line(points(((360, sole_top + 25), (1030, sole_top + 45))), fill="#ffffff66", width=sc(12))
    layer = Image.alpha_composite(layer, highlight.filter(ImageFilter.GaussianBlur(sc(1.5))))
    angle = (-5, -3, -2, 2, 4)[index % 5]
    rotated = layer.rotate(angle, resample=Image.Resampling.BICUBIC, center=(sc(715), sc(660)))
    image.alpha_composite(rotated)


def draw_hoodie(image: Image.Image, product: ProductArt, *, zipped: bool = False) -> None:
    draw = ImageDraw.Draw(image)
    draw.polygon(
        points(((485, 440), (350, 535), (205, 805), (365, 875), (485, 675))),
        fill=product.primary,
        outline="#23282d",
        width=sc(5),
    )
    draw.polygon(
        points(((915, 440), (1050, 535), (1195, 805), (1035, 875), (915, 675))),
        fill=product.primary,
        outline="#23282d",
        width=sc(5),
    )
    draw.rounded_rectangle(
        box((446, 396, 954, 900)),
        radius=sc(70),
        fill=product.primary,
        outline="#23282d",
        width=sc(6),
    )
    draw.ellipse(box((525, 180, 875, 548)), fill=product.secondary, outline="#23282d", width=sc(6))
    draw.ellipse(box((585, 245, 815, 490)), fill="#bfc1c0", outline="#353a3f", width=sc(5))
    draw.rounded_rectangle(
        box((555, 720, 845, 824)), radius=sc(32), outline=product.secondary, width=sc(6)
    )
    draw.line(
        points(((700, 470), (700, 900))),
        fill=product.accent if zipped else product.secondary,
        width=sc(7 if zipped else 3),
    )
    draw.line(points(((630, 440), (610, 575))), fill=product.secondary, width=sc(5))
    draw.line(points(((770, 440), (790, 575))), fill=product.secondary, width=sc(5))


def draw_puffer(image: Image.Image, product: ProductArt) -> None:
    draw = ImageDraw.Draw(image)
    draw.polygon(
        points(((470, 375), (315, 480), (230, 850), (395, 895), (485, 670))),
        fill=product.primary,
        outline="#20252a",
        width=sc(6),
    )
    draw.polygon(
        points(((930, 375), (1085, 480), (1170, 850), (1005, 895), (915, 670))),
        fill=product.primary,
        outline="#20252a",
        width=sc(6),
    )
    draw.rounded_rectangle(
        box((430, 310, 970, 905)),
        radius=sc(68),
        fill=product.primary,
        outline="#20252a",
        width=sc(6),
    )
    draw.rounded_rectangle(
        box((535, 208, 865, 455)),
        radius=sc(105),
        fill=product.secondary,
        outline="#20252a",
        width=sc(6),
    )
    for y in range(420, 860, 92):
        draw.line(points(((450, y), (950, y))), fill=product.secondary, width=sc(6))
    draw.line(points(((700, 338), (700, 902))), fill=product.accent, width=sc(6))


def draw_top(image: Image.Image, product: ProductArt, *, jersey: bool) -> None:
    draw = ImageDraw.Draw(image)
    sleeve = 225 if jersey else 265
    draw.polygon(
        points(
            (
                (500, 300),
                (350, 360),
                (sleeve, 610),
                (405, 685),
                (455, 580),
                (460, 900),
                (940, 900),
                (945, 580),
                (995, 685),
                (1175 if jersey else 1135, 610),
                (1050, 360),
                (900, 300),
            )
        ),
        fill=product.primary,
        outline="#252a30",
        width=sc(6),
    )
    draw.ellipse(box((570, 242, 830, 430)), fill="#eef0ef", outline="#252a30", width=sc(6))
    draw.ellipse(box((615, 270, 785, 415)), fill="#d2d5d4")
    if jersey:
        draw.polygon(
            points(((460, 900), (585, 300), (700, 300), (620, 900))), fill=product.secondary
        )
        draw.polygon(
            points(((725, 300), (840, 300), (940, 900), (780, 900))), fill=product.secondary
        )
        draw.line(points(((700, 305), (700, 900))), fill=product.accent, width=sc(9))
        draw.arc(box((555, 455, 845, 745)), 25, 335, fill=product.accent, width=sc(14))
    else:
        draw.rounded_rectangle(
            box((545, 560, 855, 665)), radius=sc(28), outline=product.secondary, width=sc(7)
        )


def draw_shorts(image: Image.Image, product: ProductArt) -> None:
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        box((430, 260, 970, 410)),
        radius=sc(46),
        fill=product.secondary,
        outline="#252a30",
        width=sc(6),
    )
    draw.polygon(
        points(((450, 375), (695, 375), (655, 890), (315, 875))),
        fill=product.primary,
        outline="#252a30",
        width=sc(6),
    )
    draw.polygon(
        points(((705, 375), (950, 375), (1085, 875), (745, 890))),
        fill=product.primary,
        outline="#252a30",
        width=sc(6),
    )
    draw.line(points(((700, 385), (700, 735))), fill=product.accent, width=sc(7))
    draw.line(points(((365, 810), (650, 830))), fill=product.accent, width=sc(8))
    draw.line(points(((750, 830), (1035, 810))), fill=product.accent, width=sc(8))


def draw_tights(image: Image.Image, product: ProductArt) -> None:
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        box((450, 220, 950, 370)),
        radius=sc(42),
        fill=product.secondary,
        outline="#252a30",
        width=sc(6),
    )
    draw.polygon(
        points(((470, 345), (685, 345), (650, 920), (475, 920), (420, 600))),
        fill=product.primary,
        outline="#252a30",
        width=sc(6),
    )
    draw.polygon(
        points(((715, 345), (930, 345), (980, 600), (925, 920), (750, 920))),
        fill=product.primary,
        outline="#252a30",
        width=sc(6),
    )
    draw.line(points(((700, 350), (700, 700))), fill=product.accent, width=sc(7))
    draw.line(points(((480, 780), (645, 800))), fill=product.accent, width=sc(8))
    draw.line(points(((755, 800), (920, 780))), fill=product.accent, width=sc(8))


def draw_slide(image: Image.Image, product: ProductArt) -> None:
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        box((315, 610, 1110, 835)),
        radius=sc(105),
        fill=product.secondary,
        outline="#23282d",
        width=sc(6),
    )
    draw.rounded_rectangle(
        box((385, 400, 865, 735)),
        radius=sc(115),
        fill=product.primary,
        outline="#23282d",
        width=sc(6),
    )
    for x in range(420, 825, 52):
        draw.line(points(((x, 445), (x + 175, 680))), fill=product.accent, width=sc(5))
    for x in range(390, 1045, 48):
        draw.ellipse(box((x, 760, x + 18, 778)), fill="#737980")


def draw_boot(image: Image.Image, product: ProductArt) -> None:
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        box((410, 252, 700, 720)),
        radius=sc(65),
        fill=product.secondary,
        outline="#252a30",
        width=sc(6),
    )
    draw.polygon(
        points(((405, 585), (690, 545), (820, 675), (1080, 735), (1135, 840), (375, 840))),
        fill=product.primary,
        outline="#252a30",
        width=sc(6),
    )
    draw.rounded_rectangle(
        box((340, 790, 1160, 885)), radius=sc(30), fill="#2c3034", outline="#171a1d", width=sc(6)
    )
    for step in range(5):
        y = 385 + step * 62
        draw.ellipse(
            box((465, y, 505, y + 40)), fill=product.accent, outline="#20252a", width=sc(4)
        )
        draw.ellipse(
            box((635, y, 675, y + 40)), fill=product.accent, outline="#20252a", width=sc(4)
        )
        draw.line(points(((485, y + 20), (655, y + 45))), fill="#e5ddca", width=sc(8))
        draw.line(points(((655, y + 20), (485, y + 45))), fill="#e5ddca", width=sc(8))


def draw_backpack(image: Image.Image, product: ProductArt) -> None:
    draw = ImageDraw.Draw(image)
    draw.arc(box((455, 165, 945, 610)), 190, 350, fill=product.secondary, width=sc(35))
    draw.rounded_rectangle(
        box((350, 265, 1050, 920)),
        radius=sc(170),
        fill=product.primary,
        outline="#24292e",
        width=sc(7),
    )
    draw.rounded_rectangle(
        box((440, 570, 960, 855)),
        radius=sc(90),
        fill=product.secondary,
        outline="#24292e",
        width=sc(6),
    )
    draw.line(points(((700, 280), (700, 910))), fill=product.accent, width=sc(7))
    draw.rounded_rectangle(
        box((575, 365, 825, 490)), radius=sc(35), outline=product.accent, width=sc(7)
    )


def draw_cap(image: Image.Image, product: ProductArt) -> None:
    draw = ImageDraw.Draw(image)
    draw.pieslice(
        box((315, 170, 1085, 865)), 180, 360, fill=product.primary, outline="#22272c", width=sc(7)
    )
    draw.polygon(
        points(((695, 525), (1200, 635), (1090, 765), (660, 650))),
        fill=product.secondary,
        outline="#22272c",
        width=sc(7),
    )
    draw.arc(box((500, 250, 900, 720)), 185, 355, fill=product.accent, width=sc(6))
    draw.ellipse(box((670, 175, 730, 235)), fill=product.accent, outline="#22272c", width=sc(4))


def draw_product(image: Image.Image, product: ProductArt, index: int) -> None:
    image.alpha_composite(shadow_layer())
    if product.category in {"sneakers", "classics"}:
        draw_shoe(image, product, index)
    elif product.silhouette == "hoodie":
        draw_hoodie(image, product)
    elif product.silhouette == "zip-hoodie":
        draw_hoodie(image, product, zipped=True)
    elif product.silhouette == "puffer":
        draw_puffer(image, product)
    elif product.silhouette in {"jersey", "tee"}:
        draw_top(image, product, jersey=product.silhouette == "jersey")
    elif product.silhouette == "shorts":
        draw_shorts(image, product)
    elif product.silhouette == "tights":
        draw_tights(image, product)
    elif product.silhouette == "slide":
        draw_slide(image, product)
    elif product.silhouette == "boot":
        draw_boot(image, product)
    elif product.silhouette == "backpack":
        draw_backpack(image, product)
    elif product.silhouette == "cap":
        draw_cap(image, product)
    else:  # pragma: no cover - all catalog silhouettes are enumerated above.
        raise ValueError(f"Unsupported silhouette: {product.silhouette}")


def _accent_rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[start : start + 2], 16) for start in (0, 2, 4))


def _studio_canvas(index: int, accent: str) -> Image.Image:
    canvas = create_background(index, accent)
    draw = ImageDraw.Draw(canvas)
    rgb = _accent_rgb(accent)
    draw.rounded_rectangle(
        box((94, 92, 382, 124)),
        radius=sc(16),
        fill=(*rgb, 28),
    )
    draw.rounded_rectangle(
        box((1010, 866, 1296, 900)),
        radius=sc(17),
        fill=(*rgb, 36),
    )
    return canvas


def _place_product_photo(
    canvas: Image.Image,
    cutout: Image.Image,
    *,
    index: int,
    accent: str,
    target_width: int,
    target_height: int,
    y_offset: int,
) -> None:
    photo = ImageOps.contain(cutout.convert("RGB"), (sc(target_width), sc(target_height)))
    photo = ImageEnhance.Contrast(photo).enhance(1.03)
    photo = ImageEnhance.Sharpness(photo).enhance(1.12)
    angle = (-2.4, -1.2, 0.0, 1.4, 2.2)[index % 5]
    photo = photo.convert("RGBA").rotate(
        angle,
        expand=True,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(255, 255, 255, 0),
    )

    x = sc((WIDTH - photo.width / SCALE) / 2)
    y = sc(y_offset + ((index % 4) - 1.5) * 9)

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        (
            x + sc(55),
            y + photo.height - sc(88),
            x + photo.width - sc(25),
            y + photo.height - sc(10),
        ),
        fill=(20, 28, 38, 52),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(sc(22)))
    canvas.alpha_composite(shadow)

    rgb = _accent_rgb(accent)
    accent_plate = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    plate_draw = ImageDraw.Draw(accent_plate)
    plate_draw.rounded_rectangle(
        (
            x + sc(40 + index % 5 * 12),
            y + sc(48),
            x + sc(188 + index % 5 * 12),
            y + sc(76),
        ),
        radius=sc(14),
        fill=(*rgb, 42),
    )
    canvas.alpha_composite(accent_plate)
    canvas.alpha_composite(photo, (x, y))


def render_photo_reference(product: ProductArt, index: int) -> Image.Image | None:
    if not PHOTO_SOURCE.is_file():
        return None
    if product.category not in {"sneakers", "classics"} and product.silhouette not in {
        "jersey",
        "tee",
    }:
        return None

    with Image.open(PHOTO_SOURCE) as hero:
        hero = hero.convert("RGB")
        if product.category in {"sneakers", "classics"}:
            crop = hero.crop(FOOTWEAR_CROPS[index % len(FOOTWEAR_CROPS)])
            canvas = _studio_canvas(index, product.accent)
            _place_product_photo(
                canvas,
                crop,
                index=index,
                accent=product.accent,
                target_width=840,
                target_height=600,
                y_offset=250,
            )
            return canvas

        crop = hero.crop(JERSEY_CROP)
        canvas = _studio_canvas(index, product.accent)
        _place_product_photo(
            canvas,
            crop,
            index=index,
            accent=product.accent,
            target_width=700,
            target_height=560,
            y_offset=270,
        )
        return canvas


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def white_gallery_background(accent: str, view_index: int) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH * SCALE, HEIGHT * SCALE), (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    rgb = _accent_rgb(accent)
    draw.ellipse(
        box((230 + view_index * 16, 756, 1180 + view_index * 10, 935)),
        fill=(18, 24, 32, 16),
    )
    draw.line(points(((0, 804), (WIDTH, 804))), fill=(224, 228, 231, 255), width=sc(3))
    draw.rounded_rectangle(
        box((110, 112, 350, 144)),
        radius=sc(16),
        fill=(*rgb, 18),
    )
    draw.rounded_rectangle(
        box((1058, 854, 1298, 886)),
        radius=sc(16),
        fill=(*rgb, 24),
    )
    return canvas


def render_cutout(product: ProductArt, index: int) -> Image.Image:
    layer = Image.new("RGBA", (WIDTH * SCALE, HEIGHT * SCALE), (0, 0, 0, 0))
    draw_product(layer, product, index)
    bbox = layer.getbbox()
    if bbox is None:
        return layer
    return layer.crop(bbox)


def compose_gallery_view(product: ProductArt, index: int, view_index: int) -> Image.Image:
    canvas = white_gallery_background(product.accent, view_index)
    cutout = render_cutout(product, index + view_index * 3)
    target_sizes = (
        (878, 650),
        (820, 620),
        (784, 590),
        (846, 635),
        (760, 570),
    )
    offsets = ((0, 12), (-32, 8), (28, 0), (0, -6), (16, 4))
    rotations = (0.0, -2.8, 2.6, -1.4, 1.8)

    composed = ImageOps.contain(
        cutout,
        (sc(target_sizes[view_index][0]), sc(target_sizes[view_index][1])),
    ).convert("RGBA")
    if view_index == 3 and product.category not in {"sneakers", "classics"}:
        composed = ImageOps.mirror(composed)
    composed = composed.rotate(
        rotations[view_index],
        expand=True,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(255, 255, 255, 0),
    )

    x = (canvas.width - composed.width) // 2 + sc(offsets[view_index][0])
    y = sc(138 + offsets[view_index][1])

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        (
            x + sc(50),
            y + composed.height - sc(70),
            x + composed.width - sc(26),
            y + composed.height - sc(6),
        ),
        fill=(16, 22, 30, 42),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(sc(20)))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(composed, (x, y))
    return canvas


def render_all() -> list[dict[str, object]]:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PUBLISH.mkdir(parents=True, exist_ok=True)
    PUBLISH_GALLERY.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    for index, product in enumerate(PRODUCTS, start=1):
        gallery_images: list[tuple[Path, Image.Image]] = []
        for view_index in range(GALLERY_VIEW_COUNT):
            image = compose_gallery_view(product, index, view_index)
            final = image.convert("RGB").resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)
            if view_index == 0:
                output_path = OUTPUT / f"{product.slug}.webp"
                publish_path = PUBLISH / f"{product.slug}.webp"
            else:
                output_path = OUTPUT / "gallery" / f"{product.slug}-{view_index + 1}.webp"
                publish_path = PUBLISH_GALLERY / f"{product.slug}-{view_index + 1}.webp"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            publish_path.parent.mkdir(parents=True, exist_ok=True)
            final.save(
                output_path,
                "WEBP",
                quality=90,
                method=6,
                exact=True,
                exif=b"",
                icc_profile=None,
            )
            final.save(
                publish_path,
                "WEBP",
                quality=90,
                method=6,
                exact=True,
                exif=b"",
                icc_profile=None,
            )
            gallery_images.append((publish_path, final))

        path = OUTPUT / f"{product.slug}.webp"

        with Image.open(path) as check:
            check.verify()
        with Image.open(path) as check:
            if check.format != "WEBP" or check.size != OUTPUT_SIZE:
                raise RuntimeError(f"Invalid generated asset: {path}")
            if check.getexif():
                raise RuntimeError(f"Metadata was not stripped: {path}")

        records.append(
            {
                "file": path.name,
                "slug": product.slug,
                "category": product.category,
                "source_type": "project-generated-original",
                "source": "scripts/generate_catalog_art.py",
                "official_product_photo": False,
                "width": OUTPUT_SIZE[0],
                "height": OUTPUT_SIZE[1],
                "mime_type": "image/webp",
                "sha256": sha256(path),
                "gallery_files": [
                    f"gallery/{product.slug}-{view_index}.webp"
                    for view_index in range(2, GALLERY_VIEW_COUNT + 1)
                ],
            }
        )
    return records


def write_manifests(records: list[dict[str, object]]) -> None:
    payload = {
        "generated_on": "2026-07-26",
        "asset_count": len(records),
        "runtime_external_requests": False,
        "disclaimer": (
            "Original product-reference cutouts generated inside this project. "
            "They are visual category references, not official manufacturer photos "
            "or proof of an exact colour/material match. Product names and trademarks "
            "remain the property of their respective owners."
        ),
        "assets": records,
    }
    (OUTPUT / "assets.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    lines = [
        "# Catalog asset manifest",
        "",
        "Generated: 2026-07-26",
        "",
        "All catalog WebP files are original product-reference cutouts generated by "
        "`scripts/generate_catalog_art.py`. They were verified by Pillow, re-encoded "
        "as WebP, and saved without EXIF metadata. They are not downloaded files.",
        "",
        "**Important:** these are storefront visual references, not proof of an "
        "exact colour/material match. Product names and trademarks belong to "
        "their respective owners.",
        "",
        "| File | Category | SHA-256 |",
        "| --- | --- | --- |",
    ]
    for record in records:
        lines.append(f"| `{record['file']}` | {record['category']} | `{record['sha256']}` |")
    lines.append("")
    (OUTPUT / "ASSET_MANIFEST.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    manifest_records = render_all()
    write_manifests(manifest_records)
    print(f"Generated and verified {len(manifest_records)} local WebP assets in {OUTPUT}")
