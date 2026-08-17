from pathlib import Path
from unittest.mock import MagicMock, patch
import numpy as np
import pytest

from src.sila.core.audio import SilaAudioEngine


@patch("src.sila.core.audio.AutoProcessor.from_pretrained")
@patch("src.sila.core.audio.AutoModelForSpeechSeq2Seq.from_pretrained")
@patch("src.sila.core.audio.pipeline")
def test_audio_engine_empty_input(mock_pipeline, mock_model, mock_processor):
    engine = SilaAudioEngine(cache_dir=Path("/tmp/sila_test_models"))
    result = engine.transcribe(b"")
    assert result == ""


@patch("src.sila.core.audio.AutoProcessor.from_pretrained")
@patch("src.sila.core.audio.AutoModelForSpeechSeq2Seq.from_pretrained")
@patch("src.sila.core.audio.pipeline")
@patch("src.sila.core.audio.subprocess.Popen")
def test_audio_engine_successful_transcription(
    mock_popen, mock_pipeline, mock_model, mock_processor
):
    mock_pipe_instance = MagicMock()
    mock_pipe_instance.return_value = {"text": " cinematic beach drone shot "}
    mock_pipeline.return_value = mock_pipe_instance

    # Create dummy float32 audio bytes as ffmpeg output
    dummy_audio = np.ones(16000, dtype=np.float32).tobytes()
    mock_process = MagicMock()
    mock_process.communicate.return_value = (dummy_audio, b"")
    mock_process.returncode = 0
    mock_popen.return_value = mock_process

    engine = SilaAudioEngine(cache_dir=Path("/tmp/sila_test_models"))
    result = engine.transcribe(b"fake_webm_audio_bytes")

    assert result == "cinematic beach drone shot"
    mock_pipe_instance.assert_called_once()


@patch("src.sila.core.audio.AutoProcessor.from_pretrained")
@patch("src.sila.core.audio.AutoModelForSpeechSeq2Seq.from_pretrained")
@patch("src.sila.core.audio.pipeline")
@patch("src.sila.core.audio.subprocess.Popen")
def test_audio_engine_ffmpeg_failure(
    mock_popen, mock_pipeline, mock_model, mock_processor
):
    mock_process = MagicMock()
    mock_process.communicate.return_value = (b"", b"Invalid data found when processing input")
    mock_process.returncode = 1
    mock_popen.return_value = mock_process

    engine = SilaAudioEngine(cache_dir=Path("/tmp/sila_test_models"))

    with pytest.raises(RuntimeError) as exc_info:
        engine.transcribe(b"corrupted_audio_data")

    assert "FFmpeg failed to decode audio" in str(exc_info.value)
