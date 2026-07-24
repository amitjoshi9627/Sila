import { motion } from "framer-motion";
import { Dot } from "lucide-react";
import { SilaLogo } from "./SilaLogo";

interface HeaderProps {
  count: number;
  isLoading: boolean;
  isMock: boolean;
  onLogoClick?: () => void;
}

export function Header({ count, isLoading, isMock, onLogoClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[--color-aesop-ink]/15 bg-[--color-aesop-paper]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-8">
        {/* Logo */}
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-75 transition-opacity"
        >
          <SilaLogo size={20} className="text-aesop-ink/80" />
          <span
            className="text-[14px] italic text-[--color-aesop-ink]"
            style={{ fontFamily: "var(--font-aesop-serif)" }}
          >
            Sila
          </span>
          <span
            className="text-[9px] uppercase tracking-[0.3em] text-[--color-aesop-ink]/50 ml-1"
            style={{ fontFamily: "var(--font-aesop-sans)" }}
          >
            local-first
          </span>
        </button>

        {/* Right side: status + count */}
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[--color-aesop-ink]/50 sm:flex"
            style={{ fontFamily: "var(--font-aesop-sans)" }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isMock ? "bg-amber-700/50" : "bg-[--color-aesop-ink]/30"
              }`}
            />
            <span>{isMock ? "preview" : "localhost"}</span>
          </motion.div>

          <Dot className="hidden h-3 w-3 text-[--color-aesop-ink]/20 sm:block" />

          <div
            className="flex items-baseline gap-1.5 text-[10px] uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--font-aesop-sans)" }}
          >
            <span className="text-[--color-aesop-ink]/70 tabular-nums">
              {isLoading ? "—" : count.toLocaleString()}
            </span>
            <span className="text-[--color-aesop-ink]/40">assets</span>
          </div>
        </div>
      </div>
    </header>
  );
}
