import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, HelpCircle, CheckCircle, X, AlertTriangle } from "lucide-react";

export type DialogConfig = {
  isOpen: boolean;
  type: "alert" | "prompt" | "confirm";
  title: string;
  message?: string;
  defaultValue?: string;
  onConfirm?: (val?: string) => void;
  onCancel?: () => void;
};

export function CustomDialog({ config }: { config: DialogConfig }) {
  const [inputValue, setInputValue] = useState(config.defaultValue || "");

  useEffect(() => {
    if (config.isOpen) setInputValue(config.defaultValue || "");
  }, [config.isOpen, config.defaultValue]);

  if (!config.isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    config.onConfirm?.(config.type === "prompt" ? inputValue : undefined);
  };

  const getIcon = () => {
    if (config.type === "confirm") return <AlertTriangle size={18} className="text-red-700/70" />;
    if (config.type === "prompt") return <HelpCircle size={18} className="text-aesop-ink/70" />;
    if (config.title.toLowerCase().includes("success")) return <CheckCircle size={18} className="text-emerald-700/70" />;
    return <AlertCircle size={18} className="text-aesop-ink/70" />;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-aesop-ink/60 backdrop-blur-md"
        onClick={config.onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-[420px] bg-aesop-paper border border-aesop-ink/10 shadow-2xl p-7 flex flex-col gap-6"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getIcon()}
            <h3 className="font-bold text-[11px] tracking-[0.25em] uppercase text-aesop-ink">{config.title}</h3>
          </div>
          <button onClick={config.onCancel} className="text-aesop-ink/30 hover:text-aesop-ink transition-colors cursor-pointer">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {config.message && (
          <p className="text-[13px] text-aesop-ink/70 leading-relaxed" style={{ fontFamily: "var(--font-aesop-serif)" }}>
            {config.message}
          </p>
        )}

        {config.type === "prompt" && (
          <form onSubmit={handleSubmit} className="flex flex-col">
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full bg-transparent border-b border-aesop-ink/20 px-0 py-2 text-aesop-ink focus:border-aesop-ink focus:outline-none transition-colors text-sm font-mono placeholder:text-aesop-ink/20"
              placeholder="Type here..."
            />
          </form>
        )}

        <div className="flex justify-end gap-4 mt-2">
          {config.type !== "alert" && (
            <button
              onClick={config.onCancel}
              className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-aesop-ink/40 hover:text-aesop-ink transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            className={`px-5 py-2 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors cursor-pointer ${
              config.type === "confirm" 
                ? "bg-red-700 text-white hover:bg-red-800"
                : "bg-aesop-ink text-aesop-paper hover:bg-aesop-ink/80"
            }`}
          >
            {config.type === "alert" ? "Dismiss" : config.type === "prompt" ? "Submit" : "Confirm"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
