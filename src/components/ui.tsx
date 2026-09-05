import { ButtonHTMLAttributes, ReactNode, useEffect, useRef, useState } from "react";
import { stringToColor } from "@/utils";
import { AvatarConfig, avatarColor } from "../../game/avatar";
import { symbolUrl } from "@/utils/emoji";

export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-beacon-500 text-chart-950 font-semibold hover:bg-beacon-400 shadow-lg shadow-beacon-500/20",
  secondary:
    "bg-chart-800 text-chart-100 border border-chart-600 hover:border-chart-500 hover:bg-chart-700",
  ghost: "text-chart-300 hover:text-chart-100 hover:bg-chart-800/70",
  danger: "bg-chart-800 text-alert-500 border border-alert-500/40 hover:bg-alert-500/10",
};

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = ({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) => (
  <button
    {...props}
    className={cx(
      "rounded-lg transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beacon-500",
      "active:translate-y-px",
      BUTTON_VARIANTS[variant],
      BUTTON_SIZES[size],
      className,
    )}
  />
);

interface PanelProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  subtitle?: ReactNode;
}

export const Panel = ({ children, className, title, subtitle, action }: PanelProps) => (
  <section className={cx("panel p-4 sm:p-5", className)}>
    {(title || action) && (
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          {title && (
            <h2 className="font-display text-sm font-semibold tracking-[0.14em] text-chart-300 uppercase">
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-1 text-xs text-chart-400">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    {children}
  </section>
);

export const Badge = ({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "beacon" | "signal" | "muted";
  className?: string;
}) => {
  const tones = {
    neutral: "bg-chart-800 text-chart-200 border-chart-600",
    beacon: "bg-beacon-500/15 text-beacon-300 border-beacon-500/40",
    signal: "bg-signal-500/15 text-signal-400 border-signal-500/40",
    muted: "bg-chart-850 text-chart-400 border-chart-700",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
};

/** A player's colour puck. Shows their chosen emoji on their hue when an
 *  avatar config is supplied, otherwise falls back to name-derived colour and
 *  initials (e.g. for a player who has left the room but whose chips remain).
 *  The emoji is drawn from a self-hosted Twemoji SVG so it looks the same on
 *  every OS rather than depending on the system emoji font. */
export const Avatar = ({
  name,
  seed,
  size = 28,
  ring,
  avatar,
}: {
  name: string;
  seed: string;
  size?: number;
  ring?: "active" | "done" | null;
  avatar?: AvatarConfig;
}) => (
  <span
    className={cx(
      "inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-chart-950 leading-none",
      ring === "active" && "ring-2 ring-beacon-400 ring-offset-2 ring-offset-chart-900",
      ring === "done" && "ring-2 ring-signal-500/60 ring-offset-2 ring-offset-chart-900",
    )}
    style={{
      width: size,
      height: size,
      // Initials only — the emoji is an <img> sized below.
      fontSize: size * 0.42,
      backgroundColor: avatar ? avatarColor(avatar.hue) : stringToColor(seed),
    }}
    title={name}
  >
    {avatar ? (
      // Self-hosted SVG icons: next/image adds no value here and would need a
      // loader under static export, so a plain <img> is the lighter choice.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={symbolUrl(avatar.symbol)}
        alt={name}
        draggable={false}
        // Fill the puck, leaving a small margin so the silhouette breathes.
        style={{ width: size * 0.72, height: size * 0.72 }}
      />
    ) : (
      name.slice(0, 2).toUpperCase()
    )}
  </span>
);

export const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
      {label}
    </span>
    {children}
    {hint && <span className="mt-1.5 block text-xs text-chart-500">{hint}</span>}
  </label>
);

export const inputClass =
  "w-full rounded-lg border border-chart-600 bg-chart-950/70 px-3 py-2.5 text-chart-100 " +
  "placeholder:text-chart-500 transition-colors focus:border-beacon-500 focus:outline-none";

/**
 * A row of mutually exclusive choices. Used for the host's settings, where a
 * handful of presets read better than a free-form number box.
 */
export const Segmented = <T extends string | number | boolean>({
  value,
  options,
  disabled,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
  className?: string;
}) => (
  <div
    role="radiogroup"
    className={cx(
      "inline-flex flex-wrap gap-1 rounded-lg border border-chart-700 bg-chart-950/60 p-1",
      disabled && "opacity-50",
      className,
    )}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={selected}
          title={option.title}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cx(
            "tap-target inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-beacon-500",
            selected
              ? "bg-beacon-500 text-chart-950"
              : "text-chart-300 enabled:hover:bg-chart-800 enabled:hover:text-chart-100",
            disabled && "cursor-not-allowed",
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

/** A labelled setting: title and explanation on the left, control on the right. */
export const SettingRow = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-chart-800 py-3 first:border-t-0 first:pt-0">
    <div className="min-w-0 flex-1 basis-52">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-chart-400 uppercase">
        {label}
      </div>
      {hint && <p className="mt-1 text-xs text-chart-500">{hint}</p>}
    </div>
    <div className="flex shrink-0 items-center gap-3">{children}</div>
  </div>
);

/** True when the user has asked the OS to minimise motion. */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return reduced;
};

/**
 * Animate a number from `from` to `target` over ~400ms with an ease-out curve.
 * Uses requestAnimationFrame, so it pauses cleanly when the tab is hidden.
 * Returns the current displayed value, which snaps to `target` instantly when
 * reduced-motion is requested or `from` equals `target`.
 */
export const useCountUp = (
  target: number,
  from = 0,
  duration = 400,
): number => {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(from);
  const frameRef = useRef<number | null>(null);
  // Tracks the value the last animation reached, so a new `target` animates
  // from the current displayed value rather than the original `from`.
  const fromRef = useRef(from);

  useEffect(() => {
    if (reduced || fromRef.current === target) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const start = performance.now();
    const startValue = fromRef.current;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (target - startValue) * eased);
      setValue(current);
      fromRef.current = current;
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = target;
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, reduced]);

  return value;
};

/**
 * A face-down answer card for the staged reveal: a rounded card with the
 * compass-rose pattern from `globals.css` and the category icon centred on it.
 * Rendered as the back face inside a `.flip-scene` / `.flip-card` wrapper.
 */
export const CardBack = ({
  icon,
  className,
}: {
  icon: ReactNode;
  className?: string;
}) => (
  <div
    className={cx(
      "card-back flip-face flip-face--back grid place-items-center rounded-xl border border-chart-700",
      className,
    )}
  >
    <span className="font-display text-2xl text-chart-500/70" aria-hidden>
      {icon}
    </span>
  </div>
);
