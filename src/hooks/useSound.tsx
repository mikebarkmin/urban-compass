import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const MUTE_KEY = "urban-compass:muted";

/** The cues the reveal can play, kept as a string union so callers stay typed. */
export type SoundCue =
  | "flip"
  | "chime"
  | "buzz"
  | "drumroll"
  | "fanfare"
  | "doubt"
  | "swap";

/**
 * Vibration patterns per cue, in milliseconds (on/off/on...). Deliberately
 * short — a game move should feel like a click, not an alarm. Cues with no
 * entry stay silent to the hand.
 */
const HAPTICS: Partial<Record<SoundCue, number | number[]>> = {
  flip: 12,
  swap: [8, 40, 8],
  doubt: [18, 40, 18],
  chime: 10,
  buzz: [20, 30, 20],
  fanfare: [12, 60, 12, 60, 24],
};

interface SoundApi {
  /** Play a synthesised cue. No-op when muted or when motion is reduced. */
  play: (cue: SoundCue) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
}

const SoundContext = createContext<SoundApi>({
  play: () => {},
  muted: false,
  setMuted: () => {},
  toggleMuted: () => {},
});

const readStoredMute = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "true";
  } catch {
    return false;
  }
};

export const SoundProvider = ({ children }: { children: ReactNode }) => {
  const [muted, setMutedState] = useState(false);
  // Lazily created on the first user gesture; SSR-safe because it starts null.
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setMutedState(readStoredMute());
  }, []);

  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    // A context created before a user gesture starts suspended; resume it.
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const setMuted = useCallback((next: boolean) => {
    setMutedState(next);
    try {
      window.localStorage.setItem(MUTE_KEY, String(next));
    } catch {
      // localStorage may be blocked; the choice just won't persist.
    }
  }, []);

  const play = useCallback(
    (cue: SoundCue) => {
      if (muted) return;

      // Respect reduced-motion for non-essential cues: keep chimes, skip the
      // drumroll and fanfare flourishes.
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced && (cue === "drumroll" || cue === "fanfare")) return;

      // On a phone the buzz is half the feedback, and it lands even when the
      // device is on silent or the audio context never came up. The mute
      // toggle covers it too: it is the one "make the game quiet" control.
      const pattern = HAPTICS[cue];
      if (pattern && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(pattern);
        } catch {
          // Some browsers expose `vibrate` but reject it outside a gesture.
        }
      }

      const ctx = ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (cue === "flip") {
        // Short sine blip — the tick of a card landing.
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
        return;
      }

      if (cue === "chime") {
        // Two-tone major third — a positive resolution.
        const freqs = [659.25, 880];
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.0001, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.08 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.26);
        });
        return;
      }

      if (cue === "buzz") {
        // Low sawtooth — a miss or collision.
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
        return;
      }

      if (cue === "drumroll") {
        // White-noise burst with rising amplitude — the intro tension.
        const length = 1.0;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * (i / data.length);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + length);
        gain.gain.exponentialRampToValueAtTime(0.001, now + length + 0.1);
        // A lowpass sweeps open so it reads as a drum, not hiss.
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(2000, now + length);
        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start(now);
        source.stop(now + length + 0.1);
        return;
      }

      if (cue === "fanfare") {
        // A quick ascending arpeggio for game-over.
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          const t = now + i * 0.12;
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.32);
        });
        return;
      }

      if (cue === "doubt") {
        // A tense two-note question — a doubt is a public call.
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(330, now + 0.12);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
        return;
      }

      if (cue === "swap") {
        // A quick upward swoop — a chip moving across the board.
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.exponentialRampToValueAtTime(988, now + 0.18);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      }
    },
    [muted, ensureContext],
  );

  const toggleMuted = useCallback(() => setMuted(!muted), [muted, setMuted]);

  return (
    <SoundContext.Provider value={{ play, muted, setMuted, toggleMuted }}>
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => useContext(SoundContext);
