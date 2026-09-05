import { useEffect, useRef } from "react";
import { useReducedMotion } from "./ui";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface ConfettiProps {
  /** Increment this to fire a new burst. The component watches it for changes. */
  trigger: number;
  /** Origin of the burst, as a fraction of the viewport (0-1). Defaults to top-center. */
  origin?: { x?: number; y?: number };
  /** Particle count. Defaults to 60, bumped for the game-over finale. */
  count?: number;
  /** How long the burst lives, in ms. */
  duration?: number;
}

const COLORS = ["#f5a524", "#ffbb4d", "#ffd28a", "#2dd4bf", "#5eead4", "#f4708a", "#e6edf7"];

/**
 * A dependency-free confetti burst painted on a transparent full-screen canvas.
 * Fire it by changing the `trigger` prop; each change spawns a fresh particle
 * system that falls under gravity and fades. Skipped entirely when the user
 * has requested reduced motion.
 */
const Confetti = ({ trigger, origin, count = 60, duration = 1500 }: ConfettiProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || trigger === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size to the full viewport each burst, so device-pixel-ratio is current.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(dpr, dpr);

    const ox = (origin?.x ?? 0.5) * window.innerWidth;
    const oy = (origin?.y ?? 0.3) * window.innerHeight;

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
        size: 4 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 0,
        maxLife: duration,
      });
    }
    particlesRef.current = particles;

    const start = performance.now();

    const render = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const alive: Particle[] = [];
      for (const p of particlesRef.current) {
        p.life = elapsed;
        if (elapsed >= p.maxLife) continue;
        const t = elapsed / 1000;
        p.x += p.vx;
        p.y += p.vy + 4 * t * t; // gravity
        p.vx *= 0.99;
        p.rotation += p.vr;
        const fade = 1 - elapsed / p.maxLife;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();

        alive.push(p);
      }
      particlesRef.current = alive;

      if (alive.length > 0) {
        frameRef.current = requestAnimationFrame(render);
      } else {
        frameRef.current = null;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    frameRef.current = requestAnimationFrame(render);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, reduced]);

  if (reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden
    />
  );
};

export default Confetti;
