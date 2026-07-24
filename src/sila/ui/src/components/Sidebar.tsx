import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Search, Focus } from "lucide-react";
import { SilaLogo } from "./SilaLogo";

type WorkspaceTab = "home" | "search" | "cull";

interface SidebarProps {
  workspace: WorkspaceTab;
  onNavigate: (ws: WorkspaceTab) => void;
  libraryCount?: number;
  cullQueueCount?: number;
}

const NAV_ITEMS = [
  {
    id: "home" as const,
    icon: LayoutGrid,
    label: "Library",
    sublabel: "Your archive",
    description: "Every captured moment, organized.",
  },
  {
    id: "search" as const,
    icon: Search,
    label: "Scout",
    sublabel: "Semantic search",
    description: "Describe a scene. Find the frame.",
  },
  {
    id: "cull" as const,
    icon: Focus,
    label: "Darkroom",
    sublabel: "Culling studio",
    description: "Keep what matters. Let go of the rest.",
  },
];

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = time.getHours().toString().padStart(2, "0");
  const m = time.getMinutes().toString().padStart(2, "0");
  return (
    <span className="tabular-nums">
      {h}:{m}
    </span>
  );
}

export function Sidebar({ workspace, onNavigate, libraryCount = 0, cullQueueCount = 0 }: SidebarProps) {
  const [hovered, setHovered] = useState(false);

  const activeItem = NAV_ITEMS.find((n) => n.id === workspace)!;

  return (
    <motion.aside
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={{ width: hovered ? 240 : 72 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      className="fixed left-0 top-0 h-full z-50 flex flex-col justify-between overflow-hidden shadow-[4px_0_24px_rgba(42,36,32,0.02)]"
      style={{
        background: "var(--color-aesop-paper)",
        borderRight: "1px solid rgba(42,36,32,0.08)",
      }}
    >
      {/* ── TOP WORDMARK ── */}
      <div className="relative h-24 shrink-0 flex items-center justify-center w-full mt-4">
        <AnimatePresence>
          {!hovered && (
            <motion.div
              key="collapsed-logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="absolute select-none flex items-center justify-center"
            >
              <SilaLogo size={22} className="text-aesop-ink/60" />
            </motion.div>
          )}
          {hovered && (
            <motion.div
              key="expanded-logo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
              className="absolute select-none flex flex-col items-center gap-1"
            >
              <SilaLogo size={22} className="text-aesop-ink/80" />
              <span className="text-[18px] italic text-aesop-ink/90 leading-none" style={{ fontFamily: "var(--font-aesop-serif)" }}>Sila</span>
              <span className="text-[8px] uppercase tracking-[0.4em] text-aesop-ink/40" style={{ fontFamily: "var(--font-aesop-sans)" }}>Vision</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── NAV ITEMS (CENTERED) ── */}
      <nav className="flex flex-col justify-center flex-1 w-full gap-2 px-4">
        {NAV_ITEMS.map(({ id, icon: Icon, label, sublabel }) => {
          const isActive = workspace === id;
          const count = id === "home" ? libraryCount : id === "cull" ? cullQueueCount : null;

          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.96 }}
              onClick={() => onNavigate(id)}
              className={`group relative flex items-center gap-4 w-full h-12 rounded-xl text-left
                transition-all duration-300 cursor-pointer overflow-hidden
                ${isActive
                  ? "text-aesop-ink bg-[var(--color-aesop-ink)]/5 shadow-inner"
                  : "text-aesop-ink/40 hover:text-aesop-ink/80 hover:bg-aesop-ink/5"
                }`}
            >
              {/* Active left accent pip (fixed to hug the left edge of the button properly) */}
              {isActive && (
                <motion.div
                  layoutId="nav-accent-pip"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-aesop-ink rounded-r-md"
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                />
              )}

              {/* Icon container */}
              <div className="relative z-10 shrink-0 w-[40px] flex items-center justify-center">
                <Icon
                  size={isActive ? 20 : 18}
                  strokeWidth={isActive ? 2 : 1.5}
                  className="transition-all duration-300 group-hover:scale-110"
                />
              </div>

              {/* Label + sublabel */}
              <div
                className={`relative z-10 flex flex-col min-w-0 overflow-hidden whitespace-nowrap transition-all duration-400 ease-[0.32,0.72,0,1]
                  ${hovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"}`}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-[12px] uppercase tracking-[0.15em] font-medium"
                    style={{ fontFamily: "var(--font-aesop-sans)" }}
                  >
                    {label}
                  </span>
                  {count !== null && count > 0 && (
                    <span
                      className="text-[9px] tabular-nums text-aesop-ink/50 bg-aesop-ink/5 px-1.5 rounded-md"
                      style={{ fontFamily: "var(--font-aesop-mono)" }}
                    >
                      {count}
                    </span>
                  )}
                </div>
                <span
                  className="text-[9px] text-aesop-ink/40 mt-0.5"
                  style={{ fontFamily: "var(--font-aesop-serif)", fontStyle: "italic" }}
                >
                  {sublabel}
                </span>
                {/* Nav pip right side (future use) */}
              </div>
            </motion.button>
          );
        })}
      </nav>

      {/* ── ⌘K SEARCH HINT ── */}
      <div className="shrink-0 flex items-center justify-center pb-2">
        <AnimatePresence mode="wait">
          {!hovered ? (
            <motion.div
              key="search-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-1"
              title="Press ⌘K to search from anywhere"
            >
              <kbd className="rounded border border-aesop-ink/12 bg-aesop-ink/5 px-1 py-0.5 font-mono text-[8px] text-aesop-ink/30">⌘K</kbd>
            </motion.div>
          ) : (
            <motion.div
              key="search-expanded"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.08 }}
              className="flex items-center gap-2 px-4"
            >
              <kbd className="rounded border border-aesop-ink/12 bg-aesop-ink/5 px-1.5 py-0.5 font-mono text-[9px] text-aesop-ink/40">⌘K</kbd>
              <span className="text-[8px] uppercase tracking-[0.2em] text-aesop-ink/30" style={{ fontFamily: "var(--font-aesop-sans)" }}>
                Search anywhere
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM STATUS ── */}
      <div className="h-20 shrink-0 border-t border-aesop-ink/5 flex items-center justify-center relative">
        <AnimatePresence>
          {!hovered && (
            <motion.div
              key="status-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            </motion.div>
          )}
          {hovered && (
            <motion.div
              key="status-expanded"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="absolute flex items-center gap-3 w-full px-6"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500/70 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
              <div className="flex flex-col">
                <span
                  className="text-[9px] uppercase tracking-[0.2em] text-aesop-ink/40"
                  style={{ fontFamily: "var(--font-aesop-sans)" }}
                >
                  Engine Live
                </span>
                <span
                  className="text-[10px] text-aesop-ink/60 mt-0.5"
                  style={{ fontFamily: "var(--font-aesop-mono)" }}
                >
                  <LiveClock />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
