"""Non-Destructive Symlink Organization and Transaction Rollback Engine."""

import json
import logging
import os
from pathlib import Path
from typing import Any

from src.sila.db.sqlite_client import SilaSQLiteClient

logger = logging.getLogger("sila.pipeline.organizer")


class SilaSymlinkOrganizer:
    def __init__(self, workspace_name: str = "Sila Exports") -> None:
        self.workspace_dir = Path.cwd() / workspace_name
        self.db = SilaSQLiteClient()

    def create_virtual_album(
        self, album_name: str, grouped_search_results: list[dict[str, Any]]
    ) -> None:
        """Generates symbolic links for search results in a nested target folder safely."""
        if not grouped_search_results:
            logger.warning("Cannot create a virtual album with zero assets.")
            return

        target_dir = self.workspace_dir / album_name
        target_dir.mkdir(parents=True, exist_ok=True)

        symlink_payload: list[dict[str, str]] = []
        success_count = 0

        logger.info(f"Generating Virtual Album: {target_dir}")

        for parent in grouped_search_results:
            source_path = Path(parent["filepath"])
            if not source_path.exists():
                continue

            short_id = parent["parent_id"][:6]
            link_name = f"{source_path.stem}_{short_id}{source_path.suffix}"
            link_path = target_dir / link_name

            try:
                os.symlink(source_path, link_path)
                symlink_payload.append(
                    {"link": str(link_path), "source": str(source_path)}
                )
                success_count += 1
            except FileExistsError:
                logger.debug(f"Symlink already exists for {link_name}")
            except OSError as e:
                logger.error(f"Failed to create symlink for {source_path.name}: {e}")

        if symlink_payload:
            payload_json = json.dumps(symlink_payload)
            op_id = self.db.record_transaction(
                "CREATE_ALBUM", str(target_dir), payload_json
            )
            logger.info(
                f"✅ Created {success_count} symlinks. Transaction recorded as OP_ID: {op_id}"
            )

    def revert_last_transaction(self) -> None:
        """Safely reads the last recorded operation and deletes only the generated symlinks."""
        transaction = self.db.get_last_transaction()

        if not transaction:
            logger.info("No Sila transactions found to revert.")
            return

        op_id = transaction["op_id"]
        target_folder = Path(transaction["target_folder"])
        payload = json.loads(transaction["payload"])

        logger.info(
            f"Reverting Transaction OP_ID: {op_id} (Target: {target_folder.name})"
        )

        deleted_count = 0
        for item in payload:
            link_path = Path(item["link"])

            # CRITICAL SAFETY CHECK: Ensure we are only deleting a symlink, never a real file
            if link_path.is_symlink():
                link_path.unlink()
                deleted_count += 1

        # Cleanup: If the virtual folder is now empty, delete the folder itself
        if target_folder.exists() and not any(target_folder.iterdir()):
            target_folder.rmdir()
            logger.info("Removed empty virtual directory.")

        # Remove the transaction record from the database
        self.db.delete_transaction(op_id)
        logger.info(f"✅ Revert Complete. Safely removed {deleted_count} symlinks.")
