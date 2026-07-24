import numpy as np
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
import tempfile
import shutil

from src.sila.pipeline.scanner import SilaMediaScanner

@pytest.fixture
def temp_media_dir():
    temp_dir = tempfile.mkdtemp()
    
    # Create a dummy image file
    image_path = Path(temp_dir) / "test_image.jpg"
    image_path.touch()
    
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
    
    # Mock the internal calculate blur method so we don't need real images
    with patch.object(scanner, '_calculate_blur_score', return_value=0.5):
        scanner.scan_and_slice()
        
    # Verify the database was called to register the media
    mock_db.upsert_media.assert_called_once()
    
    # Verify the capsule base was inserted
    mock_db.upsert_capsule_base.assert_called_once()
    
    # Verify the DAG dispatcher was called
    mock_dispatcher_class.dispatch_capsule.assert_called_once()
