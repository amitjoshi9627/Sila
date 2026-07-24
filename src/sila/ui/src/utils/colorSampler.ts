/**
 * colorSampler.ts — Enhancement #7
 * Samples the dominant hue from a thumbnail image via <canvas>,
 * then sets --color-session-accent as an RGB triplet on :root.
 * This tints the active nav dot, Omnibar focus ring, and culling progress bar
 * to softly reflect the mood of your current media session.
 */

/** Extract the average RGB of a remote image via an offscreen canvas. */
function sampleImageColor(src: string): Promise<[number, number, number]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Sample from a 24×24 downscale — fast and enough for hue detection
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve([42, 36, 32]); return; }
      ctx.drawImage(img, 0, 0, 24, 24);
      const data = ctx.getImageData(0, 0, 24, 24).data;

      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Skip near-white and near-black pixels — they don't represent the scene
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (brightness < 30 || brightness > 225) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      if (count === 0) { resolve([42, 36, 32]); return; }
      resolve([Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
    };
    img.onerror = () => resolve([42, 36, 32]);
    img.src = src;
  });
}

/**
 * Given a list of thumbnail URLs, samples the first valid one and
 * writes the dominant hue to --color-session-accent on :root.
 * Falls back gracefully to the default warm ink colour.
 */
export async function applySessionAccent(thumbnailUrls: string[]): Promise<void> {
  for (const url of thumbnailUrls.slice(0, 3)) {
    try {
      const [r, g, b] = await sampleImageColor(url);
      // Nudge the sampled colour towards warmth — blend 40% toward the base ink
      const blended = [
        Math.round(r * 0.6 + 42 * 0.4),
        Math.round(g * 0.6 + 36 * 0.4),
        Math.round(b * 0.6 + 32 * 0.4),
      ];
      document.documentElement.style.setProperty(
        "--color-session-accent",
        blended.join(", ")
      );
      return;
    } catch {
      // continue to next URL
    }
  }
  // Fallback: reset to default warm ink
  document.documentElement.style.setProperty("--color-session-accent", "42, 36, 32");
}
