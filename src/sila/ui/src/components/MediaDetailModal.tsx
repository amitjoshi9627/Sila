import { useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, ArrowRight, ArrowLeft } from "lucide-react";
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
    ? `/test_media/${item.filename}`
    : imageUrlFor(item.sila_id);

  // The Rapid Cull Logic
  const handleCull = useCallback(async (isJunk: number) => {
    // 1. Optimistically update UI state immediately
    onStatusChange(item.sila_id, isJunk);
    
    // 2. Advance to the next item instantly (if not at the end)
    if (index < totalItems - 1) {
      onNavigate(index + 1);
    } else {
      onClose(); // Close if we hit the end of the gallery
    }

    // 3. Fire the backend update asynchronously in the background
    try {
      await setMediaJunkStatus(item.sila_id, isJunk);
    } catch (e) {
      console.error("Failed to sync junk status to database", e);
      // If it fails, revert the optimistic update
      onStatusChange(item.sila_id, item.is_junk); 
    }
  }, [item, index, totalItems, onNavigate, onClose, onStatusChange]);

  // Keyboard Navigation Bindings
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") handleCull(0); // Keep
      if (e.key === "ArrowLeft") handleCull(1);  // Junk
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCull, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose}
        className="absolute inset-0 bg-[var(--color-aesop-paper)] cursor-pointer"
      />

      {/* Modal Content */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative z-10 w-full max-w-5xl bg-aesop-paper border border-aesop-ink/20 shadow-2xl flex flex-col md:flex-row overflow-hidden"
      >
        {/* Image Area */}
        <div className="relative flex-1 bg-[var(--color-aesop-paper)] flex items-center justify-center p-4">
           {isVideo ? (
             <video
               src={`/test_media/${item.filename}`}
               controls
               autoPlay
               className="max-h-[70vh] object-contain shadow-md"
             />
           ) : (
             <motion.img layoutId={item.sila_id} src={src} alt={item.filename} className="max-h-[70vh] object-contain shadow-md" />
           )}
           {item.is_junk === 1 && (
              <div className="absolute top-4 left-4 bg-red-900/90 text-red-100 text-[10px] uppercase tracking-widest px-2 py-1 font-mono">
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
              <div>
                <span className="block text-[9px] text-aesop-ink/40 mb-1">Focus Score</span>
                <span className="font-mono text-aesop-ink">{item.blur_score.toFixed(3)}</span>
              </div>
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
