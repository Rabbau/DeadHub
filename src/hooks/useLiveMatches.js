import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchActiveMatches, fetchBroadcastUrls } from '../api/index.js';
import { LIVE_REFRESH_S } from '../services/liveService.js';

const INITIAL = { matches: [], broadcasts: [], loading: true, refreshing: false, error: null, updatedAt: null };

/**
 * Идущие матчи и адреса трансляций. Обновляются сами раз в LIVE_REFRESH_S секунд, пока вкладка открыта (на скрытой
 * вкладке запросов нет; вернулись на вкладку, а данные старше этого срока, — обновляется сразу). Сбой при обновлении
 * не стирает то, что уже на экране: остаётся прежний список и признак ошибки. Адреса трансляций — дополнение:
 * без них список всё равно показывается.
 */
export function useLiveMatches() {
  const [state, setState] = useState(INITIAL);
  const updatedAt = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState((prev) => ({ ...prev, refreshing: !prev.loading, error: null }));
    const [matches, broadcasts] = await Promise.allSettled([fetchActiveMatches(), fetchBroadcastUrls()]);
    busy.current = false;
    if (matches.status === 'rejected') {
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: matches.reason?.status === 429 ? 'rateLimited' : 'failed' }));
      return;
    }
    updatedAt.current = Date.now();
    setState((prev) => ({
      matches: matches.value,
      // Адреса не загрузились — остаются прежние, если они были
      broadcasts: broadcasts.status === 'fulfilled' ? broadcasts.value : prev.broadcasts,
      loading: false,
      refreshing: false,
      error: null,
      updatedAt: updatedAt.current,
    }));
  }, []);

  useEffect(() => {
    load();
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, LIVE_REFRESH_S * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - updatedAt.current > LIVE_REFRESH_S * 1000) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { ...state, refresh: load };
}
