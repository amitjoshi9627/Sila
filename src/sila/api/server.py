"""Sila Gateway API Web Server - The HTTP wrapper for the Tri-Modal Engine."""

import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import API_TITLE, API_VERSION, EXPORTS_DIR, FRAMES_DIR
from src.sila.db.sqlite_client import SilaSQLiteClient
from src.sila.search.engine import SilaHybridSearchEngine

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sila.api.server")

app = FastAPI(title=API_TITLE, version=API_VERSION)

# Allow React/Frontend to communicate with this local API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global engine instance for lazy-loading memory persistence
_SEARCH_ENGINE = None


class UndoRequest(BaseModel):
    operation_id: Optional[str] = None


class ExportRequest(BaseModel):
    album_name: str
    parent_ids: list[str]


@app.get("/health")
def health_check() -> dict[str, str]:
    """Basic ping to verify the API gateway is alive."""
    return {"status": "online", "version": "0.5.0"}


@app.get("/api/search")
def search_media(
    query: str = Query(..., min_length=1), limit: int = 15
) -> list[dict[str, Any]]:
    """
    Executes a Tri-Modal search across exact text, semantic image, and semantic text.
    """
    global _SEARCH_ENGINE

    try:
        # 1. Cold Start: Load the ML models into memory only on the first search
        if _SEARCH_ENGINE is None:
            logger.info("Cold Start: Mounting SilaHybridSearchEngine to Apple Metal...")
            _SEARCH_ENGINE = SilaHybridSearchEngine()

        logger.info(f"API Routing Search Query: '{query}'")

        # 2. Delegate the heavy lifting to our encapsulated Object
        results = _SEARCH_ENGINE.execute_query(text_query=query, limit=limit)

        return results

    except Exception as e:
        logger.error(f"Search endpoint failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Search engine execution failed.")


@app.get("/api/proxy/{capsule_id}")
def proxy_image(capsule_id: str):
    """Serves the thumbnail image for a specific capsule."""
    image_path = FRAMES_DIR / f"{capsule_id}.jpg"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found.")
    return FileResponse(image_path)


@app.get("/api/stream/{parent_id}")
def stream_media(parent_id: str):
    """Streams the original source media file for deep viewing."""
    try:
        with SilaSQLiteClient() as db:
            cursor = db.conn.cursor()
            cursor.execute("SELECT filepath FROM media WHERE sila_id = ?", (parent_id,))
            row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404, detail="Media record not found in database."
            )

        file_path = Path(row["filepath"])
        if not file_path.exists():
            raise HTTPException(
                status_code=404, detail="Media file no longer exists on disk."
            )

        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stream media {parent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to stream media.")


@app.get("/api/media")
def get_all_media(limit: int = 100) -> list[dict[str, Any]]:
    """
    Fetches a list of all indexed media from the SQLite operations ledger.
    Used by the frontend to populate the default gallery view.
    """
    try:
        with SilaSQLiteClient() as db:
            cursor = db.conn.cursor()

            # 1. Fetch parents
            cursor.execute(
                "SELECT * FROM media ORDER BY created_at DESC LIMIT ?", (limit,)
            )
            media_rows = cursor.fetchall()

            if not media_rows:
                return []

            parent_ids = [row["sila_id"] for row in media_rows]
            placeholders = ",".join(["?"] * len(parent_ids))

            # 2. Fetch capsules
            cursor.execute(
                f"SELECT * FROM capsules WHERE parent_sila_id IN ({placeholders}) ORDER BY timestamp ASC",
                parent_ids,
            )
            capsule_rows = cursor.fetchall()

            capsules_by_parent = {}
            for crow in capsule_rows:
                pid = crow["parent_sila_id"]

                cognitive = {}
                if crow["cognitive_tags"]:
                    try:
                        cleaned = crow["cognitive_tags"].strip().replace("\\_", "_")
                        cognitive = json.loads(cleaned)
                    except Exception:
                        pass

                capsule_dict = {
                    "capsule_id": crow["capsule_id"],
                    "timestamp": crow["timestamp"],
                    "blur_score": crow["blur_score"]
                    if crow["blur_score"] is not None
                    else 0.0,
                    "is_junk": crow["is_junk"],
                    "score": None,
                    "cognitive": cognitive,
                }
                capsules_by_parent.setdefault(pid, []).append(capsule_dict)

            results = []
            for m in media_rows:
                pid = m["sila_id"]
                filename = m["filename"]
                ext = filename.split(".")[-1].lower() if "." in filename else ""
                media_type = "video" if ext in ["mp4", "mov", "mkv", "avi"] else "photo"

                results.append(
                    {
                        "parent_id": pid,
                        "filepath": m["filepath"],
                        "filename": filename,
                        "file_size": m["file_size"],
                        "created_at": m["created_at"],
                        "media_type": media_type,
                        "capsules": capsules_by_parent.get(pid, []),
                    }
                )

            return results

    except Exception as e:
        logger.error(f"Failed to fetch media from SQLite: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database access failed.")


@app.post("/api/export")
def export_media(payload: ExportRequest) -> dict[str, Any]:
    op_id = uuid.uuid4().hex[:8]
    export_dir = EXPORTS_DIR / payload.album_name
    export_dir.mkdir(parents=True, exist_ok=True)

    symlinks_created = 0
    with SilaSQLiteClient() as db:
        cursor = db.conn.cursor()

        # Ensure export_ledger exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS export_ledger (
                operation_id TEXT NOT NULL,
                symlink_path TEXT NOT NULL,
                created_at REAL NOT NULL
            )
        """)

        for pid in payload.parent_ids:
            cursor.execute(
                "SELECT filepath, filename FROM media WHERE sila_id = ?", (pid,)
            )
            row = cursor.fetchone()
            if not row:
                continue

            src_path = Path(row["filepath"]).resolve()
            dest_path = export_dir / row["filename"]

            # Handle filename collisions & existing symlinks
            counter = 1
            while os.path.lexists(dest_path):
                dest_path = export_dir / f"{src_path.stem}_{counter}{src_path.suffix}"
                counter += 1

            try:
                os.symlink(src_path, dest_path)
                cursor.execute(
                    "INSERT INTO export_ledger (operation_id, symlink_path, created_at) VALUES (?, ?, ?)",
                    (op_id, str(dest_path), time.time()),
                )
                symlinks_created += 1
            except Exception as e:
                logger.error(f"Failed to symlink {src_path} to {dest_path}: {e}")

        db.conn.commit()

    return {
        "status": "success",
        "operation_id": op_id,
        "album": payload.album_name,
        "files_exported": symlinks_created,
    }


@app.post("/api/undo")
def undo_operation(payload: UndoRequest = None) -> dict[str, Any]:
    """
    Rolls back a symlink export via the SQLite operations ledger.
    Physically unlinks the files and removes the DB records.
    Reverts the most recent operation if no specific operation_id is provided.
    """
    target_op = payload.operation_id if payload and payload.operation_id else "latest"
    logger.info(f"API Routing Undo Request for operation: {target_op}")

    try:
        with SilaSQLiteClient() as db:
            cursor = db.conn.cursor()

            # 1. Resolve "latest" to an actual operation ID
            if target_op == "latest":
                # Assumes your ledger table is named `export_ledger` (adjust if named differently)
                cursor.execute(
                    "SELECT operation_id FROM export_ledger ORDER BY created_at DESC LIMIT 1"
                )
                row = cursor.fetchone()
                if not row:
                    return {
                        "status": "error",
                        "message": "No export operations found to undo.",
                    }
                target_op = row[0]

            # 2. Fetch all symlink paths associated with this operation
            cursor.execute(
                "SELECT symlink_path FROM export_ledger WHERE operation_id = ?",
                (target_op,),
            )
            symlinks = [row[0] for row in cursor.fetchall()]

            if not symlinks:
                return {
                    "status": "error",
                    "message": f"Operation {target_op} not found or has no symlinks.",
                }

            # 3. Physically remove the symlinks from the macOS filesystem
            removed_count = 0
            for path_str in symlinks:
                p = Path(path_str)
                # missing_ok=True equivalent for pre-3.8 safety check
                if p.is_symlink() or p.exists():
                    p.unlink()
                    removed_count += 1

            # 4. Scrub the records from the operations ledger
            cursor.execute(
                "DELETE FROM export_ledger WHERE operation_id = ?", (target_op,)
            )
            db.conn.commit()

        logger.info(
            f"Successfully removed {removed_count} symlinks for operation {target_op}"
        )
        return {
            "status": "success",
            "operation_id": target_op,
            "removed_files": removed_count,
            "message": f"Successfully rolled back {removed_count} files for operation: {target_op}",
        }

    except Exception as e:
        logger.error(
            f"Failed to execute rollback for operation {target_op}: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail="Undo operation failed.")
