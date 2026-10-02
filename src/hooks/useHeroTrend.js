import { useEffect, useMemo, useState } from 'react';
import { fetchWeeklyStats } from '../api/index.js';
import { heroTrend, trendSince } from '../services/trendService.js';
import { useStatsFilters } from './useStatsFilters.js';

/**
 * Динамика героя по неделям (винрейт и пикрейт). Запрос уходит только при `enabled` — например, когда блок
 * подошёл к экрану; он один на всех героев, поэтому переход на другого героя новых запросов не делает.
 * @param {number|undefined} heroId
 * @param {{ enabled?: boolean }} [options]
 */
export function useHeroTrend(heroId, { enabled = true } = {}) {
  const { filters, ready, key } = useStatsFilters();
  const [state, setState] = useState({ weekly: null, loading: false, error: null });

  useEffect(() => {
    if (!enabled || !ready) return undefined;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchWeeklyStats(filters)
      .then((weekly) => { if (!cancelled) setState({ weekly, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ weekly: null, loading: false, error: e.message }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- вместо объекта фильтров следим за его ключом
  }, [enabled, ready, key]);

  const points = useMemo(
    () => (state.weekly && heroId != null ? heroTrend(state.weekly, heroId, { sinceSec: trendSince() }) : []),
    [state.weekly, heroId],
  );

  return { points, loading: state.loading, error: state.error };
}
