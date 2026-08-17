import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Activity, Clock, Cpu } from "lucide-react";

interface SearchLatencyBadgeProps {
  latencyMs: number;
  isSearching: boolean;
  itemCount?: number;
  query?: string;
  onOpenTelemetry?: () => void;
}

// Pseudo-random heights for the background sparkline
const SPARKLINE_DATA = [4, 7, 3, 5, 8, 12, 6, 4, 9, 7, 5, 10, 4, 6, 8, 14, 5, 7];

export function SearchLatencyBadge({
  latencyMs,
  isSearching,
  query,
  onOpenTelemetry,
}: SearchLatencyBadgeProps) {
  const [liveElapsed, setLiveElapsed] = useState(0);

  // Live timer tick during search in-flight
  useEffect(() => {
    if (!isSearching) return;
    const start = performance.now();
    const timer = setInterval(() => {
      setLiveElapsed(Math.round(performance.now() - start));
    }, 16);
    return () => clearInterval(timer);
  }, [isSearching]);

  const displayMs = isSearching ? liveElapsed : latencyMs;
  
  // Performance tier
  const isFast = displayMs > 0 && displayMs < 40;
  const isModerate = displayMs >= 40 && displayMs < 120;

  const accentColor = isSearching
    ? "#d97706" // amber during search
    : isFast
    ? "#059669" // emerald for <40ms
    : isModerate
    ? "#d97706" // amber
    : "#4b5563"; // neutral

  if (!isSearching && latencyMs <= 0 && !query) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="inline-flex items-center gap-2"
    >
      <button
        type="button"
        onClick={onOpenTelemetry}
        title="View Tri-Modal Search Latency Breakdown & Telemetry (Press T)"
        className="group relative flex items-center h-8 rounded-full border border-aesop-ink/15 bg-transparent px-3.5 hover:bg-aesop-ink/5 hover:border-aesop-ink/25 transition-all duration-300 cursor-pointer select-none"
      >
        {/* Left Icon */}
        <div className="relative flex items-center justify-center mr-3">
          {isSearching ? (
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: accentColor }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ backgroundColor: accentColor }}
              />
            </span>
          ) : (
            <Zap
              size={13}
              className="shrink-0 text-aesop-ink/60 transition-transform duration-300 group-hover:scale-110"
              strokeWidth={1.5}
            />
          )}
        </div>

        {/* Inline Sparkline */}
        <div className="flex items-end gap-[1.5px] h-3.5 mr-3 opacity-60 mix-blend-multiply group-hover:opacity-80 transition-opacity">
          {SPARKLINE_DATA.map((h, i) => (
            <div 
              key={i} 
              className="w-[1.5px] bg-aesop-ink/30 rounded-t-sm"
              style={{ height: `${h}px` }} 
            />
          ))}
          {/* The current latency bar */}
          <motion.div 
             className="w-[2px] rounded-t-sm" 
             initial={{ height: 2 }}
             animate={{ height: isSearching ? 4 : (isFast ? 6 : (isModerate ? 10 : 14)) }}
             style={{ backgroundColor: accentColor }} 
             transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />
        </div>

        {/* Latency Number */}
        <div className="flex items-baseline gap-1 font-mono tracking-tight text-aesop-ink mr-2.5">
          <span className="text-[12px] font-medium tabular-nums">
            {isSearching ? `${liveElapsed}` : latencyMs.toFixed(1)}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-aesop-ink/60">
            ms
          </span>
        </div>

        {/* Divider & TRACE label */}
        <div className="flex items-center gap-2.5 pl-2.5 border-l border-aesop-ink/15 text-[9px] uppercase tracking-[0.25em] text-aesop-ink/60">
          <span className="group-hover:text-aesop-ink transition-colors">TRACE</span>
        </div>
      </button>
    </motion.div>
  );
}
