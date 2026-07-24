import os
import shutil
import pytest
from pathlib import Path
from unittest.mock import patch

from config import PROJECT_ROOT
from src.sila.db.sqlite_client import SilaSQLiteClient
from src.sila.db.lancedb_client import SilaLanceDBClient
from src.sila.pipeline.scanner import SilaMediaScanner
from src.sila.search.engine import SilaHybridSearchEngine
from src.sila.workers.tasks import celery_app

# Force Celery to run synchronously in the same process for testing
celery_app.conf.task_always_eager = True
celery_app.conf.task_eager_propagates = True

@pytest.fixture
def integration_env(tmp_path):
    """Sets up a temporary media folder and overrides DB paths."""
    # 1. Setup temporary directories for DBs
    sqlite_db_path = tmp_path / "integration_sila.db"
    lancedb_uri = tmp_path / "integration_lancedb"
    
    # 2. Setup media folder
    media_dir = PROJECT_ROOT / "tests" / "sample_assets"
            
    # Yield the paths for patching
    yield {
        "sqlite_path": str(sqlite_db_path),
        "lancedb_uri": str(lancedb_uri),
        "media_dir": str(media_dir)
    }


def test_end_to_end_pipeline(integration_env):
    """Tests the full ingestion and search pipeline using real ML models on a real dataset."""
    
    # We patch the database path constants so the internal classes use our temp DBs
    with patch("config.SQLITE_DB_PATH", integration_env["sqlite_path"]), \
         patch("config.LANCEDB_URI", integration_env["lancedb_uri"]), \
         patch("src.sila.db.sqlite_client.SQLITE_DB_PATH", integration_env["sqlite_path"]), \
         patch("src.sila.db.lancedb_client.LANCEDB_URI", integration_env["lancedb_uri"]), \
         patch("src.sila.search.engine.SilaSQLiteClient", lambda: SilaSQLiteClient(db_path=integration_env["sqlite_path"])), \
         patch("src.sila.search.engine.SilaLanceDBClient", lambda: SilaLanceDBClient(uri=integration_env["lancedb_uri"])), \
         patch("src.sila.workers.tasks.SilaSQLiteClient", lambda: SilaSQLiteClient(db_path=integration_env["sqlite_path"])), \
         patch("src.sila.workers.tasks.SilaLanceDBClient", lambda: SilaLanceDBClient(uri=integration_env["lancedb_uri"])):
        
        # 1. Init System
        sqlite_client = SilaSQLiteClient(db_path=integration_env["sqlite_path"])
        sqlite_client.initialize_schema()
        
        lancedb_client = SilaLanceDBClient(uri=integration_env["lancedb_uri"])
        lancedb_client.initialize_schema()

        # 2. Run Pipeline (Eager Celery tasks will block and process ML locally)
        scanner = SilaMediaScanner(integration_env["media_dir"])
        scanner.db = sqlite_client  # Ensure scanner uses test db
        scanner.scan_and_slice()
        
        # Verify ingestion
        with sqlite_client as client:
            cursor = client.conn.cursor()
            cursor.execute("SELECT count(*) FROM media")
            media_count = cursor.fetchone()[0]
            assert media_count > 0, "No media was registered"
            
            cursor.execute("SELECT count(*) FROM capsules")
            capsule_count = cursor.fetchone()[0]
            assert capsule_count > 0, "No capsules were created"
            
        table = lancedb_client.db.open_table(lancedb_client.table_name)
        assert len(table) > 0, "No vectors were saved to LanceDB"

        # 3. Test Hybrid Search
        engine = SilaHybridSearchEngine()
        
        # We search for something broad that should match a landscape photo like mountains or skies
        results = engine.execute_query("mountains", limit=5)
        
        assert len(results) > 0, "Search engine returned no results"
        
        first_result = results[0]
        assert "filename" in first_result
        assert "max_score" in first_result
        assert "capsules" in first_result
        assert len(first_result["capsules"]) > 0
