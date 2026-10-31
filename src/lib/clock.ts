/** Reactive "current time" store.
 *
 * A single 1s interval drives the whole app. Components subscribe through
 * `useNow()` and receive a value floored to their precision, so a clock that
 * only shows minutes does not re-render every second.
 */
import { useSyncExternalStore } from 'react';

export type Precision = 'second' | 'minute' | 'hour';

const UNIT: Record<Precision, number> = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
};

let current = Date.now();
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function notify(): void {
  current = Date.now();
  for (const listener of listeners) listener();
}

function ensureTimer(): void {
  if (intervalId !== null) return;
  intervalId = setInterval(notify, 1000);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) notify();
    });
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureTimer();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): number {
  return current;
}

export function getNow(): number {
  return Date.now();
}

/** Current epoch ms, re-rendering only when the chosen precision changes. */
export function useNow(precision: Precision = 'second'): number {
  const unit = UNIT[precision];
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(getSnapshot() / unit) * unit,
    () => 0,
  );
}
