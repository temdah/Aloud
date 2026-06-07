import { useCallback, useEffect, useRef, useState } from 'react';

export type SleepTimer = {
  /** True while a countdown is running. */
  active: boolean;
  /** Whole minutes left (rounded up), 0 when inactive. */
  minutesLeft: number;
  /** Start (or restart) the countdown for `minutes`. */
  start: (minutes: number) => void;
  /** Cancel a running countdown. */
  cancel: () => void;
};

// A wall-clock countdown that fires `onFire` once when it elapses. It tracks an
// absolute deadline (not a tick count) so it stays accurate even if the JS timer
// is throttled in the background — the relevant case for "stop playback after N
// minutes" while the screen is off.
export function useSleepTimer(onFire: () => void): SleepTimer {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  useEffect(() => {
    if (deadline == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  useEffect(() => {
    if (deadline == null || firedRef.current) return;
    if (now >= deadline) {
      firedRef.current = true;
      setDeadline(null);
      onFireRef.current();
    }
  }, [now, deadline]);

  const start = useCallback((minutes: number) => {
    if (minutes <= 0) {
      setDeadline(null);
      return;
    }
    firedRef.current = false;
    setNow(Date.now());
    setDeadline(Date.now() + minutes * 60_000);
  }, []);

  const cancel = useCallback(() => setDeadline(null), []);

  const minutesLeft = deadline == null ? 0 : Math.max(0, Math.ceil((deadline - now) / 60_000));
  return { active: deadline != null, minutesLeft, start, cancel };
}
