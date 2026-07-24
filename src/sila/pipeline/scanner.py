import hashlib
import time
import logging
import subprocess
from pathlib import Path
from typing import Tuple
import cv2
import numpy as np
import uuid

from src.sila.db.sqlite_client import SilaSQLiteClient
from src.sila.pipeline.dispatcher import SilaDAGDispatcher
from config import (
    FRAMES_DIR,
    VALID_MEDIA_EXTENSIONS,
    VALID_VIDEO_EXTENSIONS,
    VALID_PHOTO_EXTENSIONS,
)
from src.sila.core.constants import (
    MIN_VARIANCE_THRESHOLD,
    MAX_VARIANCE_THRESHOLD,
    SCENE_SIMILARITY_THRESHOLD,
)

logger = logging.getLogger("sila.pipeline.scanner")


class SilaMediaScanner:
    def __init__(self, target_directory: str):
        self.target_dir = Path(target_directory)
        self.frame_cache = FRAMES_DIR
        self.db = SilaSQLiteClient()

    def scan_and_slice(self):
        """Finds media, extracts representational frames using ML algorithms, and dispatches them."""
        for file_path in self.target_dir.rglob("*"):
            if file_path.suffix.lower() in VALID_MEDIA_EXTENSIONS:
                self._process_media_file(file_path)

    @staticmethod
    def _calculate_blur_score(image_path: Path) -> float:
        """Computes spatial sharpness using Laplacian variance and normalizes to a 0.0 - 1.0 scale."""
        image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
        if image is None:
            return 0.0

        raw_variance = float(cv2.Laplacian(image, cv2.CV_64F).var())

        if raw_variance <= MIN_VARIANCE_THRESHOLD:
            return 0.0
        elif raw_variance >= MAX_VARIANCE_THRESHOLD:
            return 1.0

        normalized_score = (raw_variance - MIN_VARIANCE_THRESHOLD) / (
            MAX_VARIANCE_THRESHOLD - MIN_VARIANCE_THRESHOLD
        )
        return round(normalized_score, 3)

    @staticmethod
    def _get_video_duration(video_path: Path) -> float:
        """Extracts the exact media duration in seconds using ffprobe."""
        cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path.resolve()),
        ]
        try:
            return float(subprocess.check_output(cmd).decode().strip())
        except Exception as e:
            logger.error(f"Failed to read duration for {video_path.name}: {e}")
            return 0.0

    def _slice_video_into_capsules(
        self, video_path: Path, parent_id: str
    ) -> list[Tuple[str, float]]:
        """Intelligently slices video using duration mapping, hard cuts, and OpenCV visual deduplication."""
        duration = self._get_video_duration(video_path)

        # 1. Video Length to Shot Count Mapping
        if duration <= 5.0:
            target_frames = 2
        elif duration <= 15.0:
            target_frames = 4
        elif duration <= 30.0:
            target_frames = 6
        elif duration <= 60.0:
            target_frames = 8
        else:
            target_frames = 10

        # 2. Hard Cut Detection (0.4 threshold)
        hard_cuts = []
        cmd = [
            "ffmpeg",
            "-i",
            str(video_path.resolve()),
            "-vf",
            "select='gt(scene,0.4)',showinfo",
            "-f",
            "null",
            "-",
        ]
        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
            )
            for line in result.stderr.splitlines():
                if "showinfo" in line and "pts_time:" in line:
                    try:
                        ts = float(line.split("pts_time:")[1].split()[0])
                        if not hard_cuts or all(
                            abs(ts - existing) > 1.0 for existing in hard_cuts
                        ):
                            hard_cuts.append(ts)
                    except IndexError:
                        continue
        except subprocess.CalledProcessError as err:
            logger.error(f"Scene detection failed for {video_path.name}: {err.stderr}")

        # 3. Interval Fill & Collision Detection
        candidate_timestamps = list(hard_cuts)
        if duration > 0 and target_frames > 0:
            interval = duration / target_frames
            for i in range(target_frames):
                ideal_ts = i * interval
                collision = any(
                    abs(ideal_ts - hc) < (interval * 0.6) for hc in hard_cuts
                )
                if not collision:
                    candidate_timestamps.append(ideal_ts)

        candidate_timestamps.sort()

        # 4. Extraction & Visual Auditing
        capsules_found = []
        last_accepted_img = None

        for ts in candidate_timestamps:
            hasher = hashlib.blake2b(digest_size=16)
            hasher.update(f"{parent_id}_{ts}".encode("utf-8"))
            capsule_id = f"caps_{hasher.hexdigest()}"

            final_path = self.frame_cache / f"{capsule_id}.jpg"
            temp_path = self.frame_cache / f"temp_{capsule_id}.jpg"

            extract_cmd = [
                "ffmpeg",
                "-ss",
                str(ts),
                "-i",
                str(video_path.resolve()),
                "-vframes",
                "1",
                "-q:v",
                "4",
                "-vf",
                "scale=640:-1",
                "-y",
                str(temp_path.resolve()),
            ]

            try:
                subprocess.run(
                    extract_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                )

                img = cv2.imread(str(temp_path.resolve()))
                if img is None:
                    if temp_path.exists():
                        temp_path.unlink()
                    continue

                # Audit A: Black/dark frame check
                if np.mean(img) < 15.0:
                    logger.debug(f"Skipping {ts}s: Black frame detected.")
                    temp_path.unlink()
                    continue

                # Audit B: OpenCV Histogram Duplicate Check
                if last_accepted_img is not None:
                    hist1 = cv2.calcHist(
                        [last_accepted_img],
                        [0, 1, 2],
                        None,
                        [8, 8, 8],
                        [0, 256, 0, 256, 0, 256],
                    )
                    hist2 = cv2.calcHist(
                        [img], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256]
                    )
                    cv2.normalize(hist1, hist1)
                    cv2.normalize(hist2, hist2)

                    similarity = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)

                    if similarity > SCENE_SIMILARITY_THRESHOLD:
                        logger.debug(
                            f"Skipping {ts}s: Duplicate scene detected (Score: {similarity:.2f})."
                        )
                        temp_path.unlink()
                        continue

                # Passed all audits
                temp_path.rename(final_path)
                last_accepted_img = img
                capsules_found.append((capsule_id, ts))

            except subprocess.CalledProcessError:
                if temp_path.exists():
                    temp_path.unlink()
                continue

        return capsules_found

    def _process_media_file(self, source_path: Path):
        """Determines media type, generates capsules, updates DB, and fires the DAG."""
        parent_sila_id = f"vid_{uuid.uuid4().hex[:8]}"

        # 1. Register parent media in SQLite
        self.db.upsert_media(
            {
                "sila_id": parent_sila_id,
                "filepath": str(source_path),
                "filename": source_path.name,
                "file_size": source_path.stat().st_size,
                "created_at": time.time(),
            }
        )
        logger.info(f"Registered Media: {source_path.name}")

        suffix = source_path.suffix.lower()
        capsules_to_process = []

        # 2. Extract valid frames based on media type
        if suffix in VALID_VIDEO_EXTENSIONS:
            capsules_to_process = self._slice_video_into_capsules(
                source_path, parent_sila_id
            )
        elif suffix in VALID_PHOTO_EXTENSIONS:
            hasher = hashlib.blake2b(digest_size=16)
            hasher.update(f"{parent_sila_id}_0.0".encode("utf-8"))
            capsule_id = f"caps_{hasher.hexdigest()}"
            thumb_path = self.frame_cache / f"{capsule_id}.jpg"

            if not thumb_path.exists():
                image = cv2.imread(str(source_path.resolve()))
                if image is not None:
                    h, w = image.shape[:2]
                    cv2.imwrite(
                        str(thumb_path.resolve()),
                        cv2.resize(
                            image,
                            (640, int(h * (640 / w))),
                            interpolation=cv2.INTER_AREA,
                        ),
                    )
            capsules_to_process.append((capsule_id, 0.0))

        # 3. Save to DB and Dispatch to the Celery DAG
        for capsule_id, ts in capsules_to_process:
            thumb_path = self.frame_cache / f"{capsule_id}.jpg"

            if thumb_path.exists():
                # Calculate Laplacian variance
                blur = self._calculate_blur_score(thumb_path)

                # Create the base row in SQLite using our OOP method
                self.db.upsert_capsule_base(
                    {
                        "capsule_id": capsule_id,
                        "parent_id": parent_sila_id,
                        "timestamp": ts,
                        "blur_score": blur,
                        "is_junk": 1 if blur == 0.0 else 0,
                    }
                )

                logger.info(f"Dispatching DAG for capsule: {capsule_id}")

                # Pass into the new chained DAG dispatcher instead of the old raw task
                SilaDAGDispatcher.dispatch_capsule(
                    capsule_id=capsule_id,
                    image_path=str(thumb_path.resolve()),
                    parent_id=parent_sila_id,
                    timestamp=ts,
                )
