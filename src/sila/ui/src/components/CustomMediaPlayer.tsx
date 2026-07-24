import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Gauge,
  Sparkles,
  Eye,
  Grid,
} from "lucide-react";
import type { Capsule } from "../types";

interface CustomMediaPlayerProps {
  mediaType: "video" | "photo";
  src: string;
  coverSrc?: string;
  filename: string;
  capsules?: Capsule[];
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function CustomMediaPlayer({
  mediaType,
  src,
  coverSrc,
  filename,
  capsules = [],
  videoRef: externalVideoRef,
}: CustomMediaPlayerProps) {
  if (mediaType === "video") {
    return (
      <CustomVideoPlayer
        src={src}
        coverSrc={coverSrc}
        filename={filename}
        capsules={capsules}
        videoRef={externalVideoRef}
      />
    );
  }
  return <CustomImageViewer src={src} coverSrc={coverSrc} filename={filename} />;
}

/* ============================================================================
   1. CUSTOM VIDEO PLAYER
   ============================================================================ */

function CustomVideoPlayer({
  src,
  coverSrc,
  filename,
  capsules = [],
  videoRef: externalVideoRef,
}: {
  src: string;
  coverSrc?: string;
  filename: string;
  capsules?: Capsule[];
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalVideoRef || internalRef;
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2600);
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [videoRef]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeekHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * rect.width);
    setHoverTime(pos * duration);
  };

  const skipSeconds = (sec: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(duration, videoRef.current.currentTime + sec)
    );
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMute = !isMuted;
    videoRef.current.muted = newMute;
    setIsMuted(newMute);
  };

  const handleVolumeChange = (v: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = v;
    setVolume(v);
    if (v === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const handleRateChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Sync state with HTML video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoRef]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        skipSeconds(-5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        skipSeconds(5);
      } else if (e.code === "KeyM") {
        toggleMute();
      } else if (e.code === "KeyF") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden group select-none rounded-lg shadow-2xl ring-1 ring-white/10"
    >
      <video
        ref={videoRef}
        src={src}
        poster={coverSrc}
        autoPlay
        playsInline
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer outline-none"
      />

      {/* Play/Pause Overlay Flash on Click */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.2 }}
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/25 cursor-pointer pointer-events-auto"
          >
            <div className="w-16 h-16 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-md shadow-2xl transition-transform hover:scale-110">
              <Play size={24} fill="white" className="text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Controls Bar */}
      <AnimatePresence>
        {(showControls || !isPlaying) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-x-0 bottom-0 z-30 flex flex-col p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent backdrop-blur-md pt-8"
          >
            {/* ── Scrubber Track ── */}
            <div
              className="relative w-full h-4 flex items-center cursor-pointer group/scrub"
              onClick={handleSeek}
              onMouseMove={handleSeekHover}
              onMouseLeave={() => setHoverTime(null)}
            >
              {/* Background Track */}
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden group-hover/scrub:h-1.5 transition-all">
                <div
                  className="h-full bg-amber-400 rounded-full relative"
                  style={{ width: `${progressPct}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-200 rounded-full shadow-md opacity-0 group-hover/scrub:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* AI Capsule Markers on Timeline */}
              {capsules.map((cap) => {
                if (!duration || cap.timestamp > duration) return null;
                const posPct = (cap.timestamp / duration) * 100;
                return (
                  <div
                    key={cap.capsule_id}
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 bg-amber-400/90 rounded-full hover:scale-150 transition-transform cursor-pointer shadow-[0_0_6px_rgba(251,191,36,0.8)] z-10"
                    style={{ left: `${posPct}%` }}
                    title={`AI Capsule: ${formatTime(cap.timestamp)} (Focus: ${cap.blur_score.toFixed(2)})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        videoRef.current.currentTime = cap.timestamp;
                      }
                    }}
                  />
                );
              })}

              {/* Hover Time Tooltip */}
              {hoverTime !== null && (
                <div
                  className="absolute -top-7 px-2 py-0.5 rounded bg-black/90 border border-white/10 text-[9px] font-mono text-amber-200 pointer-events-none -translate-x-1/2 shadow-lg"
                  style={{ left: `${hoverPosition}px` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            {/* ── Control Buttons Bar ── */}
            <div className="flex items-center justify-between mt-2 font-mono text-[11px] text-white/80">
              {/* Left Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
                  title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} fill="white" />}
                </button>

                <button
                  onClick={() => skipSeconds(-5)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Seek Back 5s (←)"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => skipSeconds(5)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                  title="Seek Forward 5s (→)"
                >
                  <RotateCw size={14} />
                </button>

                {/* Time Display */}
                <span className="text-[10px] text-white/60 tracking-wider">
                  <span className="text-amber-300">{formatTime(currentTime)}</span> / {formatTime(duration)}
                </span>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-4">
                {/* Volume Slider */}
                <div className="flex items-center gap-2 group/vol">
                  <button
                    onClick={toggleMute}
                    className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                    title={isMuted ? "Unmute (M)" : "Mute (M)"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX size={15} className="text-red-400" />
                    ) : volume < 0.5 ? (
                      <Volume1 size={15} />
                    ) : (
                      <Volume2 size={15} />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 h-1 accent-amber-400 bg-white/20 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Playback Speed Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-amber-200 transition-colors cursor-pointer"
                  >
                    <Gauge size={11} />
                    <span>{playbackRate}x</span>
                  </button>

                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute bottom-full right-0 mb-2 py-1 w-20 bg-black/95 border border-white/15 rounded-md shadow-xl flex flex-col z-40"
                      >
                        {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => handleRateChange(rate)}
                            className={`px-3 py-1 text-[10px] text-left hover:bg-white/15 transition-colors ${
                              playbackRate === rate ? "text-amber-400 font-bold" : "text-white/70"
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Fullscreen Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================================
   2. CUSTOM IMAGE VIEWER (Zoom, Pan, Rotate, Edge Inspection)
   ============================================================================ */

function CustomImageViewer({
  src,
  coverSrc,
  filename,
}: {
  src: string;
  coverSrc?: string;
  filename: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showChecker, setShowChecker] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)));
  const zoomOut = () => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)));
  const resetView = () => {
    setZoom(1);
    setRotation(0);
  };
  const rotateClockwise = () => setRotation((r) => (r + 90) % 360);

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden rounded-lg select-none ${
        showChecker ? "bg-stone-900" : "bg-black"
      }`}
      style={
        showChecker
          ? {
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }
          : undefined
      }
    >
      {/* Instant cached thumbnail background while high-res loads */}
      {coverSrc && (
        <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none opacity-40">
          <img
            src={coverSrc}
            alt=""
            className="max-h-full max-w-full object-contain rounded filter blur-xs"
          />
        </div>
      )}

      {/* Dynamic Image Canvas */}
      <motion.div
        drag={zoom > 1}
        dragConstraints={{ left: -300, right: 300, top: -200, bottom: 200 }}
        className="w-full h-full flex items-center justify-center p-6 relative z-10"
      >
        <motion.img
          src={src}
          alt={filename}
          onLoad={handleImageLoad}
          animate={{ scale: zoom, rotate: rotation }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="max-h-full max-w-full object-contain drop-shadow-2xl rounded"
          draggable={false}
        />
      </motion.div>

      {/* Floating HUD Controls Pill */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-full bg-black/75 border border-white/10 backdrop-blur-md shadow-2xl font-mono text-[10px] text-white/80"
      >
        {/* Info Badge */}
        {imageSize && (
          <span className="text-amber-300/80 pr-2 border-r border-white/10">
            {imageSize.width} × {imageSize.height}
          </span>
        )}

        {/* Zoom Controls */}
        <button
          onClick={zoomOut}
          disabled={zoom <= 1}
          className="hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut size={13} />
        </button>

        <span className="text-white/90 min-w-[36px] text-center font-bold">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={zoomIn}
          disabled={zoom >= 3}
          className="hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={13} />
        </button>

        <span className="text-white/20">|</span>

        {/* Rotate Button */}
        <button
          onClick={rotateClockwise}
          className="hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
          title="Rotate 90°"
        >
          <RefreshCw size={12} />
          {rotation > 0 && <span>{rotation}°</span>}
        </button>

        <span className="text-white/20">|</span>

        {/* Checkerboard Edge Inspection Toggle */}
        <button
          onClick={() => setShowChecker(!showChecker)}
          className={`hover:text-white transition-colors cursor-pointer ${
            showChecker ? "text-amber-400" : "text-white/60"
          }`}
          title="Toggle Grid Background"
        >
          <Grid size={13} />
        </button>

        {/* Reset View */}
        {(zoom > 1 || rotation > 0) && (
          <button
            onClick={resetView}
            className="ml-1 text-[9px] uppercase tracking-wider text-amber-400 hover:underline cursor-pointer"
          >
            Reset
          </button>
        )}
      </motion.div>
    </div>
  );
}
