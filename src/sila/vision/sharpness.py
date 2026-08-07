import logging
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger("sila.vision.sharpness")


@dataclass(frozen=True)
class SharpnessResult:
    overall_score: float  # 0.0 - 1.0
    focus_coverage: float  # 0.0 - 1.0
    verdict: str


class SilaSharpnessAnalyzer:
    """Patch-based sharpness detection optimized for variable depth-of-field."""

    def __init__(
        self,
        image_size: int = 512,
        patch_size: int = 64,
        stride: int = 32,
        edge_threshold: int = 75,
        min_edge_density: float = 0.02,
    ):

        self.image_size = image_size
        self.patch_size = patch_size
        self.stride = stride
        self.edge_threshold = edge_threshold
        self.min_edge_density = min_edge_density

    def analyze(self, image_path: Path) -> SharpnessResult:
        """Main execution pipeline for evaluating image sharpness."""
        try:
            gray = self._load_image(image_path)
        except ValueError as e:
            logger.error(f"Failed to load image for sharpness check: {e}")
            return SharpnessResult(0.0, 0.0, "Error")

        patch_scores = self._compute_patch_scores(gray)

        if len(patch_scores) == 0:
            return SharpnessResult(
                overall_score=0.0,
                focus_coverage=0.0,
                verdict="Blurry",
            )

        overall = self._overall_score(patch_scores)
        coverage = self._focus_coverage(patch_scores)
        verdict = self._quality_label(overall)

        return SharpnessResult(
            overall_score=round(overall, 3),
            focus_coverage=round(coverage, 2),
            verdict=verdict,
        )

    def _load_image(self, path: Path) -> np.ndarray:
        image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
        if image is None:
            raise ValueError(path)

        h, w = image.shape
        scale = self.image_size / max(h, w)

        if scale < 1:
            image = cv2.resize(
                image,
                None,
                fx=scale,
                fy=scale,
                interpolation=cv2.INTER_AREA,
            )

        # Removed GaussianBlur to preserve micro-contrast for sharpness detection
        return image

    def _compute_patch_scores(self, image: np.ndarray) -> np.ndarray:
        h, w = image.shape
        scores = []

        for y in range(0, h - self.patch_size + 1, self.stride):
            for x in range(0, w - self.patch_size + 1, self.stride):
                patch = image[y : y + self.patch_size, x : x + self.patch_size]

                if self._edge_density(patch) < self.min_edge_density:
                    continue

                scores.append(self._tenengrad(patch))

        return np.asarray(scores, dtype=np.float32)

    @staticmethod
    def _tenengrad(image: np.ndarray) -> float:
        gx = cv2.Sobel(image, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(image, cv2.CV_32F, 0, 1, ksize=3)

        return float(np.mean(gx * gx + gy * gy))

    def _edge_density(self, image: np.ndarray) -> float:
        edges = cv2.Canny(
            image,
            self.edge_threshold,
            self.edge_threshold * 2,
        )
        return np.count_nonzero(edges) / edges.size

    @staticmethod
    def _overall_score(scores: np.ndarray) -> float:
        peak = np.percentile(scores, 90)

        # Recalibrated to account for the squared Tenengrad values
        score = np.interp(
            peak,
            [
                500,
                15000,
            ],  # These bounds will need slight tuning based on your specific dataset
            [0.0, 1.0],
        )
        return float(np.clip(score, 0.0, 1.0))

    @staticmethod
    def _focus_coverage(scores: np.ndarray) -> float:
        # Measure coverage against an absolute baseline rather than a percentile
        peak = np.percentile(scores, 90)

        # A patch is "in focus" if its sharpness is at least 60% of the peak sharpness
        threshold = peak * 0.60

        return float(np.mean(scores >= threshold))

    @staticmethod
    def _quality_label(score: float) -> str:
        if score >= 0.85:
            return "Excellent"
        if score >= 0.70:
            return "Good"
        if score >= 0.50:
            return "Acceptable"
        if score >= 0.30:
            return "Soft"
        return "Blurry"
