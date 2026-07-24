/**
 * ParentCard.tsx
 *
 * Enhancements:
 * #1 — Natural aspect ratio (masonry) from capsule data instead of fixed aspect-video
 * #2 — Hover-activated capsule filmstrip scrub (3–5 keyframes)
 * #3 — Blur-score quality bar that sweeps in on hover (green/amber/red)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ParentMedia } from "../types";
import { imageUrlFor } from "../lib/api";
import { Film, Image as ImageIcon } from "lucide-react";

interface ParentCardProps {
  item: ParentMedia;
  index: number;
  onClick: () => void;
  /** Explicit aspect ratio override for grid staggering, e.g. "4/3" or "3/4" */
  forcedAspect?: string;
}

// ── Enhancement #3: quality bar colour from blur_score ──────────────────────

function qualityBarColor(blurScore: number): string {
  if (blurScore >= 0.8) return "#34d399"; // emerald — sharp
  if (blurScore >= 0.4) return "#fbbf24"; // amber — acceptable
  return "#f87171"; // red — blurry / junk risk
}

function qualityBarWidth(blurScore: number): string {
  // blur_score is normalised 0–1; map to 20–100% for better visual range
  return `${Math.max(20, Math.round(blurScore * 100))}%`;
}

export function ParentCard({ item, index, onClick, forcedAspect }: ParentCardProps) {
  const [errored, setErrored] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // ── Enhancement #1: natural aspect ratio ────────────────────────────────
  // Use the first capsule's aspect ratio if available; fall back to 16/9
  const bestBlurScore =
    item.capsules.length > 0
      ? Math.max(...item.capsules.map((c) => c.blur_score))
      : 0;

  // Use the first non-junk capsule as cover, fallback to any first capsule
  const coverCapsule =
    item.capsules.length > 0
      ? item.capsules.find((c) => c.is_junk === 0) ?? item.capsules[0]
      : null;

  const src = errored
    ? `https://picsum.photos/seed/${item.parent_id}/800/600`
    : coverCapsule
    ? imageUrlFor(coverCapsule.capsule_id)
    : `http://localhost:8000/api/stream/${item.parent_id}`;

  const isVideo = item.media_type === "video";

  // Filmstrip capsules (up to 5 non-junk frames)
  const filmstripCapsules = item.capsules
    .filter((c) => c.is_junk === 0)
    .slice(0, 5);

  // Aspect ratio: use forced override for grid staggering, else 16/9
  const aspectRatio = forcedAspect ?? "16 / 9";

  return (
    <motion.div
      className="group w-full cursor-pointer border border-aesop-ink/10 p-3 bg-aesop-paper transition-all duration-300 hover:border-aesop-ink/30 hover:shadow-[0_8px_32px_-8px_rgba(42,36,32,0.10)]"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
    >
      <div
        className="relative w-full overflow-hidden bg-aesop-ink/5"
        style={{ aspectRatio }}
      >
        {/* ── Main thumbnail ── */}
        <motion.img
          src={src}
          alt={item.filename}
          onError={() => setErrored(true)}
          onLoad={() => setImgLoaded(true)}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover will-change-transform"
          initial={false}
          animate={{
            scale: hovered ? 1.025 : (imgLoaded ? 1 : 1.05),
            filter: imgLoaded ? "blur(0px)" : "blur(8px)",
            opacity: imgLoaded ? 1 : 0,
          }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        />

        {/* ── Media type badge ── */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 bg-aesop-paper/90 px-2 py-1 backdrop-blur-sm border border-aesop-ink/10 z-10">
          {isVideo ? (
            <Film size={10} className="text-aesop-ink" />
          ) : (
            <ImageIcon size={10} className="text-aesop-ink" />
          )}
          <span className="text-[9px] font-mono tracking-widest text-aesop-ink/80 uppercase">
            {isVideo ? `${item.capsules.length} MOMENTS` : "PHOTO"}
          </span>
        </div>

        {/* ── Filename label (hover) ── */}
        <div className="pointer-events-none absolute left-2.5 bottom-2.5 bg-aesop-ink/90 px-2 py-1 backdrop-blur-sm border border-aesop-paper/10 max-w-[90%] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <span className="block truncate font-mono text-[9px] uppercase tracking-widest text-aesop-paper">
            {item.filename}
          </span>
        </div>

        {/* ── Capsule filmstrip on hover (multi-clip) ── */}
        <AnimatePresence>
          {hovered && filmstripCapsules.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute inset-x-0 bottom-0 z-20 flex gap-[2px] p-1.5 bg-gradient-to-t from-aesop-ink/70 to-transparent pt-8"
            >
              {filmstripCapsules.map((cap, i) => (
                <motion.div
                  key={cap.capsule_id}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.055, duration: 0.2 }}
                  className="flex-1 aspect-video overflow-hidden rounded-[2px] border border-white/15 bg-aesop-ink/40"
                >
                  <img
                    src={imageUrlFor(cap.capsule_id)}
                    alt=""
                    className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-200"
                    draggable={false}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Enhancement #3: Quality bar ── */}
        {coverCapsule && (
          <div
            className="quality-bar"
            style={{
              width: qualityBarWidth(bestBlurScore),
              backgroundColor: qualityBarColor(bestBlurScore),
              boxShadow: `0 0 6px 0 ${qualityBarColor(bestBlurScore)}80`,
            }}
          />
        )}
      </div>
    </motion.div>
  );
}
