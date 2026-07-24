import pytest
from unittest.mock import patch, MagicMock
from src.sila.pipeline.dispatcher import SilaDAGDispatcher

@patch("src.sila.pipeline.dispatcher.chain")
def test_dispatch_capsule(mock_chain):
    mock_workflow = MagicMock()
    mock_chain.return_value = mock_workflow
    
    SilaDAGDispatcher.dispatch_capsule("c1", "/path/to/img.jpg", "p1", 10.0)
    
    mock_chain.assert_called_once()
    mock_workflow.apply_async.assert_called_once()
