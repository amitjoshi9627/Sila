import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Activity, Cpu } from "lucide-react";
import { fetchTelemetry } from "../lib/api";
import type { TelemetryRecord, TelemetryStats, ActiveSearchTelemetry } from "../types";

interface TelemetryDeckProps {
  isOpen: boolean;
  onClose: () => void;
  activeTelemetry?: ActiveSearchTelemetry | null;
}
export function TelemetryDeck({ isOpen, onClose, activeTelemetry }: TelemetryDeckProps) {
  const [records, setRecords] = useState<TelemetryRecord[]>([]);
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    duration_ms: number;
    time: string;
  } | null>(null);
  const [friendlyNames, setFriendlyNames] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Live Search": true,
    "Offline Processing": false
  });

  const loadData = async () => {
    try {
      const data = await fetchTelemetry(150);
      setRecords(data.recent);
      setStats(data.stats);
      if (data.friendly_names) setFriendlyNames(data.friendly_names);
    } catch (err) {
      console.error("Failed to load telemetry stats", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTelemetry?.timestamp]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const activeLatency = activeTelemetry?.latencyMs || 0;

  const { breakdownOnline, breakdownOffline, onlineHistoricalMs, offlineHistoricalMs, totalSearchQueries } = useMemo(() => {
    if (!stats || !stats.by_operation || Object.keys(stats.by_operation).length === 0) {
      return { breakdownOnline: [], breakdownOffline: [], onlineHistoricalMs: 0, offlineHistoricalMs: 0, totalSearchQueries: 0 };
    }

    const EXCLUDED_OPS = [
      "Hybrid Search (Total)",
      "track_hybrid_search",
      "sqlite_lexical_search",
      "track_vector_search",
      "track_online_hybrid_search",
      "track_online_whisper_stt"
    ];

    const groupedOps: Record<string, { total_ms: number, count: number, isOffline: boolean }> = {};

    Object.entries(stats.by_operation).forEach(([opName, stat]) => {
      if (EXCLUDED_OPS.includes(opName)) return;
      const displayName = friendlyNames[opName] || opName;
      if (!groupedOps[displayName]) {
        groupedOps[displayName] = { total_ms: 0, count: 0, isOffline: opName.includes("track_offline") };
      }
      groupedOps[displayName].total_ms += stat.avg_ms * stat.count;
      groupedOps[displayName].count += stat.count;
    });

    const combinedOps = Object.entries(groupedOps).map(([label, data]) => ({
      label,
      avg_ms: data.count > 0 ? data.total_ms / data.count : 0,
      count: data.count,
      isOffline: data.isOffline,
    }));

    const colors = ["#B37A52", "#4B948C", "#77639F", "#2B794A", "#9E4828", "#5C7E5F"];

    const onlineOps = combinedOps.filter(o => !o.isOffline);
    const offlineOps = combinedOps.filter(o => o.isOffline);

    const onlineHistoricalMs = onlineOps.reduce((sum, op) => sum + op.avg_ms, 0);
    const offlineHistoricalMs = offlineOps.reduce((sum, op) => sum + op.avg_ms, 0);

    const targetOnlineMs = activeLatency > 0 ? activeLatency : onlineHistoricalMs;

    const breakdownOnline = onlineOps.map((op, idx) => {
      const ratio = onlineHistoricalMs > 0 ? op.avg_ms / onlineHistoricalMs : 0;
      return {
        label: op.label,
        sub: `${op.count} queries logged`,
        pct: ratio * 100,
        ms: targetOnlineMs * ratio,
        color: colors[idx % colors.length],
        isOffline: false,
      };
    });

    const breakdownOffline = offlineOps.map((op, idx) => {
      const ratio = offlineHistoricalMs > 0 ? op.avg_ms / offlineHistoricalMs : 0;
      return {
        label: op.label,
        sub: `${op.count} queries logged`,
        pct: ratio * 100,
        ms: offlineHistoricalMs * ratio,
        color: colors[(idx + onlineOps.length) % colors.length],
        isOffline: true,
      };
    });

    const parentOp1 = stats.by_operation["Hybrid Search (Total)"];
    const parentOp2 = stats.by_operation["track_hybrid_search"];
    const parentOp3 = stats.by_operation["track_online_hybrid_search"];
    const totalSearchQueries = (parentOp1?.count || 0) + (parentOp2?.count || 0) + (parentOp3?.count || 0);

    return { 
      breakdownOnline, 
      breakdownOffline, 
      onlineHistoricalMs, 
      offlineHistoricalMs,
      totalSearchQueries 
    };
  }, [stats, activeLatency, friendlyNames]);



  const searchRecords = useMemo(() => {
    return records.filter(
      (r) => r.operation_name === "Hybrid Search (Total)" || r.operation_name === "track_hybrid_search" || r.operation_name === "track_online_hybrid_search"
    );
  }, [records]);

  // SVG path generation for the latency ledger
  const { chartPoints, maxMs, searchAvgMs, searchMinMs, searchMaxMs } = useMemo(() => {
    if (searchRecords.length === 0) return { chartPoints: [], maxMs: 60, searchAvgMs: 0, searchMinMs: 0, searchMaxMs: 0 };

    // Reverse to show oldest to newest (left to right)
    const chartData = [...searchRecords].reverse();

    const durations = chartData.map(r => r.duration_ms);
    const maxMs = Math.max(...durations, 60);
    const searchAvgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    const searchMinMs = Math.min(...durations);
    const searchMaxMs = Math.max(...durations);

    const w = 1000;
    const h = 60;
    const MAX_GRAPH_POINTS = 50;
    const step = w / (MAX_GRAPH_POINTS - 1);

    const points = chartData.map((r, i) => {
      const timeStr = new Date(r.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const pointIndexFromRight = chartData.length - 1 - i;
      return {
        x: w - (pointIndexFromRight * step),
        y: h - (Math.min(r.duration_ms / maxMs, 1) * (h - 10)),
        duration_ms: r.duration_ms,
        time: timeStr
      };
    });

    return { chartPoints: points, maxMs, searchAvgMs, searchMinMs, searchMaxMs };
  }, [searchRecords]);

  const avgY = useMemo(() => {
    return 60 - (Math.min(searchAvgMs / maxMs, 1) * 50);
  }, [searchAvgMs, maxMs]);

  const areaPath = chartPoints.length > 0
    ? `M ${chartPoints[0].x} 60 ${chartPoints.map(p => `L ${p.x} ${p.y}`).join(" ")} L ${chartPoints[chartPoints.length - 1].x} 60 Z`
    : "";

  const linePath = chartPoints.length > 0
    ? `M ${chartPoints[0].x} ${chartPoints[0].y} ${chartPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")}`
    : "";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-aesop-ink/20 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 5 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-10 w-full max-w-[960px] overflow-hidden rounded-xl border border-aesop-ink/10 bg-aesop-paper shadow-[0_32px_80px_-12px_rgba(42,36,32,0.15)] flex flex-col"
            style={{ fontFamily: "var(--font-aesop-sans)" }}
          >
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-aesop-ink/10">
              <div className="flex items-center gap-4">
                <Activity size={14} className="text-[#B37A52]" strokeWidth={2} />
                <span className="text-[11px] uppercase tracking-[0.25em] text-aesop-ink/80 font-semibold">
                  RETRIEVAL TRACE
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5EAD7] px-2 py-0.5 text-[9px] font-bold tracking-widest text-[#5C7E5F] uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#5C7E5F]" />
                  LIVE
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-aesop-ink/40 hover:text-aesop-ink transition-colors cursor-pointer"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* ── BODY ── */}
            <div className="flex flex-col md:flex-row">
              {/* Left Column: Waterfall & Chart */}
              <div className="flex-1 p-6 md:p-8 flex flex-col justify-between border-r border-aesop-ink/10">
                
                {/* Waterfall Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="bg-[#E4DBCB] text-[#8F8171] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.2em] uppercase rounded-sm">
                      LIVE SEARCH WATERFALL
                    </span>
                    <span className="text-[#8F8171] text-[9px] tracking-widest uppercase">
                      wall {(activeLatency || onlineHistoricalMs).toFixed(1)}ms
                    </span>
                  </div>

                  {/* Online Execution Breakdown Stacked Bar */}
                  <div className="flex h-6 w-full gap-1 mb-6 rounded-full bg-[#E4DBCB]/60 p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] relative overflow-hidden">
                    {/* Shimmer Sweep Animation */}
                    <motion.div
                      initial={{ x: "-100%" }}
                      animate={{ x: "300%" }}
                      transition={{ duration: 1.5, ease: "linear", delay: 0.2 }}
                      className="absolute inset-0 z-20 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none mix-blend-overlay"
                    />

                    {breakdownOnline.map((stage, idx) => {
                      const previousTotalPct = breakdownOnline.slice(0, idx).reduce((sum, item) => sum + Math.max(1, item.pct), 0);
                      const delay = previousTotalPct * 0.012; 

                      return (
                        <motion.div
                          key={stage.label}
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: `${Math.max(1, stage.pct)}%`, opacity: 1 }}
                          whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                          transition={{ width: { duration: Math.max(1, stage.pct) * 0.015, ease: "easeOut", delay }, opacity: { duration: 0.2, delay } }}
                          className={`relative h-full cursor-pointer group ${idx === 0 ? "rounded-l-full" : "rounded-l-[2px]"} ${idx === breakdownOnline.length - 1 ? "rounded-r-full" : "rounded-r-[2px]"} border-t border-white/40 overflow-visible`}
                          style={{ 
                            backgroundColor: stage.color,
                            boxShadow: `0 4px 12px ${stage.color}40, inset 0 2px 4px rgba(255,255,255,0.2)`
                          }}
                        >
                          {/* Frosted Glass Tooltip */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out flex flex-col items-center z-50">
                            <div className="rounded-xl bg-aesop-ink/80 backdrop-blur-2xl text-aesop-paper text-[10px] px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col items-center whitespace-normal max-w-[200px] break-words text-center leading-tight border border-white/10">
                              <span className="font-bold tracking-wide">{stage.label}</span>
                              <span className="text-[10px] opacity-90 mt-1 font-mono whitespace-nowrap">{stage.ms.toFixed(1)} ms <span className="opacity-60 ml-1">({stage.pct.toFixed(0)}%)</span></span>
                            </div>
                            <div className="w-2 h-2 bg-aesop-ink/80 backdrop-blur-2xl rotate-45 -mt-[4px] border-b border-r border-white/10" />
                          </div>
                        </motion.div>
                      );
                    })}
                    {breakdownOnline.length === 0 && (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-[#8F8171] z-30">
                        Awaiting query telemetry...
                      </div>
                    )}
                  </div>

                  {/* Breakdown Accordions */}
                  <div className="flex flex-col gap-4">
                    {[
                      {
                        title: "Live Search Queries",
                        key: "Live Search",
                        items: breakdownOnline
                      },
                      {
                        title: "Offline Background Jobs",
                        key: "Offline Processing",
                        items: breakdownOffline
                      }
                    ].map((group) => {
                      if (group.items.length === 0) return null;
                      const isExpanded = expandedGroups[group.key];
                      const totalMs = group.items.reduce((sum, item) => sum + item.ms, 0);

                      return (
                        <div key={group.key} className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                            className="flex items-center justify-between py-2 border-b border-aesop-ink/10 cursor-pointer hover:bg-aesop-ink/[0.02] transition-colors rounded-sm px-1 mb-2"
                          >
                            <span className="text-[10px] font-bold text-aesop-ink/70 uppercase tracking-widest">{group.title}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-aesop-ink/50">{totalMs.toFixed(1)}ms</span>
                              <span className="text-aesop-ink/40 text-[10px]">{isExpanded ? "▼" : "▶"}</span>
                            </div>
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                {group.key === "Offline Processing" && (
                                  <div className="flex h-4 w-full gap-1 mt-2 mb-4 rounded-full bg-[#E4DBCB]/60 p-[3px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] relative overflow-hidden">
                                    {/* Shimmer Sweep Animation */}
                                    <motion.div
                                      initial={{ x: "-100%" }}
                                      animate={{ x: "300%" }}
                                      transition={{ duration: 1.5, ease: "linear", delay: 0.2 }}
                                      className="absolute inset-0 z-20 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none mix-blend-overlay"
                                    />
                                    {group.items.map((stage, idx) => {
                                      const previousTotalPct = group.items.slice(0, idx).reduce((sum, item) => sum + Math.max(1, item.pct), 0);
                                      const delay = previousTotalPct * 0.012;
                                      
                                      return (
                                        <motion.div
                                          key={stage.label}
                                          initial={{ width: 0, opacity: 0 }}
                                          animate={{ width: `${Math.max(1, stage.pct)}%`, opacity: 1 }}
                                          whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                                          transition={{ width: { duration: Math.max(1, stage.pct) * 0.015, ease: "easeOut", delay }, opacity: { duration: 0.2, delay } }}
                                          className={`relative h-full cursor-pointer group ${idx === 0 ? "rounded-l-full" : "rounded-l-[2px]"} ${idx === group.items.length - 1 ? "rounded-r-full" : "rounded-r-[2px]"} border-t border-white/40 overflow-visible`}
                                          style={{ 
                                            backgroundColor: stage.color,
                                            boxShadow: `0 2px 8px ${stage.color}30, inset 0 2px 4px rgba(255,255,255,0.2)`
                                          }}
                                        >
                                          {/* Frosted Glass Tooltip */}
                                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out flex flex-col items-center z-50">
                                            <div className="rounded-xl bg-aesop-ink/80 backdrop-blur-2xl text-aesop-paper text-[10px] px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col items-center whitespace-normal max-w-[200px] break-words text-center leading-tight border border-white/10">
                                              <span className="font-bold tracking-wide">{stage.label}</span>
                                              <span className="text-[10px] opacity-90 mt-1 font-mono whitespace-nowrap">{stage.ms.toFixed(1)} ms <span className="opacity-60 ml-1">({stage.pct.toFixed(0)}%)</span></span>
                                            </div>
                                            <div className="w-2 h-2 bg-aesop-ink/80 backdrop-blur-2xl rotate-45 -mt-[4px] border-b border-r border-white/10" />
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-1 pb-2">
                                  {group.items.map((stage, idx) => (
                                    <motion.div
                                      key={stage.label}
                                      initial={{ opacity: 0, y: 4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ duration: 0.3, delay: idx * 0.02 }}
                                      className="flex gap-2.5 bg-[#E4DBCB]/30 p-2 rounded-sm border border-[#E4DBCB]"
                                    >
                                      <div className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                                      <div className="flex-1 flex flex-col justify-center">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[10px] font-bold text-aesop-ink/80 leading-tight truncate">{stage.label}</span>
                                          <span className="text-[10px] font-bold text-aesop-ink/80 shrink-0">{stage.ms.toFixed(1)}ms</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                          <span className="text-[9px] text-aesop-ink/50 tracking-wide">{stage.sub}</span>
                                          <span className="text-[9px] text-[#B37A52] font-bold tracking-widest">{stage.pct.toFixed(0)}%</span>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ledger / Area Chart */}
                <div className="mt-12">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#8F8171]">
                      LIVE SEARCH LEDGER · LAST {searchRecords.length} QUERIES
                    </span>
                    <span className="text-[9px] tracking-widest text-[#8F8171]">
                      <span className="text-[#9E4828] border-b border-dashed border-[#9E4828] mr-2">--- avg {searchAvgMs ? `${searchAvgMs.toFixed(1)}ms` : "0ms"}</span>
                      newest →
                    </span>
                  </div>

                  <div className="relative h-[60px] w-full mt-2">
                    {/* Chart SVG */}
                    <svg viewBox="0 0 1000 60" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#B37A52" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#B37A52" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Threshold Line (AVG) */}
                      {stats && stats.average_ms > 0 && (
                        <line
                          x1="0"
                          y1={avgY}
                          x2="1000"
                          y2={avgY}
                          stroke="#9E4828"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                          opacity="0.4"
                        />
                      )}

                      {/* Area Fill */}
                      <motion.path
                        d={areaPath}
                        fill="url(#areaGlow)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15, duration: 0.75 }}
                      />

                      {/* Line Stroke */}
                      <motion.path
                        d={linePath}
                        fill="none"
                        stroke="#B37A52"
                        strokeWidth="1.5"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                      />

                      {/* Interactive hover points */}
                      {chartPoints.map((p, i) => (
                        <g
                          key={i}
                          onMouseEnter={() => setHoveredPoint(p)}
                          onMouseLeave={() => setHoveredPoint(null)}
                          className="group/point"
                        >
                          {/* Invisible hover target */}
                          <circle cx={p.x} cy={p.y} r={10} fill="transparent" className="cursor-pointer" />
                          {/* Visible point circle */}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={3.5}
                            fill="#B37A52"
                            className="opacity-0 group-hover/point:opacity-100 transition-opacity"
                          />
                        </g>
                      ))}
                    </svg>

                    {/* Floating Tooltip outside SVG to prevent stretch distortion */}
                    <AnimatePresence>
                      {hoveredPoint && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute bg-aesop-ink text-aesop-paper text-[10px] px-2.5 py-1.5 rounded shadow-lg pointer-events-none z-30 flex flex-col items-center"
                          style={{
                            left: `${(hoveredPoint.x / 1000) * 100}%`,
                            top: `${(hoveredPoint.y / 60) * 100}%`,
                            transform: "translate(-50%, -125%)",
                          }}
                        >
                          <span className="font-bold whitespace-nowrap">{hoveredPoint.duration_ms.toFixed(1)} ms</span>
                          <span className="opacity-80 text-[7.5px] whitespace-nowrap mt-0.5 font-mono">{hoveredPoint.time}</span>
                          {/* Triangle arrow */}
                          <div className="w-1.5 h-1.5 bg-aesop-ink rotate-45 mt-[3px] -mb-1" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

              </div>

              {/* Right Sidebar: Wall Clock & Stats */}
              <div className="w-full md:w-[280px] p-6 md:p-8 flex flex-col">
                <span className="bg-[#E4DBCB] text-[#8F8171] px-1.5 py-0.5 text-[9px] font-bold tracking-[0.2em] uppercase rounded-sm inline-block w-fit mb-3">
                  WALL CLOCK
                </span>

                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-[52px] font-light leading-none tracking-tight text-aesop-ink" style={{ fontFamily: "var(--font-aesop-serif)" }}>
                    {activeLatency > 0 ? activeLatency.toFixed(1) : onlineHistoricalMs.toFixed(1)}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-aesop-ink/60">
                    MS
                  </span>
                </div>
                <p className="text-[10px] text-aesop-ink/50 mt-3 font-medium tracking-wide">
                  {activeTelemetry ? (
                    `${activeTelemetry.count} results · ${activeTelemetry.query.length} chars`
                  ) : (
                    "No active search session"
                  )}
                </p>

                <div className="border-t border-aesop-ink/10 my-6" />

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-x-4 mb-auto">
                  <div>
                    <p className="text-[9px] tracking-widest text-[#8F8171] uppercase mb-1">MIN</p>
                    <p className="text-[14px] font-bold text-aesop-ink">
                      {searchMinMs ? searchMinMs.toFixed(1) : "0.0"}<span className="text-[9px] text-[#8F8171] ml-0.5">MS</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[#8F8171] text-[9px] tracking-widest uppercase mb-1">AVG</p>
                    <p className="text-[14px] font-bold text-aesop-ink">
                      {searchAvgMs ? searchAvgMs.toFixed(1) : "0.0"}<span className="text-[9px] text-[#8F8171] ml-0.5">MS</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] tracking-widest text-[#8F8171] uppercase mb-1">MAX</p>
                    <p className="text-[14px] font-bold text-aesop-ink">
                      {searchMaxMs ? searchMaxMs.toFixed(1) : "0.0"}<span className="text-[9px] text-[#8F8171] ml-0.5">MS</span>
                    </p>
                  </div>
                </div>

                {/* Model Info Badge */}
                <div className="mt-8 rounded-md border border-aesop-ink/10 bg-[#E4DBCB]/20 p-3 flex gap-2 items-start">
                  <Cpu size={12} className="text-[#8F8171] mt-0.5 shrink-0" />
                  <p className="text-[10px] leading-relaxed text-[#8F8171] font-bold tracking-wide font-mono">
                    Sila Hybrid Engine · Metal · {totalSearchQueries} searches logged
                  </p>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
