# Makefile for Sila Development Automation

.PHONY: install start clean clean-all lint lint-fix test run api ui dev info download-models


# Detect Operating System and Active Dependencies
OS := $(shell uname -s)
# Checks if the Docker daemon is actively responding, not just installed
HAS_DOCKER := $(shell docker info > /dev/null 2>&1 && echo "yes")
HAS_UV := $(shell command -v uv 2> /dev/null)
MEDIA_DIR ?= ./test_media

# Helper to print detected environment status
info:
	@echo "--------------------------------------------------"
	@echo "💻 Operating System : $(OS)"
	@echo "🐳 Docker Daemon    : $(if $(HAS_DOCKER),✅ Active,⚠️ Inactive / Not Running)"
	@echo "⚡ UV Package Mgr  : $(if $(HAS_UV),✅ Installed,❌ Not Found)"
	@echo "--------------------------------------------------"

download-models:
	@echo "📦 Pre-fetching ML models (this may take a few minutes)..."
	uv run python scripts/download_models.py


install: info
	@echo "🚀 Setting up Sila..."
	@if [ -z "$(HAS_UV)" ]; then \
		echo "📦 Installing 'uv' (Python package manager)..."; \
		curl -LsSf https://astral.sh/uv/install.sh | sh; \
		export PATH="$$HOME/.local/bin:$$PATH"; \
	fi
	@if [ -z "$(HAS_DOCKER)" ]; then \
		if ! command -v redis-server > /dev/null 2>&1; then \
			echo "⚠️ Docker not detected and redis-server not found. Installing Redis..."; \
			if [ "$(OS)" = "Darwin" ]; then \
				echo "🍎 Installing Redis via Homebrew..."; \
				brew install redis || echo "❌ Failed to install Redis."; \
			elif [ "$(OS)" = "Linux" ]; then \
				if command -v apt-get > /dev/null 2>&1; then \
					echo "🐧 Installing Redis via apt..."; \
					sudo apt-get update && sudo apt-get install -y redis-server || echo "❌ Failed to install Redis."; \
				else \
					echo "❌ Unsupported Linux package manager. Please install redis-server manually."; \
				fi; \
			else \
				echo "🪟 Non-mac/Linux OS detected ($$OS). Please install Redis manually (e.g., using WSL on Windows) or run Docker."; \
			fi; \
		fi; \
	fi
	@echo "🔄 Syncing Python environment..."
	@uv sync
	@echo "📦 Installing UI dependencies..."
	@cd src/sila/ui && npm install
	@echo "✅ Installation complete! Run 'make download-models' if you wish to pre-fetch weights, or 'make start' to launch Sila."



start: info
	@echo "🟢 Booting Sila..."
	@echo "🧹 Clearing any stale Redis containers or port bindings..."
	@if [ -n "$(HAS_DOCKER)" ]; then docker rm -f sila-redis 2>/dev/null || true; fi
	@lsof -ti :6379 | xargs kill -9 2>/dev/null || true
	@lsof -ti :8000 | xargs kill -9 2>/dev/null || true
	@echo "🛠️ Ensuring databases are initialized..."
	@uv run python -m main init
	@if [ -n "$(HAS_DOCKER)" ]; then \
		if [ "$(OS)" = "Darwin" ]; then \
			echo "🍎 macOS + Docker detected -> Launching Hybrid Native Mode (Apple Metal Acceleration)..."; \
			uv run honcho start; \
		else \
			echo "🐧/🪟 Linux/Windows + Docker detected -> Launching Full Containerized Mode..."; \
			docker compose up -d; \
		fi \
	else \
		echo "⚠️ No Docker detected. Launching Pure Native Mode (Ensure 'redis-server' is installed locally)..."; \
		uv run honcho start -f Procfile.nodocker; \
	fi


# Run Sila ingestion pipeline on a target directory (removed 'start' dependency so it doesn't freeze)
run:
	@echo "📥 Running Sila Ingestion Pipeline on target: $(MEDIA_DIR)"
	uv run python -m main index --path $(MEDIA_DIR)

clean:
	@echo "🧹 Cleaning up background containers, databases, and temporary caches..."
	@if [ -n "$(HAS_DOCKER)" ]; then docker rm -f sila-redis 2>/dev/null || true; fi
	@lsof -ti :8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti :6379 | xargs kill -9 2>/dev/null || true
	@rm -rf .sila_cache/frames .sila_cache/sila_lancedb .sila_cache/sila_meta.db
	@echo "✨ Cleaned runtime data (preserved ML models in .sila_cache/models and .sila_cache/huggingface)."

clean-all: clean
	@echo "🚨 Purging all downloaded ML models..."
	@rm -rf .sila_cache/models .sila_cache/huggingface .sila_cache/torch
	@echo "✨ All caches and models purged."


# --- Quality Control & Development Targets ---

lint:
	uv run ruff check src/
	uv run ruff format --check src/
	uv run mypy src/ --strict --ignore-missing-imports

lint-fix:
	uv run ruff check src/ --fix
	uv run ruff format src/

test:
	uv run pytest tests/ --ignore=tests/integration

test-all:
	uv run pytest tests/

api:
	uv run python -m src.sila.main ui

dashboard:
	@echo "🖥️  Starting Sila React Dashboard..."
	cd src/sila/ui && npm run dev

dev:
	@echo "🚀 Launching Sila Backend API and Frontend Dashboard concurrently..."
	uv run python -m src.sila.main ui & \
	cd src/sila/ui && npm run dev