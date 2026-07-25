import json
import logging
from pathlib import Path

from PIL import Image

from celery import Celery
from config import CELERY_BROKER_URL
from src.sila.core.constants import EmbeddingType
from src.sila.core.llm import SilaVisionEngine, SilaEmbeddingEngine

from src.sila.db.sqlite_client import SilaSQLiteClient
from src.sila.db.lancedb_client import SilaLanceDBClient
from typing import Any

logger = logging.getLogger("sila.workers")


celery_app = Celery("sila_tasks", broker=CELERY_BROKER_URL)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_redirect_stdouts=False,
)

_VISION_ENGINE: SilaVisionEngine | None = None
_IMAGE_EMBEDDER: SilaEmbeddingEngine | None = None
_TEXT_EMBEDDER: SilaEmbeddingEngine | None = None


@celery_app.task(bind=True, max_retries=3)  # type: ignore[untyped-decorator]
def process_vision_node(
    self: Any,
    capsule_id: str,
    image_path_str: str,
    parent_sila_id: str,
    timestamp: float,
) -> dict[str, Any]:
    """DAG Step 1: Reads pixels, generates text JSON, saves to SQLite."""
    global _VISION_ENGINE

    try:
        if _VISION_ENGINE is None:
            _VISION_ENGINE = SilaVisionEngine(
                "llava"
            )  # Pulls from VISION_MODEL_REGISTRY

        # 1. Run LLM Inference
        cognitive_json = _VISION_ENGINE.generate_cognitive_tags(Path(image_path_str))

        # 2. Save strictly to SQLite
        db = SilaSQLiteClient()
        db.update_cognitive_tags(capsule_id, cognitive_json)
        logger.info(f"Vision Engine processed capsule: {capsule_id}")

        # 3. Pass minimal payload down the DAG to the Embedding Node
        return {
            "capsule_id": capsule_id,
            "image_path_str": image_path_str,
            "parent_sila_id": parent_sila_id,
            "timestamp": timestamp,
        }

    except Exception as exc:
        logger.error(f"Vision failure on {capsule_id}: {exc}")
        raise self.retry(exc=exc, countdown=2**self.request.retries)


@celery_app.task(bind=True, max_retries=3)  # type: ignore[untyped-decorator]
def process_embedding_node(self: Any, pipeline_payload: dict[str, Any]) -> str:
    """DAG Step 2: Generates both dual-vectors and saves to LanceDB."""
    global _IMAGE_EMBEDDER, _TEXT_EMBEDDER

    capsule_id = pipeline_payload["capsule_id"]
    image_path_str = pipeline_payload["image_path_str"]
    parent_id = pipeline_payload["parent_sila_id"]
    timestamp = pipeline_payload["timestamp"]

    # Retrieve cognitive tags from SQLite (saved by Vision node)
    cognitive_tags = pipeline_payload.get("cognitive_tags")
    if not cognitive_tags:
        with SilaSQLiteClient() as db:
            assert db.conn is not None
            cursor = db.conn.cursor()
            cursor.execute(
                "SELECT cognitive_tags FROM capsules WHERE capsule_id = ?",
                (capsule_id,),
            )
            row = cursor.fetchone()
            cognitive_tags = (
                row["cognitive_tags"] if row and row["cognitive_tags"] else ""
            )

    try:
        if _IMAGE_EMBEDDER is None:
            _IMAGE_EMBEDDER = SilaEmbeddingEngine(EmbeddingType.VISION_LM)  # loads CLIP
        if _TEXT_EMBEDDER is None:
            _TEXT_EMBEDDER = SilaEmbeddingEngine(
                EmbeddingType.SENTENCE_MODEL
            )  # loads MiniLM

        # 1. Image -> Vector (Direct Pixel mapping)
        img = Image.open(image_path_str)
        image_vector = _IMAGE_EMBEDDER.generate_embedding(img)

        # 2. JSON -> Natural Text -> Vector
        try:
            # Strip raw JSON syntax, so it doesn't pollute the text embedding math
            cog_dict = json.loads(cognitive_tags)
            clean_text = f"{cog_dict.get('scene_description', '')}. {', '.join(cog_dict.get('keywords', []))}"
        except json.JSONDecodeError:
            clean_text = cognitive_tags

        text_vector = _TEXT_EMBEDDER.generate_embedding(clean_text)

        # 3. Save both vectors safely to LanceDB
        lancedb_client = SilaLanceDBClient()
        lancedb_client.upsert_vectors(
            capsule_id=capsule_id,
            image_vector=image_vector,
            text_vector=text_vector,
            parent_id=parent_id,
            timestamp=timestamp,
        )
        logger.info(f"Embedding Engine indexed capsule: {capsule_id}")

        return str(capsule_id)

    except Exception as exc:
        logger.error(f"Embedding failure on {capsule_id}: {exc}")
        raise self.retry(exc=exc, countdown=2**self.request.retries)
