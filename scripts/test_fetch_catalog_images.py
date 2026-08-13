from __future__ import annotations

import socket
import unittest
import urllib.request
from unittest import mock

import fetch_catalog_images as catalog


class SafeUrlTests(unittest.TestCase):
    def test_accepts_only_expected_https_host_and_default_tls_port(self) -> None:
        catalog.assert_safe_https("https://images.example.test/item.webp", "images.example.test")
        catalog.assert_safe_https(
            "https://images.example.test:443/item.webp",
            "images.example.test",
        )

        rejected = (
            "http://images.example.test/item.webp",
            "https://other.example.test/item.webp",
            "https://images.example.test:444/item.webp",
            "https://user@images.example.test/item.webp",
            "https://images.example.test/item.webp#fragment",
        )
        for url in rejected:
            with self.subTest(url=url), self.assertRaises(ValueError):
                catalog.assert_safe_https(url, "images.example.test")

    @mock.patch.object(catalog.socket, "getaddrinfo")
    def test_resolver_rejects_any_non_public_answer(self, getaddrinfo) -> None:
        getaddrinfo.return_value = [
            (
                socket.AF_INET,
                socket.SOCK_STREAM,
                socket.IPPROTO_TCP,
                "",
                ("93.184.216.34", 443),
            ),
            (
                socket.AF_INET,
                socket.SOCK_STREAM,
                socket.IPPROTO_TCP,
                "",
                ("127.0.0.1", 443),
            ),
        ]
        with self.assertRaisesRegex(ValueError, "non-public"):
            catalog.resolve_public_addresses("images.example.test")

    def test_redirect_is_rejected_before_following_to_another_host(self) -> None:
        handler = catalog.SafeRedirectHandler("images.example.test")
        request = urllib.request.Request("https://images.example.test/item")
        with self.assertRaises(ValueError):
            handler.redirect_request(
                request,
                None,
                302,
                "Found",
                {},
                "https://127.0.0.1/private",
            )

    def test_opener_disables_environment_proxies_and_pins_https(self) -> None:
        with mock.patch.object(
            urllib.request,
            "getproxies",
            return_value={"https": "http://127.0.0.1:8080"},
        ) as getproxies:
            opener = catalog.build_safe_opener("images.example.test")
        getproxies.assert_not_called()
        self.assertTrue(
            any(isinstance(handler, catalog.SafeRedirectHandler) for handler in opener.handlers)
        )
        self.assertTrue(
            any(isinstance(handler, catalog.PinnedHTTPSHandler) for handler in opener.handlers)
        )


class ImageLimitTests(unittest.TestCase):
    def test_pixel_limit_is_checked_before_verify_or_load(self) -> None:
        class OversizedImage:
            size = (5_001, 5_000)

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def verify(self):
                raise AssertionError("verify must not run for oversized headers")

            def load(self):
                raise AssertionError("load must not run for oversized headers")

        with (
            mock.patch.object(catalog.Image, "open", return_value=OversizedImage()),
            self.assertRaisesRegex(ValueError, "invalid source dimensions"),
        ):
            catalog.normalize(b"untrusted", "oversized")

    def test_decompression_bomb_warning_fails_closed(self) -> None:
        with (
            mock.patch.object(
                catalog.Image,
                "open",
                side_effect=catalog.Image.DecompressionBombWarning("bomb"),
            ),
            self.assertRaisesRegex(ValueError, "Pillow rejected"),
        ):
            catalog.normalize(b"untrusted", "bomb")


if __name__ == "__main__":
    unittest.main()
