import { motion } from "framer-motion";

interface EmptyStateProps {
  query?: string;
}

function ViewfinderSVG() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-12 w-12 text-[--color-aesop-ink] opacity-40 sila-breathe"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Outer frame */}
      <rect x="15" y="25" width="70" height="50" rx="4" />
      {/* Viewfinder brackets */}
      <path d="M 30 40 L 30 35 L 35 35" />
      <path d="M 70 40 L 70 35 L 65 35" />
      <path d="M 30 60 L 30 65 L 35 65" />
      <path d="M 70 60 L 70 65 L 65 65" />
      {/* Center dot */}
      <circle cx="50" cy="50" r="1.5" fill="currentColor" />
    </svg>
  );
}

function SearchRingsSVG() {
  return (
    <div className="relative h-12 w-12 flex items-center justify-center text-[--color-aesop-ink] opacity-40">
      <div className="absolute inset-0 border border-current rounded-full sila-ring-pulse" />
      <div className="absolute inset-2 border border-current rounded-full sila-ring-pulse" style={{ animationDelay: "1s" }} />
      <div className="absolute inset-4 border border-current rounded-full sila-ring-pulse" style={{ animationDelay: "2s" }} />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 relative z-10">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </div>
  );
}

export function EmptyState({ query }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-[--color-aesop-ink]/10 bg-[--color-aesop-paper]/60 backdrop-blur-sm px-6 py-24 text-center mt-10"
    >
      <div className="mb-6 flex items-center justify-center">
        {query ? <SearchRingsSVG /> : <ViewfinderSVG />}
      </div>
      <h3 className="text-[15px] tracking-tight text-[--color-aesop-ink]/90" style={{ fontFamily: "var(--font-aesop-serif)" }}>
        {query ? "No moments found" : "Your archive is quiet"}
      </h3>
      <p className="mt-2 max-w-sm text-[11px] uppercase tracking-widest leading-relaxed text-[--color-aesop-ink]/40">
        {query ? (
          <>
            Nothing matches <span className="font-mono text-[--color-aesop-ink]/60">“{query}”</span> in your archive.
          </>
        ) : (
          <>
            Once Sila indexes media from your local volumes, they'll appear here.
          </>
        )}
      </p>
    </motion.div>
  );
}
