import { useState } from "react";
import { motion } from "framer-motion";
import type { MediaItem } from "../types";
import { imageUrlFor } from "../lib/api";

interface MediaCardProps {
  item: MediaItem;
  index: number;
  useMockImage: boolean;
  onClick?: () => void;
}

// Helper function to format seconds into MM:SS
const formatTime = (seconds: number) => {
  if (seconds === 0) return "PHOTO";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export function MediaCard({ item, index, useMockImage, onClick }: MediaCardProps) {
  const [errored, setErrored] = useState(false);
  const aspect = item.aspect ?? 1;

  const isVideo = item.filename.endsWith(".mp4") || item.filename.endsWith(".mov") || item.filename.endsWith(".mkv") || item.filename.endsWith(".avi");
  const showVideo = isVideo && (useMockImage || errored);

  const src = useMockImage || errored
    ? `/test_media/${item.filename}`
    : imageUrlFor(item.sila_id);

  const isJunk = item.is_junk === 1;

  return (
    <motion.div
      layout
      layoutId={item.sila_id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
      }}
      className="group w-full cursor-pointer border border-aesop-ink/10 p-3 bg-aesop-paper transition-all duration-300 hover:border-aesop-ink/30 shadow-[0_4px_20px_-4px_rgba(42,36,32,0.02)]"
      onClick={onClick}
    >
      <div
        className={[
          "relative w-full overflow-hidden bg-aesop-ink/5",
          "transition-opacity duration-500 hover:opacity-95",
        ].join(" ")}
        style={{ aspectRatio: `1 / ${aspect}` }}
      >
        {/* Video or Image */}
        {showVideo ? (
          <video
            src={src}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            loop
            playsInline
            autoPlay
          />
        ) : (
          <motion.img
            src={src}
            alt={item.filename}
            onError={() => !useMockImage && setErrored(true)}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform group-hover:scale-[1.01]"
          />
        )}

        {/* TIMESTAMP BADGE (New for V0.3) */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1 bg-aesop-paper/90 px-1.5 py-0.5 backdrop-blur-sm border border-aesop-ink/10">
          <span className="text-[9px] font-mono tracking-widest text-aesop-ink/80 uppercase" style={{ fontFamily: "var(--font-aesop-sans)" }}>
            {(item.timestamp ?? 0) > 0 ? `▶ ${formatTime(item.timestamp!)}` : "PHOTO"}
          </span>
        </div>

        {/* JUNK badge */}
        {isJunk && (
          <div className="absolute right-2.5 top-2.5 flex items-center gap-1 bg-aesop-paper/90 px-1.5 py-0.5 backdrop-blur-sm border border-aesop-ink/10">
            <span className="text-[9px] font-medium tracking-[0.3em] text-aesop-ink/60 uppercase" style={{ fontFamily: "var(--font-aesop-sans)" }}>
              set aside
            </span>
          </div>
        )}

        {/* Resting filename */}
        <div className="pointer-events-none absolute left-2.5 bottom-2.5 bg-aesop-ink/90 px-2 py-1 backdrop-blur-sm border border-aesop-paper/10 max-w-[90%]">
          <span className="block truncate font-mono text-[9px] uppercase tracking-widest text-aesop-paper">
            {item.filename}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
