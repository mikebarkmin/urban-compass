import { useEffect, useRef } from "react";

/**
 * Hold the screen awake while a turn is live. A phone dimming mid-round costs
 * more here than in most apps: the turn clock keeps running behind the lock
 * screen, so a player can lose a move to their own screen timeout.
 *
 * Browsers drop the lock whenever the tab is hidden, so it has to be taken
 * again on the way back — that re-request is the only way to hold one across
 * an app switch. Where the API is missing or the request is refused (low
 * battery, a policy), the screen simply behaves as it normally would.
 */
export const useWakeLock = (active: boolean) => {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let released = false;

    const acquire = async () => {
      if (released || document.visibilityState !== "visible") return;
      try {
        lockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // Refused; nothing to fall back to.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void lockRef.current?.release();
      lockRef.current = null;
    };
  }, [active]);
};
