import os
from pathlib import Path

# --- Core Project & Cache Paths ---
PROJECT_ROOT = Path(__file__).resolve().parent
SILA_CACHE_DIR = PROJECT_ROOT / ".sila_cache"
SILA_CACHE_DIR.mkdir(parents=True, exist_ok=True)

MODEL_DIR = SILA_CACHE_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

FRAMES_DIR = SILA_CACHE_DIR / "frames"
FRAMES_DIR.mkdir(parents=True, exist_ok=True)

HF_CACHE_DIR = SILA_CACHE_DIR / "huggingface"
HF_CACHE_DIR.mkdir(parents=True, exist_ok=True)

TORCH_CACHE_DIR = SILA_CACHE_DIR / "torch"
TORCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)

EXPORTS_DIR = PROJECT_ROOT / "Sila Exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Set global environment variables for cache directories
os.environ["HF_HOME"] = str(HF_CACHE_DIR)
os.environ["TRANSFORMERS_CACHE"] = str(HF_CACHE_DIR)
os.environ["TORCH_HOME"] = str(TORCH_CACHE_DIR)

# --- Database & Storage Settings ---
SQLITE_DB_PATH = SILA_CACHE_DIR / "sila_meta.db"
LANCEDB_URI = SILA_CACHE_DIR / "sila_lancedb"

LANCEDB_TABLE_NAME = "sila_multimodal_vectors"

# --- Model & Weight Definitions ---
LLAVA_REPO_ID = "second-state/Llava-v1.5-7B-GGUF"
LLM_FILE = "llava-v1.5-7b-Q4_K_M.gguf"
VISION_FILE = "llava-v1.5-7b-mmproj-model-f16.gguf"

GEMMA_REPO_ID = "google/gemma-4-vision-gguf"
GEMMA_LLM_FILE = "gemma-4b-v-q4_k_m.gguf"

# --- Audio Models ---
# Change this to scale accuracy/speed (e.g., openai/whisper-tiny.en, openai/whisper-large-v3)
STT_MODEL_NAME = "openai/whisper-base.en"

CLIP_MODEL_NAME = "sentence-transformers/clip-ViT-B-32"
TEXT_EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# --- Supported File Extensions ---
VALID_VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".avi"}
VALID_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}
VALID_MEDIA_EXTENSIONS = VALID_VIDEO_EXTENSIONS | VALID_PHOTO_EXTENSIONS

# --- Server & Service Settings ---
API_TITLE = "Sila Multimodal Search API"
API_VERSION = "0.5.0"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
CELERY_BROKER_URL = "redis://localhost:6379/0"
