"""Sila Gateway API Web Server - The HTTP wrapper for the Tri-Modal Engine & STT."""

import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import API_TITLE, API_VERSION, EXPORTS_DIR, FRAMES_DIR
from src.sila.core.audio import SilaAudioEngine
from src.sila.core.constants import (
    TRACKING_FRIENDLY_NAMES,
    TrackingMetricType,
    TrackingMetric,
)
from src.sila.core.telemetry import track_latency
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

# Global engine instances for lazy-loading memory persistence
_SEARCH_ENGINE: SilaHybridSearchEngine | None = None
_AUDIO_ENGINE: SilaAudioEngine | None = None


class UndoRequest(BaseModel):
    operation_id: Optional[str] = None


class ExportRequest(BaseModel):
    album_name: str
    parent_ids: list[str]


@app.get("/health")
def health_check() -> dict[str, str]:
    """Basic ping to verify the API gateway is alive."""
    return {"status": "online", "version": "0.6.0"}


@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Accepts an audio blob (.webm, .wav, .mp3) from the browser,
    runs local Whisper transcription, and returns the recognized text.
    """
    global _AUDIO_ENGINE

    try:
        # Cold Start: Load Whisper weights onto GPU/MPS on first voice search
        if _AUDIO_ENGINE is None:
            logger.info("Cold Start: Mounting SilaAudioEngine to Apple Metal / CUDA...")
            _AUDIO_ENGINE = SilaAudioEngine()

        logger.info(
            f"API Routing Audio Transcription: '{file.filename}' ({file.content_type})"
        )

        # Read raw audio bytes asynchronously
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

        # Transcribe via local Whisper engine
        start_time = time.perf_counter()
        transcript = _AUDIO_ENGINE.transcribe(audio_bytes)
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(f"Transcription complete: '{transcript}' in {latency_ms} ms")

        return {"text": transcript, "latency_ms": latency_ms}

    except Exception as e:
        logger.error(f"Audio transcription endpoint failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Voice transcription failed.")


@app.get("/api/search")
def search_media(
    query: str = Query(..., min_length=1), limit: int = 15
) -> dict[str, Any]:
    """
    Executes a Tri-Modal search and returns the results alongside the exact execution latency.
    """
    global _SEARCH_ENGINE

    try:
        if _SEARCH_ENGINE is None:
            logger.info("Cold Start: Mounting SilaHybridSearchEngine to Apple Metal...")
            _SEARCH_ENGINE = SilaHybridSearchEngine()

        logger.info(f"API Routing Search Query: '{query}'")

        # Start the inline timer
        start_time = time.perf_counter()

        # Execute the search
        results = _SEARCH_ENGINE.execute_query(text_query=query, limit=limit)

        # Stop the timer
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Return a wrapped payload so the frontend gets both data and telemetry
        return {
            "query": query,
            "latency_ms": latency_ms,
            "count": len(results),
            "results": results,
        }

    except Exception as e:
        logger.error(f"Search endpoint failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Search engine execution failed.")


@app.get("/api/telemetry")
def get_telemetry_metrics(limit: int = 40) -> dict[str, Any]:
    """
    Fetches historical telemetry performance records from SQLite system_telemetry table.
    Includes recent operation latencies, pipeline breakdown, and aggregated metrics.
    """
    try:
        with SilaSQLiteClient() as db:
            assert db.conn is not None
            cursor = db.conn.cursor()

            # Fetch recent records
            hybrid_op_name = (
                f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.HYBRID_SEARCH}"
            )
            cursor.execute(
                "SELECT id, operation_name, duration_ms, "
                "timestamp FROM system_telemetry WHERE operation_name IN "
                "(?, 'Hybrid Search (Total)', 'track_hybrid_search') ORDER BY id DESC LIMIT ?",
                (
                    hybrid_op_name,
                    limit,
                ),
            )
            rows = cursor.fetchall()
            recent = [
                {
                    "id": r["id"],
                    "operation_name": r["operation_name"],
                    "duration_ms": round(float(r["duration_ms"]), 2),
                    "timestamp": float(r["timestamp"]),
                }
                for r in rows
            ]

            # Compute aggregate stats
            cursor.execute("SELECT duration_ms FROM system_telemetry")
            all_durations = [float(r[0]) for r in cursor.fetchall()]

            if all_durations:
                all_durations_sorted = sorted(all_durations)
                avg_ms = round(sum(all_durations) / len(all_durations), 2)
                p95_idx = int(len(all_durations_sorted) * 0.95)
                p95_ms = round(
                    all_durations_sorted[min(p95_idx, len(all_durations_sorted) - 1)], 2
                )
                min_ms = round(all_durations_sorted[0], 2)
                max_ms = round(all_durations_sorted[-1], 2)
            else:
                avg_ms = 0.0
                p95_ms = 0.0
                min_ms = 0.0
                max_ms = 0.0

            # Group by operation name
            cursor.execute("""
                SELECT operation_name, AVG(duration_ms) as avg_ms, COUNT(*) as count, MIN(duration_ms) as min_ms, MAX(duration_ms) as max_ms
                FROM system_telemetry
                GROUP BY operation_name
            """)
            op_rows = cursor.fetchall()
            by_operation = {
                r["operation_name"]: {
                    "avg_ms": round(float(r["avg_ms"]), 2),
                    "count": int(r["count"]),
                    "min_ms": round(float(r["min_ms"]), 2),
                    "max_ms": round(float(r["max_ms"]), 2),
                }
                for r in op_rows
            }

            return {
                "recent": recent,
                "stats": {
                    "average_ms": avg_ms,
                    "p95_ms": p95_ms,
                    "min_ms": min_ms,
                    "max_ms": max_ms,
                    "total_queries": len(all_durations),
                    "by_operation": by_operation,
                },
                "friendly_names": TRACKING_FRIENDLY_NAMES,
            }
    except Exception as e:
        logger.error(f"Failed to fetch telemetry from SQLite: {e}", exc_info=True)
        return {
            "recent": [],
            "stats": {
                "average_ms": 0.0,
                "p95_ms": 0.0,
                "min_ms": 0.0,
                "max_ms": 0.0,
                "total_queries": 0,
                "by_operation": {},
            },
            "friendly_names": TRACKING_FRIENDLY_NAMES,
        }


@app.get("/api/proxy/{capsule_id}")
def proxy_image(capsule_id: str) -> FileResponse:
    """Serves the thumbnail image for a specific capsule."""
    image_path = FRAMES_DIR / f"{capsule_id}.jpg"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found.")
    return FileResponse(image_path)


@app.get("/api/stream/{parent_id}")
def stream_media(parent_id: str) -> FileResponse:
    """Streams the original source media file for deep viewing."""
    try:
        with SilaSQLiteClient() as db:
            assert db.conn is not None
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
            assert db.conn is not None
            cursor = db.conn.cursor()

            # 1. Fetch parents (excluding empty/0-byte files)
            cursor.execute(
                "SELECT * FROM media WHERE file_size > 0 ORDER BY created_at DESC LIMIT ?",
                (limit,),
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

            capsules_by_parent: dict[str, list[dict[str, Any]]] = {}
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
@track_latency(TrackingMetric.EXPORT_ALBUM, metric_type=TrackingMetricType.ONLINE)
def export_media(payload: ExportRequest) -> dict[str, Any]:
    op_id = uuid.uuid4().hex[:8]
    export_dir = EXPORTS_DIR / payload.album_name
    export_dir.mkdir(parents=True, exist_ok=True)

    symlinks_created = 0
    with SilaSQLiteClient() as db:
        assert db.conn is not None
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
def undo_operation(payload: UndoRequest | None = None) -> dict[str, Any]:
    """
    Rolls back a symlink export via the SQLite operations ledger.
    Physically unlinks the files and removes the DB records.
    Reverts the most recent operation if no specific operation_id is provided.
    """
    target_op = payload.operation_id if payload and payload.operation_id else "latest"
    logger.info(f"API Routing Undo Request for operation: {target_op}")

    try:
        with SilaSQLiteClient() as db:
            assert db.conn is not None
            cursor = db.conn.cursor()

            # 1. Resolve "latest" to an actual operation ID
            if target_op == "latest":
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

            # 3. Physically remove the symlinks from the filesystem
            removed_count = 0
            for path_str in symlinks:
                p = Path(path_str)
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
