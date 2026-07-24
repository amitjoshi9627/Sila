"""Sila Core Low-Level Utilities and Helper Functions."""

import base64
from pathlib import Path


def get_base64_image(image_path: Path) -> str:
    """Reads a local image file and converts it into a clean base64 string."""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")
