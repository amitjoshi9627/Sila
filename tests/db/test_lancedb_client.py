import pytest
from src.sila.core.constants import IMAGE_VECTOR_COL, TEXT_VECTOR_COL, VECTOR_DIM_IMAGE, VECTOR_DIM_TEXT

def test_lancedb_schema_initialization(lancedb_client):
    # Verify table exists
    assert lancedb_client.table_name in lancedb_client.db.table_names()
    
    table = lancedb_client.db.open_table(lancedb_client.table_name)
    schema = table.schema
    names = schema.names
    
    assert IMAGE_VECTOR_COL in names
    assert TEXT_VECTOR_COL in names
    assert "capsule_id" in names

def test_lancedb_upsert_and_search(lancedb_client):
    # Upsert a vector
    image_vec = [0.1] * VECTOR_DIM_IMAGE
    text_vec = [0.2] * VECTOR_DIM_TEXT
    
    lancedb_client.upsert_vectors(
        capsule_id="c1",
        image_vector=image_vec,
        text_vector=text_vec,
        parent_id="p1",
        timestamp=0.0
    )
    
    # Check length
    table = lancedb_client.db.open_table(lancedb_client.table_name)
    assert len(table) == 1
    
    # Vector Search Image
    results = lancedb_client.vector_search(
        query_vector=image_vec,
        column_name=IMAGE_VECTOR_COL,
        limit=5,
        threshold=1.0
    )
    
    assert len(results) == 1
    assert results[0]["capsule_id"] == "c1"
    assert results[0]["parent_sila_id"] == "p1"
    assert "_distance" in results[0]

    # Test Upsert replacement behavior
    lancedb_client.upsert_vectors(
        capsule_id="c1",
        image_vector=[0.5] * VECTOR_DIM_IMAGE,
        text_vector=text_vec,
        parent_id="p1",
        timestamp=0.0
    )
    
    assert len(table) == 1  # Should still be 1 after upsert
