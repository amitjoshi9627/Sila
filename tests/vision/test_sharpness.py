import tempfile
from pathlib import Path
import numpy as np
import cv2
import pytest

from src.sila.vision.sharpness import SilaSharpnessAnalyzer, SharpnessResult


@pytest.fixture
def temp_image_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


def test_sharpness_error_on_missing_file(temp_image_dir):
    analyzer = SilaSharpnessAnalyzer()
    non_existent = temp_image_dir / "non_existent.jpg"
    result = analyzer.analyze(non_existent)

    assert isinstance(result, SharpnessResult)
    assert result.overall_score == 0.0
    assert result.focus_coverage == 0.0
    assert result.verdict == "Error"


def test_sharpness_uniform_blurry_image(temp_image_dir):
    analyzer = SilaSharpnessAnalyzer()
    # Create a perfectly uniform flat gray image (no edges)
    flat_img = np.full((300, 300), 128, dtype=np.uint8)
    img_path = temp_image_dir / "flat_gray.jpg"
    cv2.imwrite(str(img_path), flat_img)

    result = analyzer.analyze(img_path)

    assert isinstance(result, SharpnessResult)
    assert result.overall_score == 0.0
    assert result.verdict == "Blurry"


def test_sharpness_high_contrast_sharp_image(temp_image_dir):
    analyzer = SilaSharpnessAnalyzer()
    # Create a high-contrast checkerboard image with sharp edges
    size = 400
    block_size = 20
    checkerboard = np.zeros((size, size), dtype=np.uint8)
    for y in range(0, size, block_size):
        for x in range(0, size, block_size):
            if ((x // block_size) + (y // block_size)) % 2 == 0:
                checkerboard[y : y + block_size, x : x + block_size] = 255

    img_path = temp_image_dir / "sharp_checker.jpg"
    cv2.imwrite(str(img_path), checkerboard)

    result = analyzer.analyze(img_path)

    assert isinstance(result, SharpnessResult)
    assert result.overall_score > 0.0
    assert result.verdict in ["Good", "Excellent", "Acceptable"]
    assert 0.0 <= result.focus_coverage <= 1.0


def test_sharpness_tenengrad_and_edge_density():
    analyzer = SilaSharpnessAnalyzer()
    # High frequency noise vs zero array
    high_freq = np.random.randint(0, 256, (64, 64), dtype=np.uint8)
    zero_arr = np.zeros((64, 64), dtype=np.uint8)

    assert analyzer._tenengrad(high_freq) > analyzer._tenengrad(zero_arr)
    assert analyzer._edge_density(zero_arr) == 0.0
