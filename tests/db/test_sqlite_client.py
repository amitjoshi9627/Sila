def test_sqlite_schema_initialization(sqlite_client):
    # Verify that the tables exist
    with sqlite_client as client:
        cursor = client.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = {row["name"] for row in cursor.fetchall()}
        assert "media" in tables
        assert "capsules" in tables
        assert "operations" in tables

def test_upsert_media_and_capsule(sqlite_client):
    media_data = {
        "sila_id": "test_parent_1",
        "filepath": "/path/to/test.mp4",
        "filename": "test.mp4",
        "file_size": 1024,
        "created_at": 1000.0,
    }
    sqlite_client.upsert_media(media_data)

    capsule_data = {
        "capsule_id": "test_capsule_1",
        "parent_id": "test_parent_1",
        "timestamp": 10.0,
        "blur_score": 0.5,
        "is_junk": 0,
    }
    sqlite_client.upsert_capsule_base(capsule_data)

    # Fetch and verify
    with sqlite_client as client:
        cursor = client.conn.cursor()
        cursor.execute("SELECT * FROM media WHERE sila_id = 'test_parent_1'")
        media_row = cursor.fetchone()
        assert dict(media_row)["filename"] == "test.mp4"

        cursor.execute("SELECT * FROM capsules WHERE capsule_id = 'test_capsule_1'")
        capsule_row = cursor.fetchone()
        assert dict(capsule_row)["blur_score"] == 0.5

def test_update_cognitive_tags(sqlite_client):
    # Setup
    sqlite_client.upsert_media({
        "sila_id": "p1", "filepath": "p1.mp4", "filename": "p1.mp4", "file_size": 1, "created_at": 1.0
    })
    sqlite_client.upsert_capsule_base({
        "capsule_id": "c1", "parent_id": "p1", "timestamp": 0.0, "blur_score": 0.0, "is_junk": 0
    })

    # Update tags
    tags_json = '{"tags": ["dog", "cat"]}'
    sqlite_client.update_cognitive_tags("c1", tags_json)

    # Verify
    with sqlite_client as client:
        cursor = client.conn.cursor()
        cursor.execute("SELECT cognitive_tags FROM capsules WHERE capsule_id = 'c1'")
        row = cursor.fetchone()
        assert dict(row)["cognitive_tags"] == tags_json

def test_lexical_search(sqlite_client):
    sqlite_client.upsert_media({
        "sila_id": "p1", "filepath": "dog.mp4", "filename": "dog.mp4", "file_size": 1, "created_at": 1.0
    })
    sqlite_client.upsert_capsule_base({
        "capsule_id": "c1", "parent_id": "p1", "timestamp": 0.0, "blur_score": 0.0, "is_junk": 0
    })
    sqlite_client.update_cognitive_tags("c1", "beautiful golden retriever running")

    results = sqlite_client.lexical_search("golden retriever")
    assert len(results) == 1
    assert results[0]["capsule_id"] == "c1"
    assert results[0]["match_count"] > 0
