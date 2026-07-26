import { useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Focus } from "lucide-react";
import type { MediaItem } from "../types";
import { imageUrlFor, setMediaJunkStatus } from "../lib/api";

interface MediaDetailModalProps {
  item: MediaItem;
  index: number;
  totalItems: number;
  useMockImage: boolean;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onStatusChange: (silaId: string, isJunk: number) => void;
}

export function MediaDetailModal({ 
  item, 
  index, 
  totalItems,
  useMockImage, 
  onClose, 
  onNavigate,
  onStatusChange
}: MediaDetailModalProps) {
  
  const aspect = item.aspect ?? 1;
  const isVideo = item.filename.endsWith(".mp4") || item.filename.endsWith(".mov") || item.filename.endsWith(".mkv") || item.filename.endsWith(".avi");
  
  const src = useMockImage 
    ? `https://picsum.photos/seed/${item.sila_id}/1200/900`
    : `${imageUrlFor(item.sila_id)}`;

  // The Rapid Cull Logic
  const handleCull = useCallback(async (isJunk: number) => {
    onStatusChange(item.sila_id, isJunk);
    try {
      await setMediaJunkStatus(item.sila_id, isJunk);
    } catch (e) {
      console.error("Cull failed", e);
    }
    if (index < totalItems - 1) {
      onNavigate(index + 1);
    } else {
      onClose();
    }
  }, [item.sila_id, index, totalItems, onStatusChange, onNavigate, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") handleCull(0); // Keep
      if (e.key === "ArrowLeft") handleCull(1);  // Junk
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCull, onClose]);

  const maxFocus = item.blur_score ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      {/* Frosted Glass Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-aesop-ink/80 backdrop-blur-md cursor-pointer"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-6xl max-h-[90vh] bg-aesop-paper border border-aesop-ink/10 shadow-2xl flex flex-col md:flex-row overflow-hidden rounded-sm"
      >
        {/* Media Frame */}
        <div className="relative flex-1 bg-black/5 flex items-center justify-center p-4 min-h-[300px]">
          {isVideo ? (
            <video src={src} controls autoPlay className="max-h-[70vh] object-contain shadow-md" />
          ) : (
            <motion.img layoutId={item.sila_id} src={src} alt={item.filename} className="max-h-[70vh] object-contain shadow-md" />
          )}
          
          {/* Focus Score Badge on top-left of image (photos only) */}
          {maxFocus > 0 && !isVideo && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 font-mono text-[10px]">
              <Focus size={11} className={maxFocus >= 0.7 ? "text-emerald-400" : maxFocus >= 0.3 ? "text-amber-400" : "text-red-400"} />
              <span className="text-white/60">Focus:</span>
              <span className={maxFocus >= 0.7 ? "text-emerald-400 font-bold" : maxFocus >= 0.3 ? "text-amber-400 font-bold" : "text-red-400 font-bold"}>
                {Math.round(maxFocus * 100)}%
              </span>
            </div>
          )}

          {item.is_junk === 1 && (
             <div className="absolute top-4 right-4 bg-red-900/90 text-red-100 text-[10px] uppercase tracking-widest px-2 py-1 font-mono">
               Flagged as Junk
             </div>
          )}
        </div>

        {/* Sidebar Metadata & Controls */}
        <div className="w-full md:w-80 border-l border-aesop-ink/10 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl italic text-aesop-ink truncate" style={{ fontFamily: "var(--font-aesop-serif)" }}>
                {item.filename}
              </h2>
              <button onClick={onClose} className="text-aesop-ink/50 hover:text-aesop-ink cursor-pointer">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            
            <div className="space-y-4 text-[11px] uppercase tracking-widest text-aesop-ink/60" style={{ fontFamily: "var(--font-aesop-sans)" }}>
              {!isVideo && (
                <div>
                  <span className="block text-[9px] text-aesop-ink/40 mb-1.5">Focus Score</span>
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[11px] font-bold border"
                    style={{
                      backgroundColor: maxFocus >= 0.7 ? "rgba(52, 211, 153, 0.12)" : maxFocus >= 0.3 ? "rgba(251, 191, 36, 0.12)" : "rgba(248, 113, 113, 0.12)",
                      borderColor: maxFocus >= 0.7 ? "rgba(52, 211, 153, 0.3)" : maxFocus >= 0.3 ? "rgba(251, 191, 36, 0.3)" : "rgba(248, 113, 113, 0.3)",
                      color: maxFocus >= 0.7 ? "#059669" : maxFocus >= 0.3 ? "#d97706" : "#dc2626"
                    }}
                  >
                    <Focus size={12} />
                    <span>{Math.round(maxFocus * 100)}%</span>
                  </div>
                </div>
              )}
              <div>
                <span className="block text-[9px] text-aesop-ink/40 mb-1">Sila Signature</span>
                <span className="font-mono text-aesop-ink">{item.sila_id.substring(0, 12)}...</span>
              </div>
            </div>
          </div>

          {/* Culling Hints */}
          <div className="mt-8 space-y-2 border-t border-aesop-ink/10 pt-6">
            <button onClick={() => handleCull(1)} className="w-full flex items-center justify-between p-3 border border-aesop-ink/10 bg-white/50 hover:bg-white transition-colors group cursor-pointer shadow-sm">
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-aesop-ink/80 group-hover:text-red-600">
                <ArrowLeft size={14} /> Trash
              </span>
            </button>
            <button onClick={() => handleCull(0)} className="w-full flex items-center justify-between p-3 border border-aesop-ink/10 bg-white/50 hover:bg-white transition-colors group cursor-pointer shadow-sm">
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-aesop-ink/80 group-hover:text-green-600">
                Keep <ArrowRight size={14} />
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
