/**
 * VoiceMic.tsx — Premium voice-to-search experience.
 *
 * Visualisation: Canvas-based liquid orb.
 *   • A morphing organic blob whose silhouette bends with live FFT data
 *   • Radial resonance rings that ripple outward at audio peaks
 *   • 12 orbiting micro-particles that react to RMS amplitude
 *   • Phase-aware colour gradients and glow
 *
 * Recording flow:
 *   1. User clicks mic → frosted glass overlay mounts.
 *   2. Browser MediaRecorder + Web Audio API start capturing + analysing.
 *   3. After 4.5 s of silence (or clicking Stop), blob is POSTed to /api/transcribe.
 *   4. Transcript fills the search bar via onTranscript().
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, X } from "lucide-react";

const API_BASE = "http://localhost:8000";
const SILENCE_TIMEOUT_MS = 4500;
const SILENCE_THRESHOLD = 0.012;

/* ─── Haptics Helper ─────────────────────────────────────────────── */
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/* ─── Audio Micro-Interactions ───────────────────────────────────── */
function playTone(type: "chime" | "chord" | "thud") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const master = ctx.createGain();
    master.connect(ctx.destination);

    if (type === "chime") {
      master.gain.value = 0.05;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6
      osc.connect(master);
      master.gain.setValueAtTime(0.05, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "chord") {
      // Soft, smooth ascending success chime
      master.gain.value = 0.03;
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, ctx.currentTime);
        oscGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + i * 0.08 + 0.05);
        oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8 + i * 0.08);
        
        osc.connect(oscGain);
        oscGain.connect(master);
        
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + 0.8 + i * 0.08);
      });
    } else if (type === "thud") {
      master.gain.value = 0.1;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
      osc.connect(master);
      master.gain.setValueAtTime(0.1, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (e) {
    // Ignore if audio context fails to initialize
  }
}

interface VoiceMicProps {
  onTranscript: (text: string) => void;
}

/* ─── RMS helper ─────────────────────────────────────────────────── */
function rms(buf: Float32Array) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] ** 2;
  return Math.sqrt(s / buf.length);
}

/* ─── OrbCanvas ──────────────────────────────────────────────────── */
interface OrbCanvasProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  phase: "idle" | "listening" | "processing" | "done";
  onSilence: () => void;
}

function OrbCanvas({ analyserRef, phase, onSilence }: OrbCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 130, y: 130, active: false });

  /* Persistent per-particle state so they don't jump each frame */
  const particlesRef = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      angle: (i / 14) * Math.PI * 2,
      radius: 74 + (i % 3) * 14,
      speed: 0.004 + i * 0.0003,
      size: 1.5 + (i % 4) * 0.7,
      opacity: 0.25 + (i % 3) * 0.18,
    }))
  );

  /* Smoothed amplitude for the blob */
  const smoothAmpRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const SIZE = canvas.width; // square: 260px
    const CX = SIZE / 2;
    const CY = SIZE / 2;

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      timeRef.current += 0.016;
      const t = timeRef.current;

      ctx.clearRect(0, 0, SIZE, SIZE);

      // ── Read audio data ───────────────────────────────────────────
      const analyser = analyserRef.current;
      const freqData = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);
      const timeData = new Float32Array(analyser ? analyser.frequencyBinCount : 0);
      if (analyser) {
        analyser.getByteFrequencyData(freqData);
        analyser.getFloatTimeDomainData(timeData);
      }

      const level = analyser ? rms(timeData) : 0;
      const targetAmp = phase === "listening" ? Math.min(1, level * 22) : 0;
      smoothAmpRef.current += (targetAmp - smoothAmpRef.current) * 0.12;
      const amp = smoothAmpRef.current;

      // Silence detection
      if (phase === "listening" && analyser) {
        if (level < SILENCE_THRESHOLD) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              onSilence();
            }, SILENCE_TIMEOUT_MS);
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
      }

      // ── Phase-dependent colours ────────────────────────────────────
      // Warm ink palette: aesop-ink = #2A2420
      const isListening = phase === "listening";
      const isProcessing = phase === "processing";
      const isDone = phase === "done";

      const orbAlpha = isDone ? 0.92 : isProcessing ? 0.35 : 0.92;
      const glowSize = isListening ? 52 + amp * 48 : isProcessing ? 40 : 28;

      // ── Outer ambient glow ─────────────────────────────────────────
      if (!isDone) {
        const glow = ctx.createRadialGradient(CX, CY, 20, CX, CY, glowSize + 30);
        if (isProcessing) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 3.5);
          glow.addColorStop(0, `rgba(42,36,32,${0.07 * pulse})`);
        } else {
          glow.addColorStop(0, `rgba(42,36,32,${0.12 + amp * 0.18})`);
        }
        glow.addColorStop(1, "rgba(42,36,32,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }

      // ── Resonance rings (on peak transients) ──────────────────────
      if (isListening) {
        const ringCount = 3;
        for (let r = 0; r < ringCount; r++) {
          const delay = r * 0.4;
          const progress = ((t * 0.6 + delay) % 1);
          const ringRadius = 48 + progress * 70 + amp * 25;
          const ringAlpha = (1 - progress) * 0.18 * (0.5 + amp * 0.5);
          ctx.beginPath();
          ctx.arc(CX, CY, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(42,36,32,${ringAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      if (isProcessing) {
        // Single rotating dashed ring during processing
        const ringR = 62;
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(t * 1.4);
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.setLineDash([4, 8]);
        ctx.strokeStyle = "rgba(42,36,32,0.14)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── Morphing blob ──────────────────────────────────────────────
      const BASE_RADIUS = isProcessing ? 38 : isDone ? 30 : 42;
      const POINTS = 80; // smooth enough for organic look

      ctx.beginPath();
      for (let i = 0; i <= POINTS; i++) {
        const angle = (i / POINTS) * Math.PI * 2;

        // Layer 1: slow organic breathing
        let r = BASE_RADIUS + Math.sin(angle * 3 + t * 0.8) * 4 * (1 - amp * 0.3)
                            + Math.cos(angle * 5 - t * 0.55) * 2.5 * (1 - amp * 0.2);

        // Layer 2: FFT-driven distortion
        if (analyser && isListening) {
          const bin = Math.floor(((angle / (Math.PI * 2)) * freqData.length * 0.6));
          const freq = freqData[Math.min(bin, freqData.length - 1)] / 255;
          r += freq * 28 * amp + Math.sin(angle * 8 + t * 2) * freq * 6;
        }

        // Layer 3: processing ripple
        if (isProcessing) {
          r += Math.sin(angle * 6 + t * 3.2) * 4 * (0.5 + 0.5 * Math.sin(t * 2));
        }

        // Layer 4: Interactive mouse repulsion
        if (mouseRef.current.active && !isDone) {
          const px = CX + Math.cos(angle) * r;
          const py = CY + Math.sin(angle) * r;
          const dx = px - mouseRef.current.x;
          const dy = py - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 50) {
            r -= (50 - dist) * 0.15; // gentle repulsion
          }
        }

        const x = CX + Math.cos(angle) * r;
        const y = CY + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Gradient fill
      const fill = ctx.createRadialGradient(
        CX - 8, CY - 10, 2,
        CX, CY, BASE_RADIUS + 30
      );
      if (isDone) {
        fill.addColorStop(0, `rgba(42,36,32,${orbAlpha})`);
        fill.addColorStop(1, `rgba(42,36,32,${orbAlpha * 0.5})`);
      } else if (isProcessing) {
        const p = 0.5 + 0.5 * Math.sin(t * 2.8);
        fill.addColorStop(0, `rgba(42,36,32,${0.28 + p * 0.1})`);
        fill.addColorStop(1, `rgba(42,36,32,${0.08 + p * 0.06})`);
      } else {
        fill.addColorStop(0, `rgba(42,36,32,${0.82 + amp * 0.1})`);
        fill.addColorStop(0.6, `rgba(42,36,32,${0.65 + amp * 0.15})`);
        fill.addColorStop(1, `rgba(20,16,14,0.75)`);
      }
      ctx.fillStyle = fill;
      ctx.fill();

      // Specular highlight
      if (!isDone) {
        const hiG = ctx.createRadialGradient(CX - 10, CY - 12, 1, CX - 8, CY - 10, 18);
        hiG.addColorStop(0, `rgba(245,239,228,${0.18 - amp * 0.04})`);
        hiG.addColorStop(1, "rgba(245,239,228,0)");
        ctx.fillStyle = hiG;
        ctx.fill();
      }

      // ── Orbiting particles ─────────────────────────────────────────
      if (!isDone) {
        const orbitAmp = isListening ? 1 + amp * 1.4 : isProcessing ? 1 + 0.3 * Math.sin(t * 2) : 0.6;
        particlesRef.current.forEach((p) => {
          p.angle += p.speed * orbitAmp;
          const pr = p.radius + (isListening ? amp * 18 * Math.sin(p.angle * 3) : 0);
          const px = CX + Math.cos(p.angle) * pr;
          const py = CY + Math.sin(p.angle) * pr;
          const pa = p.opacity * (isListening ? 0.7 + amp * 0.3 : 0.35);
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(42,36,32,${pa})`;
          ctx.fill();
        });
      }

      // ── Tick marks (like a scientific dial) ───────────────────────
      if (isListening) {
        const tickCount = 24;
        for (let i = 0; i < tickCount; i++) {
          const angle = (i / tickCount) * Math.PI * 2;
          const bin = Math.floor((i / tickCount) * freqData.length * 0.5);
          const freq = analyser ? freqData[bin] / 255 : 0;
          const inner = 102 + freq * 6 * amp;
          const outer = inner + 4 + freq * 12 * amp;
          const tx1 = CX + Math.cos(angle) * inner;
          const ty1 = CY + Math.sin(angle) * inner;
          const tx2 = CX + Math.cos(angle) * outer;
          const ty2 = CY + Math.sin(angle) * outer;
          ctx.beginPath();
          ctx.moveTo(tx1, ty1);
          ctx.lineTo(tx2, ty2);
          ctx.strokeStyle = `rgba(42,36,32,${0.12 + freq * 0.45 * amp})`;
          ctx.lineWidth = i % 4 === 0 ? 1.5 : 0.8;
          ctx.stroke();
        }
      }

      // ── Done checkmark (drawn on canvas) ──────────────────────────
      if (isDone) {
        ctx.save();
        ctx.strokeStyle = "rgba(245,239,228,0.9)";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(CX - 10, CY);
        ctx.lineTo(CX - 3, CY + 8);
        ctx.lineTo(CX + 11, CY - 8);
        ctx.stroke();
        ctx.restore();
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [phase, analyserRef, onSilence]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    }
  };

  const handlePointerLeave = () => {
    mouseRef.current.active = false;
  };

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={260}
      className="block cursor-crosshair"
      style={{ imageRendering: "auto" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    />
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export function VoiceMic({ onTranscript }: VoiceMicProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "listening" | "processing" | "done">("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const streamRef    = useRef<MediaStream | null>(null);
  const recorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);

  /* ── stop everything ─────────────────────────────── */
  const stopRecording = useCallback(() => {
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  /* ── start recording ─────────────────────────────── */
  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);
      analyserRef.current = analyser;

      let mimeType = "";
      if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/aac")) {
          mimeType = "audio/aac";
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        await sendToAPI(blob);
      };
      
      setPhase("listening");
      playTone("chime");
      vibrate(15);

      // Delay recording start by 400ms to ensure the startup chime 
      // is completely finished and doesn't bleed into the microphone
      setTimeout(() => {
        if (streamRef.current && recorderRef.current?.state === "inactive") {
          recorderRef.current.start(200);
        }
      }, 400);
    } catch {
      setError("Microphone access denied.");
      setPhase("idle");
      playTone("thud");
      vibrate([20, 40, 20]);
    }
  }, []);

  /* ── called by canvas when silence detected ──────── */
  const handleSilenceStop = useCallback(() => {
    stopRecording();
    setPhase("processing");
    vibrate([10, 30, 10]); // double tap on auto-stop
  }, [stopRecording]);

  /* ── manual stop ─────────────────────────────────── */
  const handleManualStop = () => {
    stopRecording();
    setPhase("processing");
  };

  /* ── send to API ─────────────────────────────────── */
  const sendToAPI = async (blob: Blob) => {
    try {
      setPhase("processing");
      const form = new FormData();
      form.append("file", blob, "voice.webm");
      const res = await fetch(`${API_BASE}/api/transcribe`, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const text: string = data.text?.trim() ?? "";
      if (text) {
        setTranscript(text);
        setPhase("done");
        playTone("chord");
        vibrate(20);
        setTimeout(() => { onTranscript(text); handleClose(); }, 2500); // Give time for thoughtful text reveal
      } else {
        setError("Nothing heard. Try again.");
        setPhase("idle");
        playTone("thud");
        vibrate([20, 30, 20]);
      }
    } catch {
      setError("Could not reach transcription engine.");
      setPhase("idle");
      playTone("thud");
      vibrate([20, 30, 20]);
    }
  };

  /* ── open overlay ────────────────────────────────── */
  const handleOpen = async () => {
    setOpen(true);
    setPhase("idle");
    setTranscript("");
    setError(null);
    setTimeout(startRecording, 350);
  };

  /* ── close + cleanup ─────────────────────────────── */
  const handleClose = useCallback(() => {
    stopRecording();
    setOpen(false);
    setPhase("idle");
    setTranscript("");
    setError(null);
  }, [stopRecording]);

  /* ── escape key ──────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  /* ──────────────────────────────────────────────────
     Render
  ────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Trigger button ── */}
      <motion.button
        id="voice-mic-btn"
        type="button"
        onClick={handleOpen}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="relative flex h-7 w-7 items-center justify-center rounded-full text-aesop-ink/40 transition-colors hover:text-aesop-ink cursor-pointer"
        aria-label="Voice search"
      >
        <Mic className="h-[15px] w-[15px]" strokeWidth={1.6} />
      </motion.button>

      {/* ── Overlay ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Frosted backdrop */}
            <motion.div
              key="mic-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[80]"
              style={{
                backdropFilter: "blur(32px) saturate(1.5) brightness(0.97)",
                WebkitBackdropFilter: "blur(32px) saturate(1.5) brightness(0.97)",
                background: "rgba(245,239,228,0.48)",
              }}
              onClick={phase === "listening" ? handleManualStop : handleClose}
            />

            {/* Panel */}
            <motion.div
              key="mic-panel"
              initial={{ opacity: 0, scale: 0.82, y: 32 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 340, mass: 0.85 }}
              className="fixed z-[90] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative overflow-hidden rounded-[28px] border border-aesop-ink/8 bg-aesop-paper/88 px-12 pt-10 pb-8 shadow-[0_48px_120px_-24px_rgba(42,36,32,0.28),0_0_0_1px_rgba(42,36,32,0.04)]"
                style={{ backdropFilter: "blur(24px)", width: 320 }}
              >
                {/* Paper grain */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-[28px] opacity-[0.03]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundSize: "200px",
                  }}
                />

                {/* Close */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-aesop-ink/25 transition-colors hover:bg-aesop-ink/6 hover:text-aesop-ink/50 cursor-pointer"
                >
                  <X size={13} strokeWidth={1.8} />
                </button>

                {/* Phase label */}
                <motion.p
                  key={phase}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 text-center text-[8.5px] uppercase tracking-[0.38em] text-aesop-ink/30"
                  style={{ fontFamily: "var(--font-aesop-sans)" }}
                >
                  {phase === "idle" && "initialising"}
                  {phase === "listening" && "listening"}
                  {phase === "processing" && "transcribing"}
                  {phase === "done" && "captured"}
                </motion.p>

                {/* ── Canvas Orb ── */}
                <div className="flex justify-center -mx-4">
                  <OrbCanvas
                    analyserRef={analyserRef}
                    phase={phase}
                    onSilence={handleSilenceStop}
                  />
                </div>

                {/* Transcript / Error */}
                <div className="min-h-[36px] mt-2">
                  <AnimatePresence mode="wait">
                    {transcript && (
                      <motion.div
                        key="transcript"
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={{
                          visible: { transition: { staggerChildren: 0.04 } },
                        }}
                        className="text-center text-[14px] italic text-aesop-ink/75 leading-snug flex flex-wrap justify-center gap-x-[0.25em]"
                        style={{ fontFamily: "var(--font-aesop-serif)" }}
                      >
                        {transcript.split(" ").map((word, i) => (
                          <motion.span
                            key={i}
                            variants={{
                              hidden: { opacity: 0, filter: "blur(4px)", y: 2 },
                              visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.4 } },
                            }}
                          >
                            {word}
                          </motion.span>
                        ))}
                      </motion.div>
                    )}
                    {error && !transcript && (
                      <motion.p
                        key="error"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-center text-[11px] text-aesop-ink/40"
                      >
                        {error}
                      </motion.p>
                    )}
                    {!transcript && !error && phase === "listening" && (
                      <motion.p
                        key="hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center text-[9px] uppercase tracking-[0.25em] text-aesop-ink/22"
                        style={{ fontFamily: "var(--font-aesop-sans)" }}
                      >
                        tap orb to stop · auto-stops on silence
                      </motion.p>
                    )}
                    {!transcript && !error && (phase === "idle" || error) && (
                      <motion.p
                        key="start-hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center text-[11px] italic text-aesop-ink/28"
                        style={{ fontFamily: "var(--font-aesop-serif)" }}
                      >
                        speak to search your archive…
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Retry button on idle/error */}
                <AnimatePresence>
                  {(phase === "idle" || error) && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-5 flex justify-center"
                    >
                      <button
                        type="button"
                        onClick={startRecording}
                        className="flex items-center gap-2 rounded-full border border-aesop-ink/12 bg-aesop-ink/4 px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-aesop-ink/45 transition-all hover:border-aesop-ink/25 hover:bg-aesop-ink/8 hover:text-aesop-ink/70 cursor-pointer"
                      >
                        <Mic size={11} strokeWidth={1.6} />
                        Try again
                      </button>
                    </motion.div>
                  )}
                  {phase === "listening" && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-5 flex justify-center"
                    >
                      <button
                        type="button"
                        onClick={handleManualStop}
                        className="flex items-center gap-2 rounded-full border border-aesop-ink/12 bg-aesop-ink/4 px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-aesop-ink/45 transition-all hover:border-aesop-ink/25 hover:bg-aesop-ink/8 hover:text-aesop-ink/70 cursor-pointer"
                      >
                        <Square size={10} strokeWidth={1.6} className="fill-current" />
                        Stop
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
