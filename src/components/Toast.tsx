import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from './ui';

export type ToastTone = 'ok' | 'error';

type ToastItem = { id: number; message: string; tone: ToastTone };

type ToastApi = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef<number[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'ok') => {
    counter.current += 1;
    const id = counter.current;
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 2800);
    timers.current.push(timer);
  }, []);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    },
    [],
  );

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        aria-live="polite"
        role="status"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cx(
              'pointer-events-auto max-w-[92vw] rounded-lg border px-3.5 py-2 text-[13px] font-medium shadow-[var(--tb-shadow-pop)] backdrop-blur',
              item.tone === 'error'
                ? 'border-danger/40 bg-panel text-danger'
                : 'border-line bg-elevated text-ink',
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>');
  return value;
}
