"""Local Multimodal Vision and Text Embedding Engines using Apple Metal Acceleration."""

import base64
import importlib
import logging
from io import BytesIO
from pathlib import Path

import torch
from PIL import Image
from huggingface_hub import hf_hub_download
from llama_cpp import Llama
from sentence_transformers import SentenceTransformer

from typing import TypedDict, cast

from config import (
    MODEL_DIR,
    LLAVA_REPO_ID,
    LLM_FILE,
    VISION_FILE,
    GEMMA_REPO_ID,
    GEMMA_LLM_FILE,
    CLIP_MODEL_NAME,
    TEXT_EMBEDDING_MODEL_NAME,
)

from src.sila.core.constants import EmbeddingType

EMBEDDING_MODEL_NAME = {
    EmbeddingType.VISION_LM: CLIP_MODEL_NAME,
    EmbeddingType.SENTENCE_MODEL: TEXT_EMBEDDING_MODEL_NAME,
}

logger = logging.getLogger("sila.core.llm")

LLAVA = "llava"
GEMMA = "gemma4"


class VisionModelConfig(TypedDict):
    repo_id: str
    llm_file: str
    vision_file: str | None
    chat_handler_cls: str | None
    chat_format: str | None
    n_ctx: int


VISION_MODEL_REGISTRY: dict[str, VisionModelConfig] = {
    LLAVA: {
        "repo_id": LLAVA_REPO_ID,
        "llm_file": LLM_FILE,
        "vision_file": VISION_FILE,
        "chat_handler_cls": "Llava15ChatHandler",
        "chat_format": None,
        "n_ctx": 2048,
    },
    GEMMA: {
        "repo_id": GEMMA_REPO_ID,
        "llm_file": GEMMA_LLM_FILE,
        "vision_file": None,
        "chat_handler_cls": None,
        "chat_format": "gemma",
        "n_ctx": 4096,
    },
}


class SilaVisionEngine:
    def __init__(self, model_key: str, cache_dir: str = "./models") -> None:
        if model_key not in VISION_MODEL_REGISTRY:
            raise ValueError(f"Model '{model_key}' not found in VISION_MODEL_REGISTRY.")

        self.config: VisionModelConfig = VISION_MODEL_REGISTRY[model_key]
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Download and fetch local file paths
        self.llm_path = self._prepare_file(
            self.config["repo_id"], self.config["llm_file"]
        )
        vision_file = self.config["vision_file"]
        self.vision_path = (
            self._prepare_file(self.config["repo_id"], vision_file)
            if vision_file is not None
            else None
        )

        # Load and bind instance (Self.model maps to your self.llm references)
        self.model = self._init_model()

    @staticmethod
    def _prepare_file(repo_id: str, filename: str) -> str:
        """Checks for the model locally before falling back to Hugging Face."""
        local_file_path = MODEL_DIR / filename

        # 1. Bypass download if you already have the file in .sila_cache/models/
        if local_file_path.exists():
            logger.info(f"Model found locally! Bypassing download: {local_file_path}")
            return str(local_file_path)

        # 2. If it ever goes missing, force HF to download it directly into our custom folder
        logger.warning(f"Model not found at {local_file_path}. Initiating download...")

        downloaded_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=str(MODEL_DIR),
        )
        return downloaded_path

    def _init_model(self) -> Llama:
        chat_handler = None
        handler_cls = self.config["chat_handler_cls"]
        if handler_cls and self.vision_path:
            module = importlib.import_module("llama_cpp.llama_chat_format")
            handler_class = getattr(module, handler_cls)
            chat_handler = handler_class(clip_model_path=str(self.vision_path))

        print(
            f"Loading weights onto M3 Max GPU matrix. Context length: {self.config['n_ctx']}"
        )
        return Llama(
            model_path=str(self.llm_path),
            chat_handler=chat_handler,
            chat_format=self.config["chat_format"],
            n_ctx=self.config["n_ctx"],
            n_gpu_layers=-1,  # Force-utilize 100% Metal acceleration on M3 Max
            verbose=False,
        )

    @staticmethod
    def _get_base64_image(image_path: Path) -> str:
        """Converts local files to a pure base64 string buffer."""
        img: Image.Image = Image.open(image_path)
        if img.mode != "RGB":
            img = img.convert("RGB")

        buffered = BytesIO()
        img.save(buffered, format="JPEG")
        return base64.b64encode(buffered.getvalue()).decode("utf-8")

    def generate_cognitive_tags(self, image_path: Path) -> str:
        """Passes the physical frame to the local AI for semantic scene analysis."""
        base64_image = self._get_base64_image(image_path)
        prompt = (
            "You are an expert cinematographer. Analyze this frame. "
            "Do not use <|think|> tags. Output a strict JSON object with exactly three fields: "
            "'scene_description' (a brief literal description of the action and environment), "
            "'lighting' (e.g., natural, overcast, high-contrast, moody), and "
            "'keywords' (a flat array of exactly 5 relevant tags). "
            "Do not include any formatting, markdown, or conversational text. Output only raw JSON."
        )

        try:
            response = self.model.create_chat_completion(
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                },
                            },
                        ],
                    }
                ],
                temperature=0.1,
            )
            # Correct dict accessor path for llama-cpp-python
            raw_text = ""
            if isinstance(response, dict):
                choices = response.get("choices", [])
                if choices and isinstance(choices[0], dict):
                    msg = choices[0].get("message", {})
                    if isinstance(msg, dict):
                        content = msg.get("content", "")
                        if isinstance(content, str):
                            raw_text = content

            # Markdown block cleanup
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.replace("```", "").strip()
            return raw_text

        except Exception as e:
            logger.error(f"Vision inference failed for {image_path.name}: {e}")
            return '{"scene_description": "Unknown", "lighting": "Unknown", "keywords": []}'


class SilaEmbeddingEngine:
    def __init__(self, embedding_type: EmbeddingType) -> None:

        self.embedding_type = embedding_type
        model_name = EMBEDDING_MODEL_NAME[embedding_type]
        if not model_name:
            raise ValueError(f"Unsupported embedding type: {embedding_type}")

        device = "cpu"
        if torch.backends.mps.is_available():
            device = "mps"
        elif torch.cuda.is_available():
            device = "cuda"
        try:
            self.embedding_model = SentenceTransformer(
                model_name, device=device, local_files_only=True
            )
        except Exception:
            logger.info(
                f"Local files not found for {model_name}. Downloading from Hugging Face..."
            )
            self.embedding_model = SentenceTransformer(
                model_name, device=device, local_files_only=False
            )

    def generate_embedding(self, input_data: str | Image.Image) -> list[float]:
        """
        Generates a vector embedding.

        input_data:
            - A string if embedding_type is TEXT
            - A PIL Image object if embedding_type is IMAGE
        """

        if self.embedding_type == EmbeddingType.SENTENCE_MODEL and not isinstance(
            input_data, str
        ):
            raise TypeError("Sentence embedding model requires a raw string query.")

        try:
            embeddings = self.embedding_model.encode(input_data)
            return cast(list[float], embeddings.tolist())
        except Exception as e:
            logger.error(f"Failed to generate vector: {e}")
            raise e
