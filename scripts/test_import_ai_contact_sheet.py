from __future__ import annotations

import unittest

from PIL import Image, ImageChops, ImageDraw

from scripts.import_ai_contact_sheet import BACKGROUND, OUTPUT_SIZE, SAFE_INSET, normalize_panel


class NormalizePanelTests(unittest.TestCase):
    def test_preserves_complete_subject_and_adds_safe_inset(self) -> None:
        panel = Image.new("RGB", (400, 300), "white")
        ImageDraw.Draw(panel).rectangle((70, 80, 330, 220), fill=(35, 45, 55))

        output = normalize_panel(panel, 0)

        self.assertEqual(output.size, OUTPUT_SIZE)
        difference = ImageChops.difference(output, Image.new("RGB", output.size, BACKGROUND))
        bbox = difference.getbbox()
        self.assertIsNotNone(bbox)
        assert bbox is not None
        left, top, right, bottom = bbox
        self.assertGreaterEqual(left, SAFE_INSET[0])
        self.assertGreaterEqual(OUTPUT_SIZE[0] - right, SAFE_INSET[0])
        self.assertGreaterEqual(top, SAFE_INSET[1])
        self.assertGreaterEqual(OUTPUT_SIZE[1] - bottom, SAFE_INSET[1])

    def test_rejects_foreground_that_already_touches_panel_edge(self) -> None:
        panel = Image.new("RGB", (400, 300), "white")
        ImageDraw.Draw(panel).rectangle((0, 80, 200, 220), fill=(35, 45, 55))

        with self.assertRaisesRegex(RuntimeError, "touches a panel edge"):
            normalize_panel(panel, 3)

    def test_rear_view_keeps_separate_product_components(self) -> None:
        panel = Image.new("RGB", (400, 300), "white")
        draw = ImageDraw.Draw(panel)
        draw.rectangle((35, 65, 175, 235), fill=(52, 42, 82))
        draw.rectangle((225, 65, 365, 235), fill=(52, 42, 82))

        output = normalize_panel(panel, 3)

        center_y = OUTPUT_SIZE[1] // 2
        dark_runs = 0
        inside_dark = False
        for x in range(OUTPUT_SIZE[0]):
            is_dark = max(output.getpixel((x, center_y))) < 180
            if is_dark and not inside_dark:
                dark_runs += 1
            inside_dark = is_dark
        self.assertEqual(dark_runs, 2)


if __name__ == "__main__":
    unittest.main()
