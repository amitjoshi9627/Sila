import json
import logging
from typing import Any

from src.sila.core.constants import (
    EmbeddingType,
    SearchLimits,
    DistanceThreshold,
    IMAGE_VECTOR_COL,
    TEXT_VECTOR_COL,
)
from src.sila.core.llm import SilaEmbeddingEngine
from src.sila.db.sqlite_client import SilaSQLiteClient
from src.sila.db.lancedb_client import SilaLanceDBClient

logger = logging.getLogger("sila.search.engine")


class SilaHybridSearchEngine:
    def __init__(self):
        self.sqlite_client = SilaSQLiteClient()
        self.lancedb_client = SilaLanceDBClient()

        # Instantiate the Text embedder specifically for querying
        logger.info("Initializing Search Engine TEXT Embedder...")
        self.text_embedder = SilaEmbeddingEngine(EmbeddingType.SENTENCE_MODEL)
        self.vision_embedder = SilaEmbeddingEngine(EmbeddingType.VISION_LM)

    def execute_query(self, text_query: str, limit: int = 15) -> list[dict[str, Any]]:
        """The single public method to execute a Tri-Modal Search."""
        logger.info(f"Executing Tri-Modal Search for: '{text_query}'")

        # 1. Transform the query string into math
        text_vector = self.text_embedder.generate_embedding(text_query)
        vision_lm_vector = self.vision_embedder.generate_embedding(text_query)

        # 2. Track 1: Lexical (SQLite Token Density)
        lexical_results = self.sqlite_client.lexical_search(
            text_query, limit=SearchLimits.KEYWORD_TEXT_SEARCH
        )

        # 3. Track 2: Visual Semantics (LanceDB Image Pixels)
        visual_results = self.lancedb_client.vector_search(
            vision_lm_vector,
            column_name=IMAGE_VECTOR_COL,
            limit=SearchLimits.SEMANTIC_IMAGE_SEARCH,
            threshold=DistanceThreshold.SEMANTIC_IMAGE_SEARCH,
        )

        # 4. Track 3: Conceptual Semantics (LanceDB LLaVA Text)
        conceptual_results = self.lancedb_client.vector_search(
            text_vector,
            column_name=TEXT_VECTOR_COL,
            limit=SearchLimits.SEMANTIC_TEXT_SEARCH,
            threshold=DistanceThreshold.SEMANTIC_TEXT_SEARCH,
        )

        # 5. Fuse, Hydrate, and Group
        rrf_scores = self._score_rrf(
            lexical_results, visual_results, conceptual_results
        )
        final_list = self._hydrate_and_group(rrf_scores, limit)

        return final_list

    @staticmethod
    def _score_rrf(
        lexical: list[dict], visual: list[dict], conceptual: list[dict]
    ) -> dict[str, float]:
        """Mathematically merges disparate ranking lists based on position, not raw score."""
        k = 60
        scores = {}

        # Score Track 1 (Includes exact-match density bonus)
        for rank, item in enumerate(lexical):
            cid = item["capsule_id"]
            bonus = item.get("match_count", 1) * 0.05
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (k + rank + 1)) + bonus

        # Score Track 2
        for rank, item in enumerate(visual):
            cid = item["capsule_id"]
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (k + rank + 1))

        # Score Track 3
        for rank, item in enumerate(conceptual):
            cid = item["capsule_id"]
            scores[cid] = scores.get(cid, 0.0) + (1.0 / (k + rank + 1))

        return scores

    def _parse_cognitive_tags(self, raw_tags: str | None) -> dict[str, Any]:
        """
        Cleans and normalizes LLM-generated JSON strings.
        Removes escaped formatting sequences and parsing padding introduced during indexing.
        """
        if not raw_tags:
            return {}

        try:
            # Strip trailing white spaces and clear Markdown text escape characters (\_)
            cleaned_tags = raw_tags.strip().replace("\\_", "_")
            return json.loads(cleaned_tags)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(
                f"Malformation caught during cognitive tags serialization: {e}. Falling back to raw block."
            )
            return {"raw_output": raw_tags.strip()}

    def _hydrate_and_group(
        self, rrf_scores: dict[str, float], limit: int
    ) -> list[dict[str, Any]]:
        """Fetches final UI metadata for the top IDs and groups them by parent video."""
        if not rrf_scores:
            return []

        # Extract, sort, and slice target dataset
        sorted_cids = sorted(
            rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True
        )[:limit]

        parents: dict[str, dict[str, Any]] = {}

        with self.sqlite_client as db:
            cursor = db.conn.cursor()

            for cid in sorted_cids:
                cursor.execute(
                    """
                    SELECT c.capsule_id, c.parent_sila_id as parent_id, c.timestamp, 
                           c.cognitive_tags, c.is_junk, c.blur_score, m.filepath, m.filename, m.file_size, m.created_at
                    FROM capsules c
                    JOIN media m ON c.parent_sila_id = m.sila_id
                    WHERE c.capsule_id = ?
                    """,
                    (cid,),
                )

                row = cursor.fetchone()
                if row:
                    item = dict(row)
                    parent_id = item["parent_id"]

                    # Initialize the structured payload entry if first encounter
                    if parent_id not in parents:
                        filename = item["filename"]
                        ext = filename.split(".")[-1].lower() if "." in filename else ""
                        media_type = (
                            "video" if ext in ["mp4", "mov", "mkv", "avi"] else "photo"
                        )

                        parents[parent_id] = {
                            "parent_id": parent_id,
                            "filepath": item["filepath"],
                            "filename": filename,
                            "media_type": media_type,
                            "file_size": item["file_size"],
                            "created_at": item["created_at"],
                            "max_score": rrf_scores[cid],
                            "capsules": [],
                        }

                    # Clean string formats via dedicated sub-parser layer
                    cleaned_tags = self._parse_cognitive_tags(item["cognitive_tags"])

                    parents[parent_id]["capsules"].append(
                        {
                            "capsule_id": item["capsule_id"],
                            "timestamp": item["timestamp"],
                            "cognitive": cleaned_tags,
                            "score": round(rrf_scores[cid], 4),
                            "is_junk": item["is_junk"],
                            "blur_score": item["blur_score"]
                            if item["blur_score"] is not None
                            else 0.0,
                        }
                    )

        # Enforce linear hierarchical sort relative to top scoring child element
        return sorted(parents.values(), key=lambda x: x["max_score"], reverse=True)
