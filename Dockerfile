# Use a slim Python 3.11 image to minimize attack surface and image size
FROM python:3.11-slim AS base

# Set environment variables for non-interactive installs and Python optimization
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive

# Install system-level dependencies required for OpenCV, FFmpeg, and compiling C++ bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for blazingly fast dependency resolution
RUN pip install uv

WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY pyproject.toml .

# Install dependencies into the system environment
RUN uv sync

# Copy the actual application source code
COPY src/ ./src/

# FIX: Create the cache directory safely instead of trying to copy it from the host
RUN mkdir -p .sila_cache

# The default command
CMD ["uv", "run", "uvicorn", "src.sila.api.server:app", "--host", "0.0.0.0", "--port", "8000"]