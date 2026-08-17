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


class TrackingMetricType:
    ONLINE = "online"
    OFFLINE = "offline"


class TrackingMetric(StrEnum):
    HYBRID_SEARCH = "hybrid_search"
    SQL_LEXICAL_SEARCH = "sql_lexical_search"
    SEMANTIC_IMAGE_SEARCH = "semantic_image_search"
    SEMANTIC_TEXT_SEARCH = "semantic_text_search"
    RANKING_FUSION = "ranking_fusion"
    IMAGE_CAPTIONING = "image_captioning"
    EMBEDDING = "embedding"
    TOTAL_MEDIA_INGEST = "total_media_ingest"
    FRAME_SHARPNESS = "frame_sharpness"
    VIDEO_SLICING = "video_slicing"
    WHISPER_STT = "whisper_stt"
    GROUPING_VIDEO_FRAMES = "grouping_video_frames"
    QUERY_EMBEDDING_GENERATION = "query_embedding_generation"
    EXPORT_ALBUM = "export_album"


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

TRACKING_FRIENDLY_NAMES = {
    f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.HYBRID_SEARCH}": "Hybrid Search (Total)",
    f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.SQL_LEXICAL_SEARCH}": "Lexical Search (SQLite)",
    f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.SEMANTIC_IMAGE_SEARCH}": "Image Vector Search",
    f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.SEMANTIC_TEXT_SEARCH}": "Text Vector Search",
    f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.RANKING_FUSION}": "Reciprocal Rank Fusion (RRF)",
    f"track_{TrackingMetricType.OFFLINE}_{TrackingMetric.IMAGE_CAPTIONING}": "Image Captioning",
    f"track_{TrackingMetricType.OFFLINE}_{TrackingMetric.EMBEDDING}": "Embedding Generation",
    f"track_{TrackingMetricType.OFFLINE}_{TrackingMetric.TOTAL_MEDIA_INGEST}": "Media Ingest Total",
    f"track_{TrackingMetricType.OFFLINE}_{TrackingMetric.FRAME_SHARPNESS}": "Frame Sharpness Audit",
    f"track_{TrackingMetricType.OFFLINE}_{TrackingMetric.VIDEO_SLICING}": "Video Frame Slicing",
    f"track_{TrackingMetricType.OFFLINE}_{TrackingMetric.WHISPER_STT}": "Whisper Speech-to-Text",
    f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.GROUPING_VIDEO_FRAMES}": "Frame Grouping",
    f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.QUERY_EMBEDDING_GENERATION}": "Query Embedding",
    f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.EXPORT_ALBUM}": "Symlink Album Export",
}
