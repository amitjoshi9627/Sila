import numpy as np
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
import tempfile
import shutil

from src.sila.vision.sharpness import SharpnessResult
from src.sila.pipeline.scanner import SilaMediaScanner

@pytest.fixture
def temp_media_dir():
    temp_dir = tempfile.mkdtemp()
    
    # Create a dummy image file with non-zero size
    image_path = Path(temp_dir) / "test_image.jpg"
    image_path.write_bytes(b"dummy image bytes")
    
    yield temp_dir
    shutil.rmtree(temp_dir)

@patch("src.sila.pipeline.scanner.cv2.imread")
@patch("src.sila.pipeline.scanner.cv2.imwrite")
@patch("src.sila.pipeline.scanner.SilaSQLiteClient")
@patch("src.sila.pipeline.scanner.SilaDAGDispatcher")
def test_media_scanner(mock_dispatcher_class, mock_sqlite_class, mock_imwrite, mock_imread, temp_media_dir):
    # Mock cv2 imread to return a dummy image array (so it's not None)
    dummy_image = np.zeros((100, 100, 3), dtype=np.uint8)
    mock_imread.return_value = dummy_image
    
    def fake_imwrite(filename, img, *args, **kwargs):
        Path(filename).touch()
        return True
    mock_imwrite.side_effect = fake_imwrite
    
    mock_db = MagicMock()
    mock_sqlite_class.return_value = mock_db
    
    # Initialize the scanner
    scanner = SilaMediaScanner(temp_media_dir)
    
    # Mock the sharpness analyzer so we don't need real image sharpness processing
    mock_sharpness = MagicMock()
    mock_sharpness.analyze.return_value = SharpnessResult(
        overall_score=0.85, focus_coverage=0.9, verdict="Good"
    )
    scanner.sharpness_analyzer = mock_sharpness
    scanner.scan_and_slice()
        
    # Verify the database was called to register the media
    mock_db.upsert_media.assert_called_once()
    
    # Verify the capsule base was inserted
    mock_db.upsert_capsule_base.assert_called_once()
    
    # Verify the DAG dispatcher was called
    mock_dispatcher_class.dispatch_capsule.assert_called_once()


@patch("src.sila.pipeline.scanner.SilaSQLiteClient")
def test_scanner_skips_zero_byte_files(mock_sqlite_class):
    temp_dir = tempfile.mkdtemp()
    try:
        zero_file = Path(temp_dir) / "zero_bytes.jpg"
        zero_file.touch()  # Creates a 0-byte file

        mock_db = MagicMock()
        mock_sqlite_class.return_value = mock_db

        scanner = SilaMediaScanner(temp_dir)
        scanner.scan_and_slice()

        # Database should NOT be called for 0-byte files
        mock_db.upsert_media.assert_not_called()
    finally:
        shutil.rmtree(temp_dir)
