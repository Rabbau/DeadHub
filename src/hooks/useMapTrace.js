import { useEffect, useState } from 'react';
import { traceMapImage } from '../api/index.js';

const IDLE = { url: null, status: 'idle', shape: null };

/**
 * Векторные контуры одной картинки карты. Пока `enabled` ложно, ничего не грузится (туннели нужны не всегда).
 * status: idle — не запрашивали, loading — считается, ready — готово (shape), failed — не вышло.
 * @param {string|null} url
 * @param {'ground'|'tunnels'} kind
 * @param {boolean} [enabled]
 */
export function useMapTrace(url, kind, enabled = true) {
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    if (!url || !enabled) return undefined;
    let cancelled = false;
    setState((prev) => (prev.url === url && prev.status !== 'failed' ? prev : { url, status: 'loading', shape: null }));
    traceMapImage(url, kind).then(
      (shape) => { if (!cancelled) setState({ url, status: 'ready', shape }); },
      () => { if (!cancelled) setState({ url, status: 'failed', shape: null }); },
    );
    return () => { cancelled = true; };
  }, [url, kind, enabled]);

  // Адрес сменился, а эффект ещё не отработал: прежний результат чужой
  return state.url === url ? state : IDLE;
}
