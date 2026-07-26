#!/usr/bin/env python3
"""Fetch, validate, and normalize the 30 local catalog reference images.

This is a maintainer-only supply-chain script. The built site never contacts
these hosts: it serves the committed WebP files from /public/catalog instead.
"""

from __future__ import annotations

import hashlib
import http.client
import io
import ipaddress
import json
import os
import socket
import tempfile
import urllib.parse
import urllib.request
import warnings
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "catalog"
MANIFEST_PATH = OUTPUT_DIR / "sources.json"
MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 25_000_000
MIN_PIXELS = 40_000
CANVAS_SIZE = (1200, 900)
ALLOWED_CONTENT_TYPES = frozenset({"image/avif", "image/jpeg", "image/png", "image/webp"})

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


@dataclass(frozen=True)
class Asset:
    slug: str
    source_page: str
    asset_url: str


ASSETS = (
    Asset(
        "asics-gel-1130-black-pure-silver",
        "https://www.asics.com/ph/en-ph/gel-1130/p/1201A906-001.html",
        "https://images.asics.com/is/image/asics/1201A906_001_SR_RT_GLB?$sfcc-product$&wid=1200&hei=900",
    ),
    Asset(
        "asics-gel-nyc-cream-oyster-grey",
        "https://www.asics.com/us/en-us/gel-nyc/p/ANA_1201A789-103.html",
        "https://images.asics.com/is/image/asics/1201A789_103_SR_RT_GLB?$sfcc-product$&wid=1200&hei=900",
    ),
    Asset(
        "asics-gel-kayano-14-white-midnight",
        "https://www.asics.com/gb/en-gb/gel-kayano-14/p/1202A056-109.html",
        "https://images.asics.com/is/image/asics/1202A056_109_SR_RT_GLB?$sfcc-product$&wid=1200&hei=900",
    ),
    Asset(
        "salomon-xt-6-white-lunar-rock",
        "https://www.salomon.com/en-us/product/xt-6-lg4239/L41252900",
        "https://cdn.dam.salomon.com/0efa70ed-89aa-439d-9f7b-b2f400da0fbf/L41252900/PNG-2000px-max-72dpi.png?pad=0.12,0.12,0.12,0.12",
    ),
    Asset(
        "new-balance-9060-rain-cloud",
        "https://www.newbalance.com/pd/9060/U9060GRY-D-17.html",
        "https://nb.scene7.com/is/image/NB/u9060gry_nb_02_i?$pdpflexf2$&wid=1200&hei=900",
    ),
    Asset(
        "new-balance-2002r-protection-pack",
        "https://www.newbalance.de/de/pd/2002r-protection-pack/M2002RDA-D-07.html",
        "https://nb.scene7.com/is/image/NB/m2002rda_nb_02_i?$pdpflexf2$&wid=1200&hei=900",
    ),
    Asset(
        "new-balance-530-white-silver-navy",
        "https://www.newbalance.com/pd/530/MR530SG-D-05.html",
        "https://nb.scene7.com/is/image/NB/mr530sg_nb_02_i?$pdpflexf2$&wid=1200&hei=900",
    ),
    Asset(
        "new-balance-1906r-silver-metallic",
        "https://www.newbalance.com/pd/1906r/M1906RV1-47448-PMG-NA.html?dwvar_M1906RV1-47448-PMG-NA_style=M1906RER",
        "https://nb.scene7.com/is/image/NB/m1906rer_nb_02_i?$pdpflexf2$&wid=1200&hei=900",
    ),
    Asset(
        "nike-zoom-vomero-5-photon-dust",
        "https://www.nike.com/ca/t/zoom-vomero-5-womens-shoes-jqhLUpj7/HF7723-001",
        "https://static.nike.com/a/images/t_web_pdp_936_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/b8173f2d-b816-404c-8f8c-0b6128cf9604/W+NIKE+ZOOM+VOMERO+5.png",
    ),
    Asset(
        "nike-air-max-95-black-anthracite",
        "https://www.nike.com/gb/launch/t/nike-sb-air-max-95-black-and-anthracite",
        "https://static.nike.com/a/images/w_1200,q_auto,f_auto/d079a1ab-ec8e-4567-8722-e0b122fa70ec/nike-sb-air-max-95-black-and-anthracite-hf7545-002-release-date.jpg",
    ),
    Asset(
        "nike-air-force-1-07-white",
        "https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111",
        "https://static.nike.com/a/images/t_web_pdp_936_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/b7d9211c-26e7-431a-ac24-b0540fb3c00f/AIR+FORCE+1+%2707.png",
    ),
    Asset(
        "nike-dunk-low-panda",
        "https://www.nike.com/t/dunk-low-retro-mens-shoes-P4DaDIKC",
        "https://static.nike.com/a/images/t_web_pdp_936_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/b1bcbca4-e853-4df7-b329-5be3c61ee057/NIKE+DUNK+LOW+RETRO.png",
    ),
    Asset(
        "air-jordan-4-black-cat",
        "https://www.nike.com/id/launch/t/air-jordan-4-black-cat",
        "https://static.nike.com/a/images/w_1200,q_auto,f_auto/2cbe215f-d07c-41fb-8cf5-7783c20b0046/air-jordan-4-black-cat-fv5029-010-release-date.jpg",
    ),
    Asset(
        "air-jordan-5-wolf-grey",
        "https://www.nike.com/launch/t/air-jordan-5-retro-light-graphite-and-wolf-grey",
        "https://static.nike.com/a/images/w_1200,q_auto,f_auto/e024a0c8-bbec-452d-9135-0a54b7f2b19a/air-jordan-5-retro-light-graphite-and-wolf-grey-dd0587-002-release-date.jpg",
    ),
    Asset(
        "air-jordan-1-low-white-black",
        "https://www.sneakerjagers.com/en/s/air-jordan-1-low-553558-132/454900",
        "https://static.sneakerjagers.com/products/660x660/454900.jpg",
    ),
    Asset(
        "adidas-samba-og-white-black",
        "https://www.adidas.com/us/samba-og-shoes/B75806.html",
        "https://assets.adidas.com/images/w_1200,f_auto,q_auto/3bbecbdf584e40398446a8bf0117cf62_9366/Samba_OG_Shoes_White_B75806_01_00_standard.jpg",
    ),
    Asset(
        "adidas-gazelle-indoor-green",
        "https://www.adidas.co.uk/gazelle-indoor-shoes/JI2062.html",
        "https://assets.adidas.com/images/h_1200,f_auto,q_auto,fl_lossy,c_fill,g_auto/9b828a3c21c8461c8b059eb52e318dae_9366/Gazelle_Indoor_Shoes_Green_JI2062_05_standard.jpg",
    ),
    Asset(
        "adidas-campus-00s-core-black",
        "https://www.adidas.com/us/campus-00s-shoes/HQ8708.html",
        "https://assets.adidas.com/images/w_1200,f_auto,q_auto/4659ee058ba34bd2a5d0af500104c17d_9366/Campus_00s_Shoes_Black_HQ8708_01_standard.jpg",
    ),
    Asset(
        "converse-chuck-70-high-black",
        "https://www.nike.com/t/converse-chuck-70-high-top-unisex-shoe-D7TWU3j3/162050C-001",
        "https://static.nike.com/a/images/t_web_pdp_936_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/38804191-c6a4-4da1-b605-5bef350f912d/CHUCK+70+HI+BLACK%2FBLACK%2FEGRET.png",
    ),
    Asset(
        "vans-old-skool-36-black-white",
        "https://www.vans.com/en-us/shoes-c00081/old-skool-shoe-pvn000d3hy28",
        "https://assets.vans.com/images/t_img/c_fill,g_center,f_auto,h_900,e_unsharp_mask:100,w_1200/dpr_1.0/v1/VN000D3HY28-HERO/Old-Skool-Shoe-VANS-Black-White-HERO.jpg",
    ),
    Asset(
        "essentials-hoodie-light-oatmeal",
        "https://www.pacsun.com/fear-of-god-essentials/light-oatmeal-hoodie-0192250500496466.html",
        "https://www.pacsun.com/dw/image/v2/AAJE_PRD/on/demandware.static/-/Sites-pacsun_storefront_catalog/default/dwb27cac12/product_images/0192250500496NEW_00_466.jpg?sw=1200",
    ),
    Asset(
        "north-face-1996-nuptse-black",
        "https://www.thenorthface.com/en-us/p/mens/mens-jackets-and-vests/mens-insulated-and-down-300771/mens-1996-retro-nuptse-jacket-NF0A3C8D?color=GOE",
        "https://assets.thenorthface.com/images/t_img/c_fill,ar_4:5,f_auto,h_1000,e_unsharp_mask:100,w_800/dpr_1.0/v1754066544/NF0A3C8DGOE-HERO/Mens-1996-Retro-Nuptse-Jacket-TNF-HERO.png",
    ),
    Asset(
        "supreme-mm6-zip-hoodie-black",
        "https://supreme.com/news/1017/images?=70",
        "https://cdn.sanity.io/images/ldn4d4qt/ss26-production-2026-02-22/0fb83b1c34648f7b7e19c0d50e2a68eb10dfaada-1440x1800.jpg",
    ),
    Asset(
        "jordan-nigel-sylvester-bike-air-jersey",
        "https://rooted.runfair.com/en-US/us/jordan-bike-air-jersey-sail",
        "https://cdn.eql.media/draw-api/246a9432-59f9-438c-8754-17f93da2a16b/d06713f9-c80d-4959-91ae-7219a8074b0b.jpg",
    ),
    Asset(
        "nike-barcelona-ronaldinho-jersey",
        "https://www.nike.com/us/es/t/jersey-de-f%C3%BAtbol-de-manga-larga-replica-del-fc-barcelona2005-06-reissue-ronaldinho-2hgZF2",
        "https://static.nike.com/a/images/t_web_pdp_936_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/3004da36-cf78-4720-b4db-6b0c7151043a/FCB+M+NK+REISSUE+LS+JSY+PLYR.png",
    ),
    Asset(
        "kith-adidas-messi-tee",
        "https://kith.com/collections/kith-messi-for-adidas-football/products/adku4264",
        "https://kith.com/cdn/shop/files/ADKU4264-Front.jpg?v=1779476196&width=1920",
    ),
    Asset(
        "nike-mind-001-slide-black",
        "https://www.nike.com/launch/t/mind-001-fragment-black",
        "https://static.nike.com/a/images/w_1200,q_auto,f_auto/0d475f9f-2c80-47db-94d7-7277cf87d117/mind-001-x-fragment-black-iq8502-001-release-date.jpg",
    ),
    Asset(
        "timberland-field-boot-beef-broccoli",
        "https://www.stadiumgoods.com/products/6-inch-premium-field-boot-beef-and-broccoli-078893",
        "https://www.stadiumgoods.com/cdn/shop/files/xeejl67g3f5csfwika6bmv0hbu07.png?crop=center&height=1200&v=1736173502&width=1200",
    ),
    Asset(
        "nike-hoops-elite-backpack",
        "https://www.nike.ae/en/hoops-elite-backpack-32l/196605140804.html",
        "https://www.nike.ae/dw/image/v2/BDVB_PRD/on/demandware.static/-/Sites-akeneo-master-catalog/default/dw60cb526c/nk/5fd/9/b/8/d/3/5fd9b8d3_0a6e_4824_83b7_d30af33729c2.jpg?sw=1200&sh=1200&sm=fit&q=90&strip=false",
    ),
    Asset(
        "new-era-yankees-59fifty-black",
        "https://www.neweracap.com/products/new-york-yankees-black-basic-59fifty-fitted",
        "https://www.neweracap.com/cdn/shop/files/60955984_59FIFTY_MLBBASIC5950BLKTC_NEYYAN_OTC_3QL.jpg?v=1778176339&width=1600",
    ),
)


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def assert_safe_https(url: str, allowed_host: str) -> None:
    parsed = urllib.parse.urlsplit(url)
    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError(f"Rejected URL with invalid port: {url}") from error
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.hostname != allowed_host
        or port not in (None, 443)
        or parsed.username
        or parsed.password
        or parsed.fragment
    ):
        raise ValueError(f"Rejected URL: {url}")


def assert_safe_source_page(url: str) -> None:
    parsed = urllib.parse.urlsplit(url)
    try:
        port = parsed.port
    except ValueError as error:
        raise ValueError(f"Rejected source page with invalid port: {url}") from error
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or port not in (None, 443)
        or parsed.username
        or parsed.password
        or parsed.fragment
    ):
        raise ValueError(f"Rejected source page: {url}")


def resolve_public_addresses(host: str, port: int = 443) -> tuple[str, ...]:
    """Resolve a host once and return only globally routable address literals."""

    try:
        answers = socket.getaddrinfo(
            host,
            port,
            type=socket.SOCK_STREAM,
            proto=socket.IPPROTO_TCP,
        )
    except socket.gaierror as error:
        raise ValueError(f"Could not resolve image host {host}") from error

    addresses: list[str] = []
    for _family, _socktype, _proto, _canonname, sockaddr in answers:
        address = str(sockaddr[0])
        try:
            parsed = ipaddress.ip_address(address)
        except ValueError as error:
            raise ValueError(f"Resolver returned an invalid address for {host}") from error
        if not parsed.is_global:
            raise ValueError(f"Image host {host} resolved to non-public address {address}")
        if address not in addresses:
            addresses.append(address)

    if not addresses:
        raise ValueError(f"Image host {host} did not resolve to an address")
    return tuple(addresses)


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    """Connect to a validated IP while retaining the original TLS hostname."""

    def connect(self) -> None:
        if self._tunnel_host:
            raise OSError("HTTP CONNECT tunnels are disabled for catalog downloads")

        port = self.port or 443
        addresses = resolve_public_addresses(self.host, port)
        last_error: OSError | None = None
        for address in addresses:
            candidate: socket.socket | None = None
            try:
                candidate = socket.create_connection(
                    (address, port),
                    self.timeout,
                    self.source_address,
                )
                expected_peer = ipaddress.ip_address(address)
                actual_peer = ipaddress.ip_address(candidate.getpeername()[0])
                if actual_peer != expected_peer:
                    raise OSError(f"Peer address changed for {self.host}: {actual_peer}")
                self.sock = candidate
                break
            except OSError as error:
                if candidate is not None:
                    candidate.close()
                last_error = error
        else:
            raise OSError(f"Could not connect to validated host {self.host}") from last_error

        try:
            self.sock = self._context.wrap_socket(
                self.sock,
                server_hostname=self.host,
            )
        except BaseException:
            self.sock.close()
            self.sock = None
            raise


class PinnedHTTPSHandler(urllib.request.HTTPSHandler):
    def https_open(self, request: urllib.request.Request):
        return self.do_open(
            PinnedHTTPSConnection,
            request,
            context=self._context,
            check_hostname=self._check_hostname,
        )


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    max_repeats = 2
    max_redirections = 5

    def __init__(self, allowed_host: str) -> None:
        super().__init__()
        self.allowed_host = allowed_host

    def redirect_request(self, request, response, code, message, headers, new_url):
        target = urllib.parse.urljoin(request.full_url, new_url)
        assert_safe_https(target, self.allowed_host)
        # Fail before the redirect is followed. The connection handler resolves
        # again and pins the actual socket to one of these public addresses.
        resolve_public_addresses(self.allowed_host)
        return super().redirect_request(
            request,
            response,
            code,
            message,
            headers,
            target,
        )


def build_safe_opener(allowed_host: str):
    return urllib.request.build_opener(
        urllib.request.ProxyHandler({}),
        SafeRedirectHandler(allowed_host),
        PinnedHTTPSHandler(),
    )


def assert_raster_magic(payload: bytes) -> None:
    is_jpeg = payload.startswith(b"\xff\xd8\xff")
    is_png = payload.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = payload.startswith(b"RIFF") and payload[8:12] == b"WEBP"
    is_avif = len(payload) > 12 and payload[4:8] == b"ftyp"
    if not (is_jpeg or is_png or is_webp or is_avif):
        raise ValueError("Downloaded body does not have a supported raster signature")


def fetch(asset: Asset) -> tuple[bytes, str, str]:
    parsed_asset_url = urllib.parse.urlsplit(asset.asset_url)
    allowed_host = parsed_asset_url.hostname
    if not allowed_host:
        raise ValueError(f"{asset.slug}: asset URL has no hostname")
    assert_safe_https(asset.asset_url, allowed_host)
    assert_safe_source_page(asset.source_page)
    resolve_public_addresses(allowed_host)

    request = urllib.request.Request(
        asset.asset_url,
        headers={
            "Accept": "image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1",
            "Referer": asset.source_page,
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/138.0.0.0 Safari/537.36"
            ),
        },
    )

    opener = build_safe_opener(allowed_host)
    with opener.open(request, timeout=30) as response:
        final_url = response.geturl()
        assert_safe_https(final_url, allowed_host)
        content_type = response.headers.get_content_type().lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"{asset.slug}: unsupported image MIME type {content_type}")
        declared_size = response.headers.get("Content-Length")
        if declared_size:
            try:
                parsed_size = int(declared_size)
            except ValueError as error:
                raise ValueError(f"{asset.slug}: invalid Content-Length") from error
            if parsed_size < 0 or parsed_size > MAX_DOWNLOAD_BYTES:
                raise ValueError(f"{asset.slug}: declared file is too large")

        chunks: list[bytes] = []
        received = 0
        while True:
            chunk = response.read(64 * 1024)
            if not chunk:
                break
            received += len(chunk)
            if received > MAX_DOWNLOAD_BYTES:
                raise ValueError(f"{asset.slug}: download exceeded byte limit")
            chunks.append(chunk)

    payload = b"".join(chunks)
    assert_raster_magic(payload)
    return payload, content_type, final_url


def normalize(payload: bytes, slug: str) -> tuple[bytes, tuple[int, int]]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as probe:
                width, height = probe.size
                pixels = width * height
                if pixels < MIN_PIXELS or pixels > MAX_PIXELS:
                    raise ValueError(f"{slug}: invalid source dimensions {width}x{height}")
                probe.verify()

            with Image.open(io.BytesIO(payload)) as source:
                if source.size != (width, height):
                    raise ValueError(f"{slug}: dimensions changed while decoding")
                source.load()
                clean = ImageOps.exif_transpose(source)
                if clean.mode in {"RGBA", "LA"} or (
                    clean.mode == "P" and "transparency" in clean.info
                ):
                    rgba = clean.convert("RGBA")
                    base = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                    base.alpha_composite(rgba)
                    clean = base.convert("RGB")
                else:
                    clean = clean.convert("RGB")

                contained = ImageOps.contain(clean, CANVAS_SIZE, Image.Resampling.LANCZOS)
                canvas = Image.new("RGB", CANVAS_SIZE, "white")
                offset = (
                    (CANVAS_SIZE[0] - contained.width) // 2,
                    (CANVAS_SIZE[1] - contained.height) // 2,
                )
                canvas.paste(contained, offset)

                output = io.BytesIO()
                canvas.save(output, "WEBP", quality=88, method=6, exact=True)
                normalized = output.getvalue()

        with Image.open(io.BytesIO(normalized)) as final:
            final.verify()
            if final.format != "WEBP" or final.size != CANVAS_SIZE:
                raise ValueError(f"{slug}: invalid normalized output")
        return normalized, (width, height)
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
    ) as error:
        raise ValueError(f"{slug}: Pillow rejected the image") from error


def main() -> None:
    if len(ASSETS) != 30 or len({asset.slug for asset in ASSETS}) != 30:
        raise RuntimeError("Catalog asset list must contain 30 unique slugs")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(UTC).replace(microsecond=0).isoformat()
    manifest_items: list[dict[str, object]] = []

    with tempfile.TemporaryDirectory(prefix="catalog-assets-") as temp_name:
        temp_dir = Path(temp_name)
        for index, asset in enumerate(ASSETS, start=1):
            print(f"[{index:02d}/30] {asset.slug}", flush=True)
            payload, content_type, final_url = fetch(asset)
            normalized, source_dimensions = normalize(payload, asset.slug)
            output_path = temp_dir / f"{asset.slug}.webp"
            output_path.write_bytes(normalized)
            manifest_items.append(
                {
                    "slug": asset.slug,
                    "source_page": asset.source_page,
                    "asset_url": asset.asset_url,
                    "resolved_asset_url": final_url,
                    "fetched_at": fetched_at,
                    "source_content_type": content_type,
                    "source_bytes": len(payload),
                    "source_dimensions": list(source_dimensions),
                    "source_sha256": sha256(payload),
                    "file": f"{asset.slug}.webp",
                    "output_bytes": len(normalized),
                    "output_dimensions": list(CANVAS_SIZE),
                    "output_sha256": sha256(normalized),
                    "usage": (
                        "demo/reference; replace with licensed supplier/API media before production"
                    ),
                }
            )

        manifest_payload = json.dumps(
            {
                "schema_version": 1,
                "generated_at": fetched_at,
                "notice": (
                    "Reference images for a private demo. Source links do not "
                    "grant a reuse licence. Replace with licensed supplier or "
                    "product-API assets before public production use."
                ),
                "items": manifest_items,
            },
            ensure_ascii=False,
            indent=2,
        )
        (temp_dir / "sources.json").write_text(f"{manifest_payload}\n", encoding="utf-8")

        expected_files = {f"{asset.slug}.webp" for asset in ASSETS}
        for old_file in OUTPUT_DIR.glob("*.webp"):
            if old_file.name not in expected_files:
                old_file.unlink()
        for source_file in temp_dir.iterdir():
            os.replace(source_file, OUTPUT_DIR / source_file.name)

    print(f"Wrote {len(manifest_items)} verified WebP assets and {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
