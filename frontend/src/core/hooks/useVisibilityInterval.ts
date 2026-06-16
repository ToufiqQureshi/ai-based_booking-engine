// Hooks for background-friendly polling.
//
// The two core issues with `setInterval(fetchX, 30_000)` in React:
//   1. The interval keeps firing even when the user has switched to
//      another tab, wasting server CPU and the user's battery.
//   2. If the component unmounts mid-fetch, setState fires on an
//      unmounted component (the classic React warning).
//
// `useVisibilityInterval` solves both: it pauses the interval while
// the document is hidden and cleans itself up on unmount.
//
// The proper long-term fix for "live" data is WebSockets / Server-Sent
// Events (tracked in P4) — but for dashboards that can tolerate
// 30-60s of staleness, smart polling is good enough and much cheaper to
// build.

import { useEffect, useRef } from 'react';

export function useVisibilityInterval(
  callback: () => void | Promise<void>,
  delayMs: number,
  enabled: boolean = true,
): void {
  const savedCallback = useRef(callback);

  // Keep latest callback without restarting the interval.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || delayMs <= 0) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        try {
          await savedCallback.current();
        } catch {
          // Errors are the caller's responsibility — we don't want to
          // crash the timer loop on a transient failure.
        }
      }
      if (cancelled) return;
      timeoutId = setTimeout(tick, delayMs);
    };

    // Run once immediately so first paint isn't stale.
    timeoutId = setTimeout(tick, 0);

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && timeoutId === null) {
        timeoutId = setTimeout(tick, 0);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [delayMs, enabled]);
}
