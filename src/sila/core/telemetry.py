import time
import threading
import logging
from functools import wraps
from typing import Callable, Any

from src.sila.core.constants import TrackingMetricType

logger = logging.getLogger("sila.telemetry")


def _write_metric_async(operation_name: str, duration_ms: float):
    """Writes telemetry to SQLite on a background thread to prevent blocking."""

    def _write():
        try:
            from src.sila.db.sqlite_client import SilaSQLiteClient

            with SilaSQLiteClient() as db:
                cursor = db.conn.cursor()
                cursor.execute(
                    "INSERT INTO system_telemetry (operation_name, duration_ms, timestamp) VALUES (?, ?, ?)",
                    (operation_name, duration_ms, time.time()),
                )
                db.conn.commit()
        except Exception as e:
            logger.error(f"Failed to write telemetry for {operation_name}: {e}")

    threading.Thread(target=_write, daemon=True).start()


def track_latency(name: str, metric_type: str = TrackingMetricType.ONLINE):
    """
    Decorator to measure execution time of a function in milliseconds.
    Prints execution time to terminal logger and asynchronously persists to SQLite.
    """
    formatted_name = f"track_{metric_type}_{name}"

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            start_time = time.perf_counter()

            result = func(*args, **kwargs)

            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Live Terminal Logging
            icon = "📦" if metric_type == TrackingMetricType.OFFLINE else "⚡"

            # Formats human-readable output
            if duration_ms >= 1000:
                time_str = f"{duration_ms:.2f} ms ({duration_ms / 1000:.2f}s)"
            else:
                time_str = f"{duration_ms:.2f} ms"

            logger.info(f"{icon} Telemetry [{formatted_name}] completed in {time_str}")

            # Persist to SQLite
            _write_metric_async(formatted_name, duration_ms)

            return result

        return wrapper

    return decorator
