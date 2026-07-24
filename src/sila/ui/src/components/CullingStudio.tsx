import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import {
  Undo2, Trash2, Play, Pause, Maximize2, CornerUpLeft,
  HardDrive, Calendar, Focus, ChevronLeft, ChevronRight,
  ArrowLeft, ArrowRight, RotateCcw, X,
} from "lucide-react";
import type { ParentMedia } from "../types";
import { imageUrlFor, setParentJunkStatus } from "../lib/api";

import { CustomMediaPlayer } from "./CustomMediaPlayer";

export type CullMode = "lobby" | "swiping" | "expanded-keepers" | "expanded-junk";

const API_BASE = "http://localhost:8000/api";

interface CullingStudioProps {
  library: ParentMedia[];
  onStatusUpdate: (parentId: string, isJunk: number) => void;
  onHardDelete: () => void;
  mode: CullMode;
  setMode: (mode: CullMode) => void;
  reviewedIds: Set<string>;
  onToggleReviewed: (parentId: string, reviewed: boolean) => void;
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDate = (timestamp: number) => {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
};

/** Inline video player overlay, shown when user clicks Play on a video item */
function VideoPlayer({ parentId, capsules = [], onClose }: { parentId: string; capsules?: any[]; onClose: () => void }) {
  // Stop keyboard events from triggering culling decisions while player is open
  useEffect(() => {
    const stop = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) e.stopPropagation();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", stop, true);
    return () => window.removeEventListener("keydown", stop, true);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-30 flex flex-col bg-black rounded-sm overflow-hidden"
    >
      {/* Close bar */}
      <div className="flex-none flex items-center justify-between px-4 py-2 bg-black/80 z-40">
        <span className="text-[8px] uppercase tracking-[0.25em] text-white/40 font-mono">Sila Custom Player</span>
        <button onClick={onClose} className="text-white/40 hover:text-white/90 transition-colors cursor-pointer">
          <X size={14} />
        </button>
      </div>

      {/* Video */}
      <div className="flex-1 min-h-0 relative">
        <CustomMediaPlayer
          mediaType="video"
          src={`${API_BASE}/stream/${parentId}`}
          filename={parentId}
          capsules={capsules}
        />
      </div>
    </motion.div>
  );
}

// ─── EXPANDED GRID VIEW ──────────────────────────────────────────────────────

function ExpandedView({
  mode, keepers, junk, setMode, onRescue,
}: {
  mode: CullMode; keepers: ParentMedia[]; junk: ParentMedia[];
  setMode: (m: CullMode) => void; onRescue: (id: string) => void;
}) {
  const isKeepers = mode === "expanded-keepers";
  const items = isKeepers ? keepers : junk;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col min-h-[80vh] bg-[--color-aesop-paper]"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-[--color-aesop-ink]/8">
        <button
          onClick={() => setMode("lobby")}
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[--color-aesop-ink]/40 hover:text-[--color-aesop-ink] transition-colors cursor-pointer"
        >
          <CornerUpLeft size={12} />
          Back
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-bold uppercase tracking-[0.25em] ${isKeepers ? "text-emerald-700" : "text-red-700"}`}>
            {isKeepers ? "Keepers" : "Trash"}
          </span>
          <span className="text-[10px] font-mono text-[--color-aesop-ink]/30">{items.length}</span>
        </div>
        {!isKeepers && (
          <p className="text-[8px] uppercase tracking-[0.2em] text-[--color-aesop-ink]/25">
            Hover to rescue →
          </p>
        )}
      </header>

      {/* Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-[2px] p-[2px]">
        {items.map((p, idx) => (
          <motion.div
            key={p.parent_id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.02, duration: 0.3 }}
            className="relative aspect-square overflow-hidden group cursor-pointer"
            onClick={() => !isKeepers && onRescue(p.parent_id)}
          >
            <img
              src={p.capsules && p.capsules.length > 0 ? imageUrlFor(p.capsules[0].capsule_id) : `${API_BASE}/stream/${p.parent_id}`}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03] ${
                !isKeepers ? "grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-80" : "opacity-75 hover:opacity-100"
              }`}
            />
            {/* Rescue overlay for junk */}
            {!isKeepers && (
              <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="flex items-center gap-1 bg-[--color-aesop-paper]/90 backdrop-blur-sm px-2 py-1 text-[7px] uppercase tracking-[0.2em] text-emerald-700 font-bold">
                  <RotateCcw size={8} /> Rescue
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────

// Enhancement #10: animated integer counter using spring physics
function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(value, { stiffness: 90, damping: 18 });
  const rounded = useTransform(spring, Math.round);
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const unsubscribe = rounded.on("change", (v) => setDisplay(v));
    return unsubscribe;
  }, [rounded]);
  useEffect(() => { spring.set(value); }, [value, spring]);
  return (
    <motion.span
      key={value}
      animate={{ scale: [1, 1.14, 1] }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {display}
    </motion.span>
  );
}

function LobbyView({
  queue, library, keepers, junk, setMode, onHardDelete, onRescue,
}: {
  queue: ParentMedia[]; library: ParentMedia[]; keepers: ParentMedia[]; junk: ParentMedia[];
  setMode: (m: CullMode) => void; onHardDelete: () => void; onRescue: (id: string) => void;
}) {
  // ── Correct counting: totalItems is always the real library size ──
  const totalItems = library.length;
  const totalCulled = totalItems - queue.length;
  const pct = totalItems > 0 ? Math.round((totalCulled / totalItems) * 100) : 0;
  const allDone = queue.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-[80vh] bg-[--color-aesop-paper]"
    >
      {/* ── Page Header ── */}
      <div className="px-8 pt-2 pb-8 border-b border-[--color-aesop-ink]/8">
        <p className="text-[9px] uppercase tracking-[0.35em] text-[--color-aesop-ink]/30 mb-1">The Darkroom</p>
        <h2 className="text-3xl font-light text-[--color-aesop-ink]" style={{ fontFamily: "var(--font-aesop-serif)" }}>
          Culling Studio
        </h2>
      </div>

      <div className="px-8 py-8 grid grid-cols-[1fr_auto] gap-16 items-start">

        {/* ── Left: Stats + Trays ── */}
        <div className="space-y-10">

          {/* Progress bar + stats */}
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[--color-aesop-ink]/40">Progress</span>
              <span className="font-mono text-[11px] text-[--color-aesop-ink]/50">{totalCulled} / {totalItems} reviewed</span>
            </div>
            <div className="relative h-[2px] bg-[--color-aesop-ink]/8 w-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-[--color-aesop-ink]/50"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="flex gap-6 pt-1">
              <span className="text-[9px] uppercase tracking-[0.2em] text-emerald-700 font-mono flex items-center gap-1">
                <AnimatedCount value={keepers.length} /> kept
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-red-700 font-mono flex items-center gap-1">
                <AnimatedCount value={junk.length} /> trashed
              </span>
              {queue.length > 0 && (
                <span className="text-[9px] uppercase tracking-[0.2em] text-[--color-aesop-ink]/30 font-mono flex items-center gap-1">
                  <AnimatedCount value={queue.length} /> pending
                </span>
              )}
            </div>
          </div>

          {/* Two trays side by side */}
          <div className="grid grid-cols-2 gap-6">
            {/* Keepers tray */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] uppercase tracking-[0.3em] text-emerald-700 font-bold">Keepers</span>
                {keepers.length > 0 && (
                  <button
                    onClick={() => setMode("expanded-keepers")}
                    className="text-[--color-aesop-ink]/25 hover:text-[--color-aesop-ink]/60 transition-colors cursor-pointer"
                  >
                    <Maximize2 size={12} />
                  </button>
                )}
              </div>
              {keepers.length > 0 ? (
                <div className="grid grid-cols-4 gap-[2px]">
                  {keepers.slice(0, 8).map((p) => (
                    <div key={p.parent_id} className="aspect-square overflow-hidden bg-[--color-aesop-ink]/5">
                      <img
                        src={p.capsules && p.capsules.length > 0 ? imageUrlFor(p.capsules[0].capsule_id) : `${API_BASE}/stream/${p.parent_id}`}
                        className="w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity duration-300"
                      />
                    </div>
                  ))}
                  {keepers.length > 8 && (
                    <div className="aspect-square bg-[--color-aesop-ink]/5 flex items-center justify-center">
                      <span className="text-[9px] font-mono text-[--color-aesop-ink]/30">+{keepers.length - 8}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[4/1] border border-dashed border-[--color-aesop-ink]/10 flex items-center justify-center">
                  <span className="text-[9px] text-[--color-aesop-ink]/20 tracking-widest uppercase">Empty</span>
                </div>
              )}
            </div>

            {/* Trash tray */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] uppercase tracking-[0.3em] text-red-700 font-bold">Trash</span>
                <div className="flex items-center gap-2">
                  {junk.length > 0 && (
                    <>
                      <button
                        onClick={() => setMode("expanded-junk")}
                        className="text-[--color-aesop-ink]/25 hover:text-[--color-aesop-ink]/60 transition-colors cursor-pointer"
                      >
                        <Maximize2 size={12} />
                      </button>
                      <button
                        onClick={onHardDelete}
                        className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.2em] text-red-600/60 hover:text-red-600 transition-colors cursor-pointer border-l border-[--color-aesop-ink]/10 pl-2"
                      >
                        <Trash2 size={10} />
                        Empty
                      </button>
                    </>
                  )}
                </div>
              </div>
              {junk.length > 0 ? (
                <div className="grid grid-cols-4 gap-[2px]">
                  {junk.slice(0, 8).map((p) => (
                    <div
                      key={p.parent_id}
                      className="relative aspect-square overflow-hidden bg-[--color-aesop-ink]/5 group cursor-pointer"
                      onClick={() => onRescue(p.parent_id)}
                      title="Click to rescue from trash"
                    >
                      <img
                        src={p.capsules && p.capsules.length > 0 ? imageUrlFor(p.capsules[0].capsule_id) : `${API_BASE}/stream/${p.parent_id}`}
                        className="w-full h-full object-cover grayscale opacity-35 group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-300"
                      />
                      {/* Rescue icon appears on hover */}
                      <div className="absolute inset-0 flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <span className="flex items-center gap-0.5 bg-[--color-aesop-paper]/90 px-1.5 py-0.5 text-[6px] uppercase tracking-[0.15em] text-emerald-700 font-bold">
                          <RotateCcw size={7} /> Rescue
                        </span>
                      </div>
                    </div>
                  ))}
                  {junk.length > 8 && (
                    <div className="aspect-square bg-[--color-aesop-ink]/5 flex items-center justify-center">
                      <span className="text-[9px] font-mono text-[--color-aesop-ink]/30">+{junk.length - 8}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[4/1] border border-dashed border-[--color-aesop-ink]/10 flex items-center justify-center">
                  <span className="text-[9px] text-[--color-aesop-ink]/20 tracking-widest uppercase">Empty</span>
                </div>
              )}
              {junk.length > 0 && (
                <p className="mt-2 text-[7px] text-[--color-aesop-ink]/20 tracking-widest uppercase">
                  Click any photo to rescue it
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: The CTA ── */}
        <div className="flex flex-col items-center gap-6 pt-14 min-w-[220px]">
          {allDone ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 mx-auto border border-[--color-aesop-ink]/12 rounded-full flex items-center justify-center">
                <Focus size={18} className="text-[--color-aesop-ink]/30" strokeWidth={1.2} />
              </div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[--color-aesop-ink]/35">Library fully culled</p>
              <p className="text-[8px] text-[--color-aesop-ink]/20 tracking-[0.1em]">
                Click trashed photos to rescue them
              </p>
            </div>
          ) : (
            <button
              onClick={() => setMode("swiping")}
              className="group relative flex flex-col items-center gap-5 cursor-pointer"
              aria-label="Start culling"
            >
              {/* Animated aperture ring */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full border border-[--color-aesop-ink]/12"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.15, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute inset-[8px] rounded-full border border-[--color-aesop-ink]/20"
                  animate={{ scale: [1, 1.04, 1], opacity: [0.6, 0.3, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                />
                <div className="relative w-[68px] h-[68px] rounded-full border-2 border-[--color-aesop-ink]/60 bg-[--color-aesop-ink] flex items-center justify-center transition-all duration-400 group-hover:scale-[1.05] shadow-[0_4px_20px_rgba(42,36,32,0.15)] group-hover:shadow-[0_8px_32px_rgba(42,36,32,0.25)]">
                  <Focus size={22} className="text-[--color-aesop-paper]" strokeWidth={1.5} />
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[--color-aesop-ink] group-hover:tracking-[0.4em] transition-all duration-400">
                  Begin Culling
                </p>
                <p className="text-[9px] tracking-[0.15em] text-[--color-aesop-ink]/35 font-mono">
                  {queue.length} to review
                </p>
              </div>
            </button>
          )}

          {/* Keyboard hint */}
          {!allDone && (
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.2em] text-[--color-aesop-ink]/20">
              <kbd className="px-1.5 py-0.5 border border-[--color-aesop-ink]/15 font-mono text-[7px]">←</kbd>
              <span>trash</span>
              <span className="mx-1 opacity-50">·</span>
              <kbd className="px-1.5 py-0.5 border border-[--color-aesop-ink]/15 font-mono text-[7px]">→</kbd>
              <span>keep</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── SWIPING ─────────────────────────────────────────────────────────────────

function SwipingView({
  queue, library, history, currentItem, triggerDecision, handleUndoAction, setMode,
}: {
  queue: ParentMedia[]; library: ParentMedia[]; history: { item: ParentMedia; prevJunkStatus: number; decision: number }[];
  currentItem: ParentMedia | null;
  triggerDecision: (v: number) => void; handleUndoAction: () => void; setMode: (m: CullMode) => void;
}) {
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  // When item changes, close any open video player
  useEffect(() => { setShowVideo(false); }, [currentItem?.parent_id]);

  const totalReviewed = library.length - queue.length;
  const total = library.length;

  // Kinematic fly-off swipe trail
  const handleTrash = () => {
    setSwipeDir("left");
    setExitDir("left");
    setTimeout(() => { setSwipeDir(null); setExitDir(null); triggerDecision(1); }, 360);
  };
  const handleKeep = () => {
    setSwipeDir("right");
    setExitDir("right");
    setTimeout(() => { setSwipeDir(null); setExitDir(null); triggerDecision(0); }, 360);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col w-full bg-neutral-950 rounded-xl overflow-hidden border border-white/[0.04] shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
      style={{ minHeight: "78vh" }}
    >
      {/* ── Top bar ── */}
      <div className="flex-none h-12 flex items-center justify-between px-6 border-b border-white/[0.04]">
        <button
          onClick={() => setMode("lobby")}
          className="flex items-center gap-2 text-[9px] uppercase tracking-[0.25em] text-white/25 hover:text-white/60 transition-colors cursor-pointer"
        >
          <CornerUpLeft size={11} />
          Exit
        </button>

        {/* Film strip progress */}
        <div className="flex items-center gap-[3px]">
          {Array.from({ length: Math.min(total, 30) }).map((_, i) => {
            const itemIdx = Math.floor((i / Math.min(total, 30)) * total);
            const isCurrent = itemIdx === totalReviewed;
            const isReviewed = itemIdx < totalReviewed;
            return (
              <div
                key={i}
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  isCurrent ? "w-4 bg-white/70" : isReviewed ? "w-[3px] bg-white/20" : "w-[3px] bg-white/[0.06]"
                }`}
              />
            );
          })}
        </div>

        <span className="font-mono text-[9px] text-white/20 tracking-widest">
          {totalReviewed + 1} / {total}
        </span>
      </div>

      {/* ── Main content ── */}
      <div className="relative flex-1 min-h-0 flex">

        {/* ── Trash hint — left ── */}
        <div className="flex-none w-20 flex flex-col items-center justify-center gap-2 border-r border-white/[0.03]">
          <motion.div
            animate={{
              opacity: swipeDir === "left" ? 1 : 0.2,
              scale: swipeDir === "left" ? 1.15 : 1,
              filter: swipeDir === "left" ? "drop-shadow(0 0 8px rgba(239,68,68,0.85))" : "drop-shadow(0 0 0px transparent)",
            }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-2 select-none"
          >
            <ChevronLeft size={16} className="text-red-400" strokeWidth={1.5} />
            <span className="text-[8px] uppercase tracking-[0.2em] text-red-400 font-mono" style={{ writingMode: "vertical-rl" }}>
              Trash
            </span>
          </motion.div>
        </div>

        {/* Center: photo / video */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 gap-5">
          <AnimatePresence mode="wait">
            {currentItem && (
              <motion.div
                key={currentItem.parent_id}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{
                  opacity: 1, scale: 1, y: 0,
                  x: swipeDir === "left" ? -18 : swipeDir === "right" ? 18 : 0,
                  rotateZ: swipeDir === "left" ? -1.5 : swipeDir === "right" ? 1.5 : 0,
                }}
                exit={{
                  opacity: 0,
                  x: exitDir === "left" ? -window.innerWidth * 0.7 : exitDir === "right" ? window.innerWidth * 0.7 : 0,
                  rotateZ: exitDir === "left" ? -12 : exitDir === "right" ? 12 : 0,
                  scale: 0.88,
                  transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] },
                }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="w-full flex flex-col items-center gap-4 min-h-0"
              >
                {/* Main thumbnail / video player area */}
                <div className="relative w-full flex-1 min-h-0 max-h-[46vh] flex items-center justify-center">
                  {/* Thumbnail image (always present as background) */}
                  <img
                    src={currentItem.capsules && currentItem.capsules.length > 0 ? imageUrlFor(currentItem.capsules[0].capsule_id) : `${API_BASE}/stream/${currentItem.parent_id}`}
                    className="max-h-full max-w-full object-contain rounded-sm shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
                    style={{
                      filter: swipeDir === "left" ? "grayscale(60%) brightness(0.8)" : swipeDir === "right" ? "brightness(1.05) saturate(1.1)" : undefined,
                      transition: "filter 0.18s ease",
                    }}
                  />

                  {/* Inline video player overlay */}
                  <AnimatePresence>
                    {showVideo && currentItem.media_type === "video" && (
                      <VideoPlayer
                        parentId={currentItem.parent_id}
                        capsules={currentItem.capsules}
                        onClose={() => setShowVideo(false)}
                      />
                    )}
                  </AnimatePresence>

                  {/* Video play button (only when not already playing) */}
                  {currentItem.media_type === "video" && !showVideo && (
                    <button
                      onClick={() => setShowVideo(true)}
                      className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                      aria-label="Play video"
                    >
                      {/* Video badge top-left */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/55 backdrop-blur-sm px-2.5 py-1 rounded-full pointer-events-none">
                        <Play size={9} fill="currentColor" className="text-white/80" />
                        <span className="text-[8px] font-mono text-white/70 tracking-widest uppercase">Video</span>
                      </div>
                      {/* Centered play circle */}
                      <div className="w-14 h-14 rounded-full bg-black/50 border border-white/20 flex items-center justify-center backdrop-blur-sm transition-all duration-200 group-hover:bg-black/70 group-hover:border-white/40 group-hover:scale-110">
                        <Play size={20} fill="currentColor" className="text-white/80 ml-0.5" />
                      </div>
                    </button>
                  )}
                </div>

                {/* Video scene filmstrip (below main image) */}
                {currentItem.media_type === "video" && currentItem.capsules.length > 1 && (
                  <div className="w-full flex-none">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[7px] uppercase tracking-[0.3em] text-white/20 font-mono">Scenes</span>
                      <div className="flex-1 h-[1px] bg-white/[0.04]" />
                      <span className="text-[7px] font-mono text-white/15">{currentItem.capsules.length} clips</span>
                    </div>
                    <div className="flex gap-[3px]">
                      {currentItem.capsules.slice(1, 6).map((cap) => (
                        <div
                          key={cap.capsule_id}
                          className="relative flex-1 aspect-video overflow-hidden rounded-[2px] bg-white/[0.04]"
                          style={{
                            filter: swipeDir === "left" ? "grayscale(80%) brightness(0.6)" : undefined,
                            transition: "filter 0.18s ease",
                          }}
                        >
                          <img
                            src={imageUrlFor(cap.capsule_id)}
                            className="w-full h-full object-cover opacity-50 hover:opacity-80 transition-opacity duration-200"
                          />
                          <span className="absolute bottom-0.5 left-0.5 text-[6px] font-mono text-white/40 leading-none">
                            {Math.floor(cap.timestamp)}s
                          </span>
                        </div>
                      ))}
                      {currentItem.capsules.length > 6 && (
                        <div className="flex-none w-10 aspect-video rounded-[2px] bg-white/[0.04] flex items-center justify-center">
                          <span className="text-[7px] font-mono text-white/25">+{currentItem.capsules.length - 6}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-5 text-[9px] font-mono uppercase tracking-[0.2em] text-white/25">
                  <span className="flex items-center gap-1.5">
                    <HardDrive size={10} />
                    {formatBytes(currentItem.file_size)}
                  </span>
                  <span className="text-white/10">·</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={10} />
                    {formatDate(currentItem.created_at)}
                  </span>
                  <span className="text-white/10">·</span>
                  <span className="text-white/20 max-w-[180px] truncate" style={{ textTransform: "none", fontFamily: "var(--font-aesop-serif)", fontSize: "10px", letterSpacing: "0" }}>
                    {currentItem.filename}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Keep hint — right ── */}
        <div className="flex-none w-20 flex flex-col items-center justify-center gap-2 border-l border-white/[0.03]">
          <motion.div
            animate={{
              opacity: swipeDir === "right" ? 1 : 0.2,
              scale: swipeDir === "right" ? 1.15 : 1,
              filter: swipeDir === "right" ? "drop-shadow(0 0 8px rgba(52,211,153,0.85))" : "drop-shadow(0 0 0px transparent)",
            }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-2 select-none"
          >
            <ChevronRight size={16} className="text-emerald-400" strokeWidth={1.5} />
            <span className="text-[8px] uppercase tracking-[0.2em] text-emerald-400 font-mono" style={{ writingMode: "vertical-rl" }}>
              Keep
            </span>
          </motion.div>
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex-none border-t border-white/[0.06] px-10 py-5 flex items-center justify-between bg-neutral-900/40">
        {/* Trash */}
        <button
          onClick={handleTrash}
          className="group flex items-center gap-3 cursor-pointer"
          aria-label="Mark as trash"
        >
          <div className="w-12 h-12 rounded-full border border-red-500/35 bg-red-500/[0.07] flex items-center justify-center group-hover:border-red-500/70 group-hover:bg-red-500/15 transition-all duration-200">
            <ArrowLeft size={16} className="text-red-400/70 group-hover:text-red-400 transition-colors duration-200" />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 group-hover:text-red-400 transition-colors duration-200 font-medium">Trash</p>
            <p className="text-[7px] font-mono text-white/20 mt-0.5">← arrow key</p>
          </div>
        </button>

        {/* Undo */}
        <button
          onClick={handleUndoAction}
          disabled={history.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] text-[8px] uppercase tracking-[0.2em] text-white/35 hover:text-white/60 hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-0 transition-all duration-200 cursor-pointer"
        >
          <Undo2 size={11} />
          <span>Undo last</span>
        </button>

        {/* Keep */}
        <button
          onClick={handleKeep}
          className="group flex items-center gap-3 cursor-pointer flex-row-reverse"
          aria-label="Keep"
        >
          <div className="w-12 h-12 rounded-full border border-emerald-500/35 bg-emerald-500/[0.07] flex items-center justify-center group-hover:border-emerald-500/70 group-hover:bg-emerald-500/15 transition-all duration-200">
            <ArrowRight size={16} className="text-emerald-400/70 group-hover:text-emerald-400 transition-colors duration-200" />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 group-hover:text-emerald-400 transition-colors duration-200 font-medium">Keep</p>
            <p className="text-[7px] font-mono text-white/20 mt-0.5">→ arrow key</p>
          </div>
        </button>
      </div>
    </motion.div>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

export function CullingStudio({
  library,
  onStatusUpdate,
  onHardDelete,
  mode,
  setMode,
  reviewedIds,
  onToggleReviewed,
}: CullingStudioProps) {
  const [queue, setQueue] = useState<ParentMedia[]>(() =>
    library.filter(
      (p) =>
        !reviewedIds.has(p.parent_id) &&
        (!p.capsules || p.capsules.length === 0 || !p.capsules.every((c) => c.is_junk === 1))
    )
  );
  const [history, setHistory] = useState<{ item: ParentMedia; prevJunkStatus: number; decision: number }[]>([]);

  useEffect(() => {
    setQueue(
      library.filter(
        (p) =>
          !reviewedIds.has(p.parent_id) &&
          (!p.capsules || p.capsules.length === 0 || !p.capsules.every((c) => c.is_junk === 1))
      )
    );
  }, [library, reviewedIds]);

  // Derived: keepers = items that are reviewed and marked is_junk === 0 (not junk)
  const keepers = library.filter(
    (p) =>
      reviewedIds.has(p.parent_id) &&
      (!p.capsules || p.capsules.length === 0 || p.capsules.some((c) => c.is_junk === 0))
  );
  const junk = library.filter((p) => p.capsules && p.capsules.length > 0 && p.capsules.every((c) => c.is_junk === 1));
  const currentItem = queue[0];

  // ── Rescue: move a trashed item back to keep ──
  const handleRescue = useCallback(async (parentId: string) => {
    onStatusUpdate(parentId, 0);
    onToggleReviewed(parentId, true);
    try {
      await setParentJunkStatus(parentId, 0);
    } catch (e) { console.error("Rescue sync failed", e); }
  }, [onStatusUpdate, onToggleReviewed]);

  const triggerDecision = useCallback(
    async (isJunk: number) => {
      if (!currentItem) return;
      const prevStatus = currentItem.capsules && currentItem.capsules.length > 0 ? currentItem.capsules[0].is_junk : 0;
      setHistory((prev) => [...prev, { item: currentItem, prevJunkStatus: prevStatus, decision: isJunk }]);
      onToggleReviewed(currentItem.parent_id, true);
      onStatusUpdate(currentItem.parent_id, isJunk);
      try {
        await setParentJunkStatus(currentItem.parent_id, isJunk);
      } catch (e) { console.error("Sync failed", e); }
      if (queue.length <= 1) setMode("lobby");
    },
    [currentItem, queue.length, onStatusUpdate, onToggleReviewed, setMode]
  );

  const handleUndoAction = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((prev) => prev.slice(0, -1));
    onToggleReviewed(last.item.parent_id, false);
    onStatusUpdate(last.item.parent_id, last.prevJunkStatus);
    try {
      await setParentJunkStatus(last.item.parent_id, last.prevJunkStatus);
    } catch (e) { console.error("Undo sync failed", e); }
  }, [history, onStatusUpdate, onToggleReviewed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "swiping") return;
      if (e.key === "ArrowLeft") triggerDecision(1);
      if (e.key === "ArrowRight") triggerDecision(0);
      if ((e.metaKey || e.ctrlKey) && e.key === "z") handleUndoAction();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, triggerDecision, handleUndoAction]);

  return (
    <AnimatePresence mode="wait">
      {(mode === "expanded-keepers" || mode === "expanded-junk") && (
        <ExpandedView key="expanded" mode={mode} keepers={keepers} junk={junk} setMode={setMode} onRescue={handleRescue} />
      )}
      {mode === "lobby" && (
        <LobbyView
          key="lobby"
          queue={queue}
          library={library}
          keepers={keepers}
          junk={junk}
          setMode={setMode}
          onHardDelete={onHardDelete}
          onRescue={handleRescue}
        />
      )}
      {mode === "swiping" && (
        <SwipingView
          key="swiping"
          queue={queue}
          library={library}
          history={history}
          currentItem={currentItem ?? null}
          triggerDecision={triggerDecision}
          handleUndoAction={handleUndoAction}
          setMode={setMode}
        />
      )}
    </AnimatePresence>
  );
}
