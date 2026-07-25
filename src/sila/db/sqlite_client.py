import sqlite3
import logging
from typing import Any

from config import SQLITE_DB_PATH
from src.sila.core.constants import STOP_WORDS, SearchLimits
from pathlib import Path


logger = logging.getLogger("sila.db.sqlite")


class SilaSQLiteClient:
    def __init__(self, db_path: str | Path = SQLITE_DB_PATH) -> None:
        self.db_path = db_path
        self.conn: sqlite3.Connection | None = None

    def __enter__(self) -> "SilaSQLiteClient":
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self.conn:
            if exc_type is None:
                self.conn.commit()
            else:
                self.conn.rollback()
            self.conn.close()

    def initialize_schema(self) -> None:
        """Creates tables with strict relational integrity."""
        with self as client:
            assert client.conn is not None
            cursor = client.conn.cursor()

            # 1. Media Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS media (
                    sila_id TEXT PRIMARY KEY,
                    filepath TEXT UNIQUE NOT NULL,
                    filename TEXT NOT NULL,
                    file_size INTEGER,
                    created_at REAL
                )
            """)

            # 2. Capsules Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS capsules (
                    capsule_id TEXT PRIMARY KEY,
                    parent_sila_id TEXT NOT NULL,
                    timestamp REAL NOT NULL,
                    blur_score REAL,
                    is_junk INTEGER DEFAULT 0,
                    cognitive_tags TEXT,
                    FOREIGN KEY(parent_sila_id) REFERENCES media(sila_id)
                )
            """)

            # 3. Operations Ledger Table for Symlink Rollbacks
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS operations (
                    op_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    op_type TEXT NOT NULL,
                    target_folder TEXT NOT NULL,
                    payload TEXT NOT NULL
                )
            """)
            logger.info("SQLite Schema initialized.")

    def upsert_media(self, media_data: dict[str, Any]) -> None:
        with self as client:
            assert client.conn is not None
            client.conn.execute(
                """
                INSERT OR REPLACE INTO media (sila_id, filepath, filename, file_size, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    media_data["sila_id"],
                    media_data["filepath"],
                    media_data["filename"],
                    media_data["file_size"],
                    media_data["created_at"],
                ),
            )

    def upsert_capsule_base(self, capsule_data: dict[str, Any]) -> None:
        """Inserts the frame record *before* ML inference runs."""
        with self as client:
            assert client.conn is not None
            client.conn.execute(
                """
                INSERT OR REPLACE INTO capsules (capsule_id, parent_sila_id, timestamp, blur_score, is_junk)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    capsule_data["capsule_id"],
                    capsule_data["parent_id"],
                    capsule_data["timestamp"],
                    capsule_data["blur_score"],
                    capsule_data.get("is_junk", 0),
                ),
            )

    def update_cognitive_tags(self, capsule_id: str, tags_json: str) -> None:
        """Updates the frame record *after* LLaVA generates the JSON."""
        with self as client:
            assert client.conn is not None
            client.conn.execute(
                "UPDATE capsules SET cognitive_tags = ? WHERE capsule_id = ?",
                (tags_json, capsule_id),
            )

    def lexical_search(
        self, text_query: str, limit: int = SearchLimits.KEYWORD_TEXT_SEARCH
    ) -> list[dict[str, Any]]:
        """Executes the exact token density match."""
        raw_words = [
            word.strip().lower() for word in text_query.split(" ") if word.strip()
        ]
        clean_tokens = [
            word for word in raw_words if word not in STOP_WORDS and len(word) > 1
        ]

        if not clean_tokens:
            clean_tokens = [text_query.lower()]

        base_query = """
            SELECT c.capsule_id, c.parent_sila_id as parent_id, c.timestamp, 
                   c.cognitive_tags, m.filepath, m.filename
            FROM capsules c 
            JOIN media m ON c.parent_sila_id = m.sila_id
            WHERE c.is_junk = 0 AND (1=0 
        """

        for _ in clean_tokens:
            base_query += (
                " OR LOWER(c.cognitive_tags) LIKE ? OR LOWER(m.filename) LIKE ?"
            )
        base_query += ")"

        params = []
        for token in clean_tokens:
            like_token = f"%{token}%"
            params.extend([like_token, like_token])

        with self as client:
            assert client.conn is not None
            cursor = client.conn.execute(base_query, params)
            rows = cursor.fetchall()

        # Token Density Scoring
        enriched_results = []
        for row in rows:
            row_dict = dict(row)
            tags_str = (
                row_dict["cognitive_tags"].lower() if row_dict["cognitive_tags"] else ""
            )
            filename_str = row_dict["filename"].lower()

            match_count = sum(
                1
                for token in clean_tokens
                if token in tags_str or token in filename_str
            )
            row_dict["match_count"] = match_count
            enriched_results.append(row_dict)

        enriched_results.sort(key=lambda x: x["match_count"], reverse=True)
        return enriched_results[:limit]

    def record_transaction(
        self, op_type: str, target_folder: str, payload_json: str
    ) -> int:
        """Records file operations for safe rollback."""
        with self as client:
            assert client.conn is not None
            cursor = client.conn.cursor()
            cursor.execute(
                "INSERT INTO operations (op_type, target_folder, payload) VALUES (?, ?, ?)",
                (op_type, target_folder, payload_json),
            )
            return cursor.lastrowid if cursor.lastrowid is not None else 0

    def get_last_transaction(self) -> dict[str, Any]:
        """Fetches the most recent file system transaction."""
        with self as client:
            assert client.conn is not None
            cursor = client.conn.cursor()
            cursor.execute(
                "SELECT op_id, op_type, target_folder, payload FROM operations ORDER BY op_id DESC LIMIT 1"
            )
            row = cursor.fetchone()
            return dict(row) if row else {}

    def delete_transaction(self, op_id: int) -> None:
        """Removes a transaction record after a successful revert."""
        with self as client:
            assert client.conn is not None
            client.conn.execute("DELETE FROM operations WHERE op_id = ?", (op_id,))
