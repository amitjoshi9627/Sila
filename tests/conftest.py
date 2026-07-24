import pytest
import tempfile
import shutil
from pathlib import Path

from src.sila.db.sqlite_client import SilaSQLiteClient
from src.sila.db.lancedb_client import SilaLanceDBClient

@pytest.fixture
def temp_db_dir():
    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    # Cleanup after test
    shutil.rmtree(temp_dir)

@pytest.fixture
def sqlite_client(temp_db_dir):
    db_path = temp_db_dir / "test_sila.db"
    client = SilaSQLiteClient(db_path=str(db_path))
    client.initialize_schema()
    return client

@pytest.fixture
def lancedb_client(temp_db_dir):
    lance_path = temp_db_dir / "test_lancedb"
    client = SilaLanceDBClient(uri=str(lance_path))
    client.initialize_schema()
    return client
