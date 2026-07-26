"""Local Speech-to-Text Engine using Apple Metal / CUDA Acceleration."""

import logging
import os
from pathlib import Path
import subprocess
import tempfile
import numpy as np

import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

from config import MODEL_DIR, STT_MODEL_NAME

logger = logging.getLogger("sila.core.audio")


class SilaAudioEngine:
    def __init__(
        self, model_id: str = STT_MODEL_NAME, cache_dir: str | Path = MODEL_DIR
    ) -> None:
        self.model_id = model_id
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Hardware acceleration routing (Metal -> CUDA -> CPU)
        self.device = "cpu"
        if torch.backends.mps.is_available():
            self.device = "mps"
        elif torch.cuda.is_available():
            self.device = "cuda"

        # Use float16 for massive speedup on GPUs, fallback to float32 on CPU
        self.torch_dtype = torch.float16 if self.device != "cpu" else torch.float32

        logger.info(f"Loading Audio Engine ({model_id}) on {self.device}...")

        # Load Processor and Model from our isolated cache.
        # Use local_files_only=True first to prevent unnecessary HF Hub HTTP HEAD requests.
        try:
            self.processor = AutoProcessor.from_pretrained(
                self.model_id, cache_dir=str(self.cache_dir), local_files_only=True
            )
            self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
                self.model_id,
                torch_dtype=self.torch_dtype,
                cache_dir=str(self.cache_dir),
                low_cpu_mem_usage=True,
                local_files_only=True,
            ).to(self.device)
        except Exception:
            logger.info(f"Model not cached locally. Downloading {self.model_id} from Hugging Face...")
            self.processor = AutoProcessor.from_pretrained(
                self.model_id, cache_dir=str(self.cache_dir), local_files_only=False
            )
            self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
                self.model_id,
                torch_dtype=self.torch_dtype,
                cache_dir=str(self.cache_dir),
                low_cpu_mem_usage=True,
                local_files_only=False,
            ).to(self.device)

        # Initialize the high-speed pipeline
        self.pipe = pipeline(
            "automatic-speech-recognition",
            model=self.model,
            tokenizer=self.processor.tokenizer,
            feature_extractor=self.processor.feature_extractor,
            torch_dtype=self.torch_dtype,
            device=self.device,
        )

    def transcribe(self, audio_bytes: bytes) -> str:
        """
        Takes raw audio bytes (like a .webm or .mp4 upload from the browser),
        resamples them to 16kHz (Whisper's requirement), and transcribes.
        """
        if not audio_bytes:
            return ""

        temp_in_path = None
        try:
            # Write bytes to disk temp file so FFmpeg can seek container headers (crucial for WebM/MP4)
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_in:
                temp_in.write(audio_bytes)
                temp_in_path = temp_in.name

            # Decode the audio file directly to 16kHz float32 using ffmpeg
            cmd = [
                "ffmpeg",
                "-y",
                "-i", temp_in_path,
                "-f", "f32le",
                "-acodec", "pcm_f32le",
                "-ar", "16000",
                "-ac", "1",
                "-"
            ]
            p = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            out, err = p.communicate()

            if p.returncode != 0:
                raise RuntimeError(
                    f"FFmpeg failed to decode audio (exit code {p.returncode}): {err.decode('utf-8', errors='replace')}"
                )

            audio_array = np.frombuffer(out, dtype=np.float32)
            if audio_array.size == 0:
                return ""

            # Run inference
            result = self.pipe(audio_array)

            # Clean up the output string
            transcription = result.get("text", "").strip()
            return transcription

        except Exception as e:
            logger.error(f"Failed to transcribe audio: {e}")
            raise e
        finally:
            if temp_in_path and os.path.exists(temp_in_path):
                try:
                    os.remove(temp_in_path)
                except Exception:
                    pass
