import pytest
import tempfile
from pathlib import Path
import base64
import os

from src.sila.core.utils import get_base64_image

def test_get_base64_image():
    # Create a dummy text file to simulate an image
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        test_data = b"dummy image data"
        temp_file.write(test_data)
        temp_path = Path(temp_file.name)
        
    try:
        b64_str = get_base64_image(temp_path)
        expected = base64.b64encode(test_data).decode("utf-8")
        assert b64_str == expected
    finally:
        os.unlink(temp_path)
