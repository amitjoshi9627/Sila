import json
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
import tempfile
import shutil

from src.sila.pipeline.organizer import SilaSymlinkOrganizer

@pytest.fixture
def temp_workspace():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@patch("src.sila.pipeline.organizer.SilaSQLiteClient")
def test_organizer_create_and_revert(mock_sqlite_class, temp_workspace):
    mock_db = MagicMock()
    mock_sqlite_class.return_value = mock_db
    
    organizer = SilaSymlinkOrganizer(workspace_name=temp_workspace)
    
    # Create a dummy source file
    source_dir = Path(temp_workspace) / "source"
    source_dir.mkdir()
    source_file = source_dir / "test_video.mp4"
    source_file.touch()
    
    # Mock data as returned by engine._hydrate_and_group
    grouped_results = [
        {
            "parent_id": "parent123456",
            "filepath": str(source_file),
            "filename": "test_video.mp4",
        }
    ]
    
    mock_db.record_transaction.return_value = 1
    
    # 1. Create Virtual Album
    organizer.create_virtual_album("Test_Album", grouped_results)
    
    target_dir = Path(temp_workspace) / "Test_Album"
    assert target_dir.exists()
    
    # Check symlink exists
    symlink_path = target_dir / "test_video_parent.mp4"
    assert symlink_path.is_symlink()
    assert symlink_path.exists()
    
    mock_db.record_transaction.assert_called_once()
    
    # 2. Revert Transaction
    mock_db.get_last_transaction.return_value = {
        "op_id": 1,
        "target_folder": str(target_dir),
        "payload": json.dumps([{"link": str(symlink_path), "source": str(source_file)}])
    }
    
    organizer.revert_last_transaction()
    
    # Ensure symlink is gone
    assert not symlink_path.exists()
    
    # Ensure empty directory was cleaned up
    assert not target_dir.exists()
    
    mock_db.delete_transaction.assert_called_with(1)
