import logging
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

# Ensure root directory is on the path BEFORE importing config
sys.path.append(str(Path(__file__).resolve().parent.parent))

from sentence_transformers import SentenceTransformer
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq

from config import (
    MODEL_DIR,
    LLAVA_REPO_ID,
    LLM_FILE,
    VISION_FILE,
    CLIP_MODEL_NAME,
    TEXT_EMBEDDING_MODEL_NAME, STT_MODEL_NAME,
)

logger = logging.getLogger("sila.scripts.download_models")


def stream_download(url: str, dest_path: Path) -> None:
    """Streams a file directly to dest_path with immediate file creation and live progress."""
    if dest_path.exists():
        print(f"✅ {dest_path.name} found in cache. Skipping download.")
        return

    tmp_path = dest_path.with_suffix(".tmp")
    print(f"\n📦 Streaming {dest_path.name} directly to {dest_path.parent}...")
    sys.stdout.flush()

    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (Sila-Engine)"})

    try:
        with urlopen(req) as response:
            total_size = int(response.headers.get("content-length", 0))
            block_size = 1024 * 1024  # 1 MB chunks
            downloaded = 0
            start_time = time.time()

            with open(tmp_path, "wb") as f:
                while True:
                    chunk = response.read(block_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)

                    elapsed = time.time() - start_time
                    speed_mb = (downloaded / (1024 * 1024)) / (elapsed if elapsed > 0 else 1)
                    percent = (downloaded / total_size) * 100 if total_size > 0 else 0

                    mb_downloaded = downloaded / (1024 * 1024)
                    mb_total = total_size / (1024 * 1024)

                    sys.stdout.write(
                        f"\r⏬  {mb_downloaded:.1f} MB / {mb_total:.1f} MB "
                        f"[{percent:.1f}%] @ {speed_mb:.2f} MB/s"
                    )
                    sys.stdout.flush()

        print("\n✅ Download complete!")
        tmp_path.rename(dest_path)

    except Exception as e:
        if tmp_path.exists():
            tmp_path.unlink()
        print(f"\n❌ Failed to download {dest_path.name}: {e}")
        raise e


def pre_fetch_models() -> None:
    print("🟢 Initializing Sila Model Pre-fetcher...")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Text Embedding Model (MiniLM)
    print(f"\n📦 Checking Text Embeddings: {TEXT_EMBEDDING_MODEL_NAME}...")
    SentenceTransformer(
        TEXT_EMBEDDING_MODEL_NAME,
        cache_folder=str(MODEL_DIR),
        local_files_only=False,
    )

    # 2. Image Embedding Model (CLIP)
    print(f"\n📦 Checking Vision Embeddings: {CLIP_MODEL_NAME}...")
    SentenceTransformer(
        CLIP_MODEL_NAME,
        cache_folder=str(MODEL_DIR),
        local_files_only=False,
    )

    # 3. Direct Streaming for Vision-Language Models (GGUF)
    llm_url = f"https://huggingface.co/{LLAVA_REPO_ID}/resolve/main/{LLM_FILE}"
    vision_url = f"https://huggingface.co/{LLAVA_REPO_ID}/resolve/main/{VISION_FILE}"

    stream_download(llm_url, MODEL_DIR / LLM_FILE)
    stream_download(vision_url, MODEL_DIR / VISION_FILE)

    # 3. Audio Transcription Model (Whisper)
    print(f"\n📦 Checking Audio Recognition Model: {STT_MODEL_NAME}...")
    sys.stdout.flush()
    AutoProcessor.from_pretrained(STT_MODEL_NAME, cache_dir=str(MODEL_DIR))
    AutoModelForSpeechSeq2Seq.from_pretrained(STT_MODEL_NAME, cache_dir=str(MODEL_DIR))

    print("\n✅ All models verified and cached in .sila_cache! Zero-latency start ready.")


if __name__ == "__main__":
    pre_fetch_models()