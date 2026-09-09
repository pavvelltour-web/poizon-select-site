"""Verify the rear pair's documented width cap without relaxing other gates."""
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

try:
    from scripts.verify_trainer_frame import BACKGROUND, SIZE, measure
except ModuleNotFoundError:
    from verify_trainer_frame import BACKGROUND, SIZE, measure


class TrainerRearWidthCapTests(unittest.TestCase):
    def measure_pair(self, width, height, position=4):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pair.png"
            image = Image.new("RGB", SIZE, BACKGROUND)
            draw = ImageDraw.Draw(image)
            left, top = (SIZE[0] - width) // 2, (SIZE[1] - height) // 2
            draw.rectangle((left, top, left + width // 2 - 20, top + height - 1), fill=(30, 40, 50))
            draw.rectangle((left + width // 2 + 20, top, left + width - 1, top + height - 1), fill=(30, 40, 50))
            image.save(path)
            return measure(path, position)

    def test_wide_rear_pair_may_reach_width_cap_before_target_height(self):
        result = self.measure_pair(1184, 688)
        self.assertTrue(result["pixel_checks_passed"])

    def test_small_rear_pair_does_not_reach_either_target(self):
        self.assertFalse(self.measure_pair(1100, 650)["checks"]["scale"])

    def test_oversized_rear_pair_still_fails_width_or_height_bound(self):
        for width, height in ((1250, 688), (1184, 805)):
            with self.subTest(width=width, height=height):
                self.assertFalse(self.measure_pair(width, height)["checks"]["scale"])

    def test_outsole_does_not_inherit_rear_width_cap_exception(self):
        self.assertFalse(self.measure_pair(1184, 688, position=5)["checks"]["scale"])


if __name__ == "__main__":
    unittest.main()
