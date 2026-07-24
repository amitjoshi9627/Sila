from dataclasses import dataclass
from enum import StrEnum


class EmbeddingType(StrEnum):
    VISION_LM = "vision_lm"
    SENTENCE_MODEL = "sentence_model"


# --- Schema Definitions (Model Specific Vector Parameters) ---
IMAGE_VECTOR_COL = "image_vector"
TEXT_VECTOR_COL = "text_vector"
VECTOR_DIM_IMAGE = 512  # CLIP-ViT-B-32
VECTOR_DIM_TEXT = 384  # all-MiniLM-L6-v2

# --- Search Configuration ---
SEARCH_DISTANCE_METRIC = "cosine"

# --- Image Quality & Scene Analysis Parameters ---
MIN_VARIANCE_THRESHOLD = 5.0
MAX_VARIANCE_THRESHOLD = 800.0
SCENE_SIMILARITY_THRESHOLD = 0.92


@dataclass
class SearchLimits:
    KEYWORD_TEXT_SEARCH: int = 15
    SEMANTIC_TEXT_SEARCH: int = 15
    SEMANTIC_IMAGE_SEARCH: int = 15


@dataclass
class DistanceThreshold:
    SEMANTIC_TEXT_SEARCH: float = 0.775
    SEMANTIC_IMAGE_SEARCH: float = 0.775


STOP_WORDS = frozenset(
    {
        "and",
        "with",
        "the",
        "for",
        "a",
        "an",
        "in",
        "of",
        "to",
        "is",
        "at",
        "by",
        "from",
        "this",
        "that",
        "on",
    }
)
