import pytest
from unittest.mock import patch, MagicMock
from src.sila.search.engine import SilaHybridSearchEngine
from src.sila.core.constants import VECTOR_DIM_TEXT, VECTOR_DIM_IMAGE, IMAGE_VECTOR_COL, TEXT_VECTOR_COL


@patch("src.sila.search.engine.SilaEmbeddingEngine")
@patch("src.sila.search.engine.SilaLanceDBClient")
@patch("src.sila.search.engine.SilaSQLiteClient")
def test_hybrid_search_engine(mock_sqlite_class, mock_lancedb_class, mock_embedding_class, sqlite_client, lancedb_client):
    # Setup mocks to return our real fixtures
    mock_sqlite_class.return_value = sqlite_client
    mock_lancedb_class.return_value = lancedb_client
    
    # Mock embedding engine to return dummy vectors
    mock_text_embedder = MagicMock()
    mock_text_embedder.generate_embedding.return_value = [0.1] * VECTOR_DIM_TEXT
    
    mock_vision_embedder = MagicMock()
    mock_vision_embedder.generate_embedding.return_value = [0.2] * VECTOR_DIM_IMAGE
    
    # The engine creates two embedders, let's just make both return their respective dummy vectors
    # We can use side_effect on the class to return the text one first, then vision one
    mock_embedding_class.side_effect = [mock_text_embedder, mock_vision_embedder]
    
    # Populate the databases with test data
    sqlite_client.upsert_media({
        "sila_id": "parent_1", "filepath": "test1.mp4", "filename": "test1.mp4", "file_size": 1, "created_at": 1.0
    })
    sqlite_client.upsert_capsule_base({
        "capsule_id": "cap_1", "parent_id": "parent_1", "timestamp": 0.0, "blur_score": 0.0, "is_junk": 0
    })
    sqlite_client.update_cognitive_tags("cap_1", "test query string")
    
    lancedb_client.upsert_vectors(
        capsule_id="cap_1",
        image_vector=[0.2] * VECTOR_DIM_IMAGE,
        text_vector=[0.1] * VECTOR_DIM_TEXT,
        parent_id="parent_1",
        timestamp=0.0
    )
    
    # Initialize Engine
    engine = SilaHybridSearchEngine()
    
    # We will test search using a threshold of 2.0 to ensure the mock vectors don't get filtered out
    # Actually, we can just execute_query. Wait, execute_query uses DistanceThreshold constants.
    # We should patch the DistanceThreshold to 2.0 to avoid filtering.
    with patch("src.sila.search.engine.DistanceThreshold") as mock_thresholds:
        mock_thresholds.SEMANTIC_IMAGE_SEARCH = 2.0
        mock_thresholds.SEMANTIC_TEXT_SEARCH = 2.0
        
        results = engine.execute_query("test query string", limit=5)
        
    assert len(results) == 1
    assert results[0]["parent_id"] == "parent_1"
    assert len(results[0]["capsules"]) == 1
    assert results[0]["capsules"][0]["capsule_id"] == "cap_1"
