import time
from unittest.mock import patch
import pytest
from src.sila.core.constants import TrackingMetric, TrackingMetricType
from src.sila.core.telemetry import track_latency


def test_track_latency_decorator():
    with patch("src.sila.core.telemetry._write_metric_async") as mock_write:

        @track_latency(TrackingMetric.HYBRID_SEARCH, metric_type=TrackingMetricType.ONLINE)
        def sample_function(x, y):
            time.sleep(0.01)
            return x + y

        result = sample_function(2, 3)

        assert result == 5
        mock_write.assert_called_once()
        args, _ = mock_write.call_args
        assert args[0] == f"track_{TrackingMetricType.ONLINE}_{TrackingMetric.HYBRID_SEARCH}"
        assert args[1] >= 10.0


def test_track_latency_preserves_exceptions():
    with patch("src.sila.core.telemetry._write_metric_async"):

        @track_latency(TrackingMetric.IMAGE_CAPTIONING, metric_type=TrackingMetricType.OFFLINE)
        def faulty_function():
            raise ValueError("Test error")

        with pytest.raises(ValueError, match="Test error"):
            faulty_function()

