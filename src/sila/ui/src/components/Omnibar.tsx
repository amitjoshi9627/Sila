/**
 * Omnibar.tsx — Enhancement #5
 * Hitting / opens a command palette-style floating glass overlay with
 * quick-action suggestions that animate in with a stagger.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft, X, LayoutGrid, Focus, Zap } from "lucide-react";
import { VoiceMic } from "./VoiceMic";

interface OmnibarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  onNavigate?: (workspace: "home" | "search" | "cull") => void;
  isSearching: boolean;
  initialQuery?: string;
  variant?: "inline" | "global-overlay";
}

const QUICK_ACTIONS = [
  { icon: Search, label: "Search for…", hint: "golden hour portraits", action: "search" as const },
  { icon: Search, label: "Search for…", hint: "mountain roads at sunset", action: "search" as const },
  { icon: Search, label: "Search for…", hint: "shallow depth of field", action: "search" as const },
  { icon: LayoutGrid, label: "Go to Library", hint: "Browse all indexed media", action: "home" as const },
  { icon: Focus, label: "Open Darkroom", hint: "Cull and rate your shots", action: "cull" as const },
];

export function Omnibar({ onSearch, onClear, onNavigate, isSearching, initialQuery = "", variant = "inline" }: OmnibarProps) {
  const [value, setValue] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K / "/" shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        setTimeout(() => inputRef.current?.focus(), 60);
      }
      if (e.key === "/" && document.activeElement !== inputRef.current && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
        setTimeout(() => inputRef.current?.focus(), 60);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        inputRef.current?.blur();
      }
    }
    
    function handleCustomOpen() {
      setPaletteOpen(true);
      setTimeout(() => inputRef.current?.focus(), 60);
    }

    window.addEventListener("keydown", handleKey);
    window.addEventListener("open-omnibar", handleCustomOpen);
    
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("open-omnibar", handleCustomOpen);
    };
  }, [paletteOpen]);

  useEffect(() => { setValue(initialQuery); }, [initialQuery]);

  // Close palette on outside click
  useEffect(() => {
    if (!paletteOpen) return;
    function onClick(e: MouseEvent) {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [paletteOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) { onClear(); return; }
    onSearch(q);
    setPaletteOpen(false);
    inputRef.current?.blur();
  }

  function handleClear() {
    setValue("");
    onClear();
    inputRef.current?.focus();
  }

  function handleQuickAction(action: typeof QUICK_ACTIONS[0]) {
    if (action.action === "search") {
      const query = action.hint;
      setValue(query);
      onSearch(query);
      setPaletteOpen(false);
    } else if (action.action === "home" || action.action === "cull") {
      onNavigate?.(action.action);
      setPaletteOpen(false);
    }
  }

  // ── Inline (non-palette) form ──────────────────────────────────────────────
  return (
    <>
      {variant !== "global-overlay" && (
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mx-auto w-full max-w-2xl"
        >
        <div
          className={[
            "group relative flex items-center gap-3 border-b pb-2 transition-colors duration-300 ease-out",
            focused ? "border-aesop-ink/60" : "border-aesop-ink/30 hover:border-aesop-ink/50",
          ].join(" ")}
        >
          <Search
            className={`h-4 w-4 shrink-0 transition-colors duration-300 ${
              focused ? "text-aesop-ink" : "text-aesop-ink/50"
            }`}
            strokeWidth={1.5}
          />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              setValue(val);
              if (!val.trim()) onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { handleClear(); inputRef.current?.blur(); }
            }}
            onFocus={() => { setFocused(true); }}
            onBlur={() => setFocused(false)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="consult the index…"
            className="flex-1 bg-transparent text-[16px] italic text-aesop-ink placeholder:text-aesop-ink/40 focus:outline-none"
            style={{ fontFamily: "var(--font-aesop-serif)" }}
          />

          {/* Voice mic button — always visible */}
          <VoiceMic
            onTranscript={(text) => {
              setValue(text);
              onSearch(text);
            }}
          />

          <AnimatePresence mode="wait">
            {value ? (
              <motion.button
                key="clear"
                type="button"
                onClick={handleClear}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="flex h-6 w-6 items-center justify-center rounded-md text-aesop-ink/40 transition-colors hover:bg-aesop-ink/5 hover:text-aesop-ink cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </motion.button>
            ) : (
              <motion.button
                key="palette-hint"
                type="button"
                onClick={() => { setPaletteOpen(true); setTimeout(() => inputRef.current?.focus(), 60); }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden items-center gap-1 sm:flex cursor-pointer"
              >
                <kbd className="rounded-sm border border-aesop-ink/15 bg-aesop-ink/5 px-1.5 py-0.5 font-mono text-[10px] font-medium text-aesop-ink/60">⌘</kbd>
                <kbd className="rounded-sm border border-aesop-ink/15 bg-aesop-ink/5 px-1.5 py-0.5 font-mono text-[10px] font-medium text-aesop-ink/60">K</kbd>
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isSearching && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1 absolute right-12"
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1 w-1 rounded-full bg-aesop-ink/40"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-aesop-ink/40" style={{ fontFamily: "var(--font-aesop-sans)" }}>
          <span className="flex items-center gap-1 uppercase tracking-[0.2em] text-[9px]">
            <CornerDownLeft className="h-3 w-3" /> search
          </span>
          <span>·</span>
          <span className="uppercase tracking-[0.2em] text-[9px]">
            press{" "}
            <kbd
              className="font-mono text-aesop-ink/50 lowercase cursor-pointer hover:text-aesop-ink/80 transition-colors"
              onClick={() => { setPaletteOpen(true); setTimeout(() => inputRef.current?.focus(), 60); }}
            >
              /
            </kbd>{" "}
            for commands
          </span>
        </div>
      </motion.form>
      )}

      {/* ── COMMAND PALETTE OVERLAY (Enhancement #5) ── */}
      <AnimatePresence>
        {paletteOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 bg-aesop-ink/20 command-palette-backdrop"
              onClick={() => setPaletteOpen(false)}
            />

            {/* Panel */}
            <motion.div
              ref={paletteRef}
              initial={{ opacity: 0, scale: 0.97, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ type: "spring", damping: 26, stiffness: 340 }}
              className="fixed z-50 left-1/2 top-[15vh] -translate-x-1/2 w-full max-w-xl overflow-hidden border border-aesop-ink/12 bg-aesop-paper/95 shadow-[0_32px_80px_-16px_rgba(42,36,32,0.25)]"
              style={{ backdropFilter: "blur(24px)" }}
            >
              {/* Input row */}
              <form onSubmit={handleSubmit} className="flex items-center gap-3 px-5 py-4 border-b border-aesop-ink/8">
                <Search className="h-4 w-4 shrink-0 text-aesop-ink/60" strokeWidth={1.5} />
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Search scenes, navigate…"
                  autoFocus
                  className="flex-1 bg-transparent text-[15px] italic text-aesop-ink placeholder:text-aesop-ink/35 focus:outline-none"
                  style={{ fontFamily: "var(--font-aesop-serif)" }}
                />
                {value && (
                  <button
                    type="button"
                    onClick={() => setValue("")}
                    className="text-aesop-ink/40 hover:text-aesop-ink cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </form>

              {/* Suggestion list */}
              <div className="py-2">
                <p className="px-5 py-2 text-[8px] uppercase tracking-[0.3em] text-aesop-ink/30 font-mono">
                  Quick Actions
                </p>
                {QUICK_ACTIONS.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.045, duration: 0.2 }}
                      onClick={() => handleQuickAction(action)}
                      className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-aesop-ink/[0.05] transition-colors cursor-pointer group"
                    >
                      <div className="flex-none w-7 h-7 rounded-md border border-aesop-ink/10 bg-aesop-ink/[0.04] flex items-center justify-center group-hover:border-aesop-ink/20 transition-colors">
                        <Icon size={13} className="text-aesop-ink/60" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-aesop-ink/80 uppercase tracking-[0.15em]">
                          {action.label}
                        </p>
                        <p className="text-[10px] text-aesop-ink/40 italic mt-0.5" style={{ fontFamily: "var(--font-aesop-serif)" }}>
                          {action.hint}
                        </p>
                      </div>
                      <Zap size={9} className="ml-auto text-aesop-ink/0 group-hover:text-aesop-ink/30 transition-colors" />
                    </motion.button>
                  );
                })}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-3 px-5 py-3 border-t border-aesop-ink/8 bg-aesop-ink/[0.02]">
                <kbd className="rounded border border-aesop-ink/12 bg-aesop-ink/5 px-1.5 py-0.5 font-mono text-[9px] text-aesop-ink/40">↵</kbd>
                <span className="text-[9px] uppercase tracking-[0.2em] text-aesop-ink/30">confirm</span>
                <kbd className="rounded border border-aesop-ink/12 bg-aesop-ink/5 px-1.5 py-0.5 font-mono text-[9px] text-aesop-ink/40">esc</kbd>
                <span className="text-[9px] uppercase tracking-[0.2em] text-aesop-ink/30">dismiss</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
