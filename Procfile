redis: sh -c "docker rm -f sila-redis 2>/dev/null || true; exec docker run --rm --name sila-redis -p ${REDIS_PORT:-6379}:6379 redis:alpine"
api: uv run uvicorn src.sila.api.server:app --host 0.0.0.0 --port ${SILA_PORT:-8000}
worker: uv run celery -A src.sila.workers.tasks worker --pool=solo --loglevel=info