import argparse
import logging
import json

from src.sila.db.sqlite_client import SilaSQLiteClient
from src.sila.db.lancedb_client import SilaLanceDBClient
from src.sila.pipeline.organizer import SilaSymlinkOrganizer
from src.sila.pipeline.scanner import SilaMediaScanner
from src.sila.search.engine import SilaHybridSearchEngine

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sila.main")


def init_system():
    """Step 1: Guarantee databases and tables exist."""
    logger.info("Initializing Sila V0.5 Persistence Layer...")
    SilaSQLiteClient().initialize_schema()
    SilaLanceDBClient().initialize_schema()
    logger.info("System Ready. You can now start the Honcho procfile.")


def index_directory(target_path: str):
    """Step 2: Walk a directory and dispatch to Celery DAG."""
    logger.info(f"Ensuring databases are initialized...")
    init_system()
    logger.info(f"Scanning directory for ingestion: {target_path}")
    scanner = SilaMediaScanner(target_directory=target_path)
    scanner.scan_and_slice()
    logger.info("Media scanned. Monitor Celery logs for DAG completion.")


def search_local(query: str, limit: int):
    """Step 3: Test the Tri-Modal Search Engine directly from the terminal."""
    logger.info(f"Initiating Tri-Modal Search for: '{query}'")
    engine = SilaHybridSearchEngine()

    results = engine.execute_query(text_query=query, limit=limit)

    # Print formatted JSON to the terminal
    print("\n--- Search Results ---")
    print(json.dumps(results, indent=2))
    print(f"\nFound {len(results)} parent files containing matching capsules.")


def export_album(query: str, album_name: str, limit: int):
    """Executes a search and creates a virtual symlink album on disk."""
    logger.info(f"Initiating Search & Export for: '{query}'")
    engine = SilaHybridSearchEngine()
    results = engine.execute_query(text_query=query, limit=limit)

    organizer = SilaSymlinkOrganizer()
    organizer.create_virtual_album(album_name=album_name, grouped_search_results=results)


def revert_album():
    """Rolls back the last symlink generation."""
    organizer = SilaSymlinkOrganizer()
    organizer.revert_last_transaction()


def main():
    parser = argparse.ArgumentParser(description="Sila MLOps Framework V0.5")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Command: init
    subparsers.add_parser(
        "init", help="Initialize databases and MLflow tracking schemas"
    )

    # Command: index
    index_parser = subparsers.add_parser(
        "index", help="Scan a directory and dispatch ingestion tasks"
    )
    index_parser.add_argument(
        "--path", type=str, required=True, help="Absolute path to the media directory"
    )

    export_parser = subparsers.add_parser("export", help="Search and export footage to a symlink album")
    export_parser.add_argument("--query", type=str, required=True, help="The search query text")
    export_parser.add_argument("--album", type=str, required=True, help="Name of the folder to create")
    export_parser.add_argument("--limit", type=int, default=20, help="Max files to export")

    subparsers.add_parser("revert", help="Undo the last export transaction")

    # Command: search
    search_parser = subparsers.add_parser(
        "search", help="Test the Tri-Modal Search Engine locally"
    )
    search_parser.add_argument(
        "--query", type=str, required=True, help="The search query text"
    )
    search_parser.add_argument(
        "--limit", type=int, default=5, help="Number of parent files to return"
    )

    args = parser.parse_args()

    if args.command == "init":
        init_system()
    elif args.command == "index":
        index_directory(args.path)
    elif args.command == "search":
        search_local(args.query, args.limit)
    elif args.command == "export":
        export_album(args.query, args.album, args.limit)
    elif args.command == "revert":
        revert_album()


if __name__ == "__main__":
    main()
