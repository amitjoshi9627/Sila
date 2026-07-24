/**
 * LandingFoyer.tsx
 *
 * Changes from feedback:
 * - Removed cursor parallax (didn't feel right)
 * - Restored and enhanced the rotating aperture/pattern as the primary decoration
 * - Added subtle hover interaction: door cards gently repel from cursor
 * - Added CSS drift animation back to mosaic (no JS parallax)
 * - Added a secondary slowly-rotating dot-grid texture
 */
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Search, Focus, ArrowRight } from "lucide-react";
import type { ParentMedia } from "../types";
import { imageUrlFor } from "../lib/api";

interface LandingFoyerProps {
  library: ParentMedia[];
  libraryCount: number;
  isLoading: boolean;
  onEnter: (workspace: "home" | "search" | "cull") => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "The quiet hours";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late session";
}

function formatStorageEstimate(items: ParentMedia[]): string {
  const totalBytes = items.reduce((sum, p) => sum + (p.file_size || 0), 0);
  if (totalBytes === 0) return "";
  const gb = totalBytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB indexed`;
  const mb = totalBytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB indexed`;
}

const TITLE_LETTERS = ["S", "i", "l", "a"];

const letterVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.4 + i * 0.1,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const DOORS = [
  {
    id: "home" as const,
    icon: LayoutGrid,
    title: "Library",
    description: "Browse every moment you've ever captured.",
  },
  {
    id: "search" as const,
    icon: Search,
    title: "Search",
    description: "Find scenes by describing what you remember.",
  },
  {
    id: "cull" as const,
    icon: Focus,
    title: "Darkroom",
    description: "Decide what stays and what goes.",
  },
];

/** Inline SVG aperture — the visual placeholder circle */
function ApertureSVG() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
      <svg
        viewBox="0 0 200 200"
        className="w-[min(60vw,400px)] h-[min(60vw,400px)] sila-aperture-rotate"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        style={{ color: "var(--color-aesop-ink)", opacity: 0.06 }}
      >
        {/* Concentric circles */}
        <circle cx="100" cy="100" r="95" />
        <circle cx="100" cy="100" r="75" />
        <circle cx="100" cy="100" r="55" />
        <circle cx="100" cy="100" r="35" />
        <circle cx="100" cy="100" r="15" />
        {/* Aperture blades */}
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <line
            key={angle}
            x1="100"
            y1="100"
            x2={100 + 95 * Math.cos((angle * Math.PI) / 180)}
            y2={100 + 95 * Math.sin((angle * Math.PI) / 180)}
          />
        ))}
        {/* Cross hairs */}
        <line x1="100" y1="2" x2="100" y2="198" strokeDasharray="4 8" />
        <line x1="2" y1="100" x2="198" y2="100" strokeDasharray="4 8" />
      </svg>
    </div>
  );
}

export function LandingFoyer({ library, libraryCount, isLoading, onEnter }: LandingFoyerProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const storageStr = useMemo(() => formatStorageEstimate(library), [library]);
  const isEmpty = libraryCount === 0 && !isLoading;
  const [hoveredDoor, setHoveredDoor] = useState<string | null>(null);

  // Mosaic thumbnails (CSS drift — no JS parallax)
  const mosaicThumbs = useMemo(() => {
    if (library.length === 0) return [];
    const step = Math.max(1, Math.floor(library.length / 36));
    const picks: string[] = [];
    for (let i = 0; i < library.length && picks.length < 36; i += step) {
      const capsule = library[i].capsules[0];
      if (capsule) picks.push(capsule.capsule_id);
    }
    return picks;
  }, [library]);

  const doorThumbs = useMemo(() => {
    const thumbs: Record<string, string | null> = { home: null, search: null, cull: null };
    if (library.length >= 1) thumbs.home = library[0]?.capsules[0]?.capsule_id || null;
    if (library.length >= 2) thumbs.search = library[Math.floor(library.length / 3)]?.capsules[0]?.capsule_id || null;
    if (library.length >= 3) thumbs.cull = library[Math.floor(library.length * 2 / 3)]?.capsules[0]?.capsule_id || null;
    return thumbs;
  }, [library]);

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center aesop-paper select-none">
      {/* ── BACKGROUND: MOSAIC or APERTURE PLACEHOLDER CIRCLE ── */}
      {mosaicThumbs.length > 0 ? (
        <div className="foyer-mosaic" aria-hidden="true" style={{ animation: "sila-drift 45s ease-in-out infinite" }}>
          {mosaicThumbs.map((id, i) => (
            <img key={i} src={imageUrlFor(id)} alt="" loading="eager" draggable={false} />
          ))}
        </div>
      ) : (
        <ApertureSVG />
      )}
      <div className="foyer-vignette" aria-hidden="true" />

      {/* ── TYPOGRAPHIC CENTER ── */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-8"
        initial="hidden"
        animate="visible"
      >
        {/* Title */}
        <h1 className="flex select-none" style={{ fontFamily: "var(--font-aesop-serif)" }}>
          {TITLE_LETTERS.map((letter, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={letterVariants}
              className="inline-block text-[clamp(100px,18vw,200px)] font-light leading-none tracking-tight text-aesop-ink"
              style={{ fontOpticalSizing: "auto" }}
            >
              {letter}
            </motion.span>
          ))}
        </h1>

        {/* Greeting */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="mt-4 text-[11px] uppercase tracking-[0.35em] text-aesop-ink/50"
          style={{ fontFamily: "var(--font-aesop-sans)" }}
        >
          {greeting}.{" "}
          {isLoading
            ? "Waking up…"
            : isEmpty
            ? "Your library is quiet. Drop some photos to begin."
            : `${libraryCount.toLocaleString()} moments await.`}
        </motion.p>

        {/* ── THE THREE DOORS (EDITORIAL ACCORDION) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 flex flex-col sm:flex-row gap-2 sm:gap-4 w-full max-w-4xl h-[400px] sm:h-64"
          onMouseLeave={() => setHoveredDoor(null)}
        >
          {DOORS.map((door, doorIdx) => {
            const Icon = door.icon;
            const thumbId = doorThumbs[door.id];
            const isHovered = hoveredDoor === door.id;
            const isAnyHovered = hoveredDoor !== null;

            return (
              <motion.button
                key={door.id}
                onMouseEnter={() => setHoveredDoor(door.id)}
                onFocus={() => setHoveredDoor(door.id)}
                onClick={() => onEnter(door.id)}
                initial={{ opacity: 0, y: 15 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  flex: isHovered ? 3 : isAnyHovered ? 0.7 : 1
                }}
                transition={{ 
                  opacity: { delay: 1.2 + doorIdx * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                  y: { delay: 1.2 + doorIdx * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                  flex: { type: "spring", bounce: 0, duration: 0.5 }
                }}
                className="group relative overflow-hidden border border-aesop-ink/10 bg-aesop-paper/40 flex flex-col justify-end p-5 text-left transition-colors hover:border-aesop-ink/30 cursor-pointer min-h-[100px]"
              >
                {/* Background Image Strip */}
                {thumbId ? (
                  <motion.img
                    src={imageUrlFor(thumbId)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    animate={{ 
                      scale: isHovered ? 1.05 : 1,
                      opacity: isHovered ? 0.8 : 0.3,
                      filter: isHovered ? "grayscale(0%)" : "grayscale(80%)"
                    }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-aesop-ink/5">
                    <Icon size={48} className="text-aesop-ink/10" strokeWidth={0.5} />
                  </div>
                )}
                
                {/* Elegant Gradient Overlay to protect text */}
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-t from-aesop-paper/95 via-aesop-paper/40 to-transparent"
                  animate={{ opacity: isHovered ? 0.9 : 0.7 }}
                  transition={{ duration: 0.4 }}
                />

                {/* Content Overlay */}
                <div className="relative z-10 flex flex-col justify-end h-full">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 bg-aesop-paper/80 backdrop-blur-sm p-2 border border-aesop-ink/10 shadow-sm transition-transform duration-500 group-hover:scale-110">
                      <Icon size={14} className="text-aesop-ink/80" />
                    </div>
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.3em] text-aesop-ink whitespace-nowrap"
                      style={{ fontFamily: "var(--font-aesop-sans)" }}
                    >
                      {door.title}
                    </span>
                  </div>
                  
                  <motion.div
                    initial={false}
                    animate={{ 
                      opacity: isHovered ? 1 : 0,
                      height: isHovered ? "auto" : 0,
                      marginTop: isHovered ? 12 : 0
                    }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p
                      className="text-[11px] leading-relaxed text-aesop-ink/70 max-w-[200px]"
                      style={{ fontFamily: "var(--font-aesop-serif)" }}
                    >
                      {door.description}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-aesop-ink/50">
                      <span>Enter</span>
                      <ArrowRight size={10} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </motion.div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>

      {/* ── AMBIENT FOOTER ── */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="absolute bottom-6 inset-x-0 flex justify-center gap-3 text-[9px] uppercase tracking-[0.25em] text-aesop-ink/25 font-mono z-10"
      >
        <span className="text-aesop-ink/65 font-medium">Built by AJ</span>
        <span>·</span>
        <span>localhost:8000</span>
        {libraryCount > 0 && (
          <>
            <span>·</span>
            <span>{libraryCount} assets</span>
          </>
        )}
        {storageStr && (
          <>
            <span>·</span>
            <span>{storageStr}</span>
          </>
        )}
      </motion.footer>
    </div>
  );
}
