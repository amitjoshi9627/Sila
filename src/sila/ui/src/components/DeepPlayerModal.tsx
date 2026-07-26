/**
 * DeepPlayerModal.tsx — Enhancement #8
 * Cognitive tag chips are now clickable, fire a semantic search for that tag,
 * and enter with a staggered bounce animation.
 */

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, HardDrive, Calendar, Sparkles, Zap, Focus } from "lucide-react";
import type { ParentMedia } from "../types";
import { imageUrlFor } from "../lib/api";

import { CustomMediaPlayer } from "./CustomMediaPlayer";

interface DeepPlayerProps {
  item: ParentMedia;
  onClose: () => void;
  onTagSearch?: (tag: string) => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

export function DeepPlayerModal({ item, onClose, onTagSearch }: DeepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = item.media_type === "video";

  const seekTo = useCallback((timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const coverCapsule =
    item.capsules && item.capsules.length > 0
      ? item.capsules.find((c) => c.is_junk === 0) || item.capsules[0]
      : null;
  const coverSrc = coverCapsule ? imageUrlFor(coverCapsule.capsule_id) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      {/* ── High-performance solid dark overlay (avoids GPU frame drops during transition) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={onClose}
        className="absolute inset-0 bg-[#181412]/92 cursor-pointer"
        style={{ willChange: "opacity" }}
      />

      {/* ── Main modal container with GPU-accelerated springless scaling ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="relative z-10 w-full max-w-7xl h-[85vh] bg-aesop-ink border border-aesop-paper/5 shadow-2xl flex flex-col md:flex-row overflow-hidden rounded-xl"
      >
        {/* ── Main media area (Custom Sila Media Player) ── */}
        <div className="relative flex-1 deep-player-glow flex items-center justify-center p-6">
          <CustomMediaPlayer
            mediaType={item.media_type}
            src={`http://localhost:8000/api/stream/${item.parent_id}`}
            coverSrc={coverSrc}
            filename={item.filename}
            capsules={item.capsules}
            videoRef={videoRef}
          />
        </div>

        {/* ── Info sidebar ── */}
        <div className="w-full md:w-80 bg-aesop-ink border-l border-aesop-paper/5 flex flex-col h-full relative z-20">

          {/* Header */}
          <div className="p-5 border-b border-aesop-paper/5 bg-aesop-ink">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-sm font-semibold text-amber-50/90 truncate pr-4">{item.filename}</h2>
              <button onClick={onClose} className="text-amber-100/40 hover:text-amber-100/90 shrink-0 cursor-pointer transition-colors"><X size={20} strokeWidth={1.5} /></button>
            </div>

            <div className="space-y-2 text-[10px] uppercase tracking-widest text-amber-100/40 font-mono">
              <div className="flex items-center gap-2"><HardDrive size={12} className="text-amber-100/30" /> {formatBytes(item.file_size)}</div>
              <div className="flex items-center gap-2"><Calendar size={12} className="text-amber-100/30" /> {formatDate(item.created_at)}</div>
              <div className="truncate text-amber-100/30 lowercase" title={item.filepath}>{item.filepath}</div>
            </div>
          </div>

          {/* Capsule list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 aesop-scrollbar">
            {item.capsules.map((capsule) => (
              <div key={capsule.capsule_id} className="group relative flex flex-col gap-3 p-3 border border-transparent transition-colors hover:bg-white/5 hover:border-white/10 rounded-lg">

                <div className="flex gap-3 cursor-pointer" onClick={() => isVideo && seekTo(capsule.timestamp)}>
                  <div className="w-24 h-16 bg-black/40 overflow-hidden shrink-0 relative rounded border border-white/10">
                    <img src={imageUrlFor(capsule.capsule_id)} alt="Scene" className="w-full h-full object-cover" />
                    {isVideo && <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play size={16} className="text-white drop-shadow" fill="white" /></div>}
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="font-mono text-[11px] font-bold text-amber-50/80">{isVideo ? formatTime(capsule.timestamp) : "PHOTO"}</span>
                    {!isVideo && (
                      <div className="flex items-center gap-1 mt-1 font-mono text-[9.5px]">
                        <Focus size={10} className={capsule.blur_score >= 0.7 ? "text-emerald-400" : capsule.blur_score >= 0.3 ? "text-amber-400" : "text-red-400"} />
                        <span className={capsule.blur_score >= 0.7 ? "text-emerald-400 font-bold" : capsule.blur_score >= 0.3 ? "text-amber-400 font-bold" : "text-red-400 font-bold"}>
                          Focus: {Math.round(capsule.blur_score * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Cognitive Engine AI Output ── */}
                {capsule.cognitive && (
                  <div className="mt-2 bg-black/20 rounded-md border border-white/5 p-4 space-y-4 shadow-inner">

                    {/* Scene Description */}
                    {capsule.cognitive.scene_description && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2 text-amber-500/60">
                          <Sparkles size={10} />
                          <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Scene</span>
                        </div>
                        <p className="text-[12px] leading-relaxed text-amber-50/90" style={{ fontFamily: "var(--font-aesop-serif)" }}>
                          {capsule.cognitive.scene_description}
                        </p>
                      </div>
                    )}

                    {/* Lighting */}
                    {capsule.cognitive.lighting && (
                      <div className="pt-3 border-t border-white/5">
                        <span className="block text-[8px] font-bold uppercase tracking-[0.2em] text-amber-500/60 mb-1.5">Lighting</span>
                        <span className="inline-block bg-amber-900/30 border border-amber-500/20 px-2 py-1 text-[9px] font-bold tracking-widest text-amber-400/90 rounded-sm">
                          {capsule.cognitive.lighting}
                        </span>
                      </div>
                    )}

                    {/* Keywords — Enhancement #8: clickable tag chips with stagger */}
                    {capsule.cognitive.keywords && capsule.cognitive.keywords.length > 0 && (
                      <div className="pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-500/60">Keywords</span>
                          {onTagSearch && (
                            <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                              <span className="w-1 h-1 rounded-full bg-amber-400/60 animate-pulse" />
                              <span className="text-[7px] uppercase tracking-[0.15em] text-amber-400/70 font-mono">tap to search</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <AnimatePresence>
                            {capsule.cognitive.keywords.map((kw, idx) => (
                              <motion.button
                                key={kw}
                                initial={{ opacity: 0, scale: 0.8, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{
                                  delay: idx * 0.05,
                                  type: "spring",
                                  stiffness: 300,
                                  damping: 20,
                                }}
                                whileHover={{ scale: 1.08, backgroundColor: "rgba(245,163,50,0.12)" }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => onTagSearch?.(kw)}
                                className={`group/chip flex items-center gap-1 bg-white/5 border border-white/10 px-2.5 py-1 text-[9px] tracking-widest text-amber-100/60 rounded-sm transition-colors lowercase ${onTagSearch ? "cursor-pointer hover:border-amber-500/30 hover:text-amber-200/80" : "cursor-default"}`}
                              >
                                {kw}
                                {onTagSearch && (
                                  <Zap size={7} className="text-amber-500/0 group-hover/chip:text-amber-500/60 transition-colors" />
                                )}
                              </motion.button>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
