import logging
from celery import chain
from src.sila.workers.tasks import process_vision_node, process_embedding_node

logger = logging.getLogger("sila.pipeline.dispatcher")


class SilaDAGDispatcher:
    @staticmethod
    def dispatch_capsule(
        capsule_id: str, image_path: str, parent_id: str, timestamp: float
    ):
        """
        Constructs and fires a sequential workflow (DAG).
        Vision Node -> (passes results safely) -> Embedding Node
        """
        workflow = chain(
            process_vision_node.s(
                capsule_id=capsule_id,
                image_path_str=image_path,
                parent_sila_id=parent_id,
                timestamp=timestamp,
            ),
            # The output of process_vision_node is automatically piped into process_embedding_node
            process_embedding_node.s(),
        )

        workflow.apply_async()
        logger.info(f"DAG Dispatched to Redis for capsule: {capsule_id}")
