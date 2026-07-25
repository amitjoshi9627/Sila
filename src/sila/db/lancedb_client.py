import lancedb
import pyarrow as pa
import logging
from typing import Any, cast
from config import LANCEDB_URI, LANCEDB_TABLE_NAME
from src.sila.core.constants import (
    IMAGE_VECTOR_COL,
    TEXT_VECTOR_COL,
    VECTOR_DIM_IMAGE,
    VECTOR_DIM_TEXT,
    SEARCH_DISTANCE_METRIC,
)

logger = logging.getLogger("sila.db.lancedb")


class SilaLanceDBClient:
    def __init__(
        self, uri: Any = LANCEDB_URI, table_name: str = LANCEDB_TABLE_NAME
    ) -> None:

        self.db = lancedb.connect(str(uri))
        self.table_name = table_name

    def initialize_schema(self) -> None:
        """Creates the dual-vector schema using PyArrow."""
        schema = pa.schema(
            [
                pa.field(IMAGE_VECTOR_COL, pa.list_(pa.float32(), VECTOR_DIM_IMAGE)),
                pa.field(TEXT_VECTOR_COL, pa.list_(pa.float32(), VECTOR_DIM_TEXT)),
                pa.field("capsule_id", pa.string()),
                pa.field("parent_sila_id", pa.string()),
                pa.field("timestamp", pa.float64()),
            ]
        )

        if self.table_name not in self.db.table_names():
            self.db.create_table(self.table_name, schema=schema)
            logger.info("LanceDB Schema initialized.")

    def upsert_vectors(
        self,
        capsule_id: str,
        image_vector: list[float],
        text_vector: list[float],
        parent_id: str,
        timestamp: float,
    ) -> None:
        """Saves both the physical pixel vector and the conceptual text vector."""
        table = self.db.open_table(self.table_name)

        data = [
            {
                IMAGE_VECTOR_COL: image_vector,
                TEXT_VECTOR_COL: text_vector,
                "capsule_id": capsule_id,
                "parent_sila_id": parent_id,
                "timestamp": timestamp,
            }
        ]

        # LanceDB allows deletion by string match for pure upsert behavior
        table.delete(f"capsule_id = '{capsule_id}'")
        table.add(data)

    def vector_search(
        self, query_vector: list[float], column_name: str, limit: int, threshold: float
    ) -> list[dict[str, Any]]:
        """Queries a specific vector column (Image vs Text)."""
        if self.table_name not in self.db.table_names():
            return []

        table = self.db.open_table(self.table_name)

        if len(table) == 0:
            logger.debug(f"No Table for {column_name}")
            return []
        # Execute ANN search targeting only the requested column
        results = (
            table.search(query_vector, vector_column_name=column_name)
            .metric(SEARCH_DISTANCE_METRIC)
            .distance_range(upper_bound=threshold)
            .limit(limit)
            .to_arrow()
            .to_pylist()
        )
        return cast(list[dict[str, Any]], results)
