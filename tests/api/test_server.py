from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
import pytest

from src.sila.api.server import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "version" in data


@patch("src.sila.api.server._AUDIO_ENGINE")
def test_transcribe_audio_endpoint(mock_audio_engine):
    mock_audio_engine.transcribe.return_value = "drone sunset shot"

    response = client.post(
        "/api/transcribe",
        files={"file": ("test.webm", b"dummy_audio_bytes", "audio/webm")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "drone sunset shot"
    assert "latency_ms" in data


@patch("src.sila.api.server._SEARCH_ENGINE")
def test_search_media_endpoint(mock_search_engine):
    mock_search_engine.execute_query.return_value = [
        {"sila_id": "test_1", "capsule_id": "cap_1", "score": 0.95}
    ]

    response = client.get("/api/search?query=cinematic")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "cinematic"
    assert data["count"] == 1
    assert len(data["results"]) == 1


def test_search_media_empty_query():
    response = client.get("/api/search?query=")
    # FastAPI Query(..., min_length=1) will return 422 Unprocessable Entity
    assert response.status_code == 422
