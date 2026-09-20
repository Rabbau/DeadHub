import { useEffect, useState } from 'react';
import { fetchCounterStats, fetchSynergyStats } from '../api/index.js';
import { useHeroStore } from '../store/heroStore.js';
import { filtersKey } from '../services/statsFilters.js';
import { buildCounterIndex, buildSynergyIndex } from '../services/matchupService.js';

/**
 * Матрицы матчапов для текущих фильтров — два запроса на всех героев.
 * counters: Map<герой, Map<соперник, { wins, matches, wr }>>, synergy: то же для напарников.
 * При смене фильтров прежние данные остаются на экране, пока грузятся новые.
 */
export function useMatchups() {
  const filters = useHeroStore((state) => state.filters);
  const filterKey = filtersKey(filters);
  const [state, setState] = useState({ counters: null, synergy: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    Promise.all([fetchCounterStats(filters), fetchSynergyStats(filters)])
      .then(([counterRows, synergyRows]) => {
        if (cancelled) return;
        setState({
          counters: buildCounterIndex(counterRows),
          synergy: buildSynergyIndex(synergyRows),
          loading: false,
          error: null,
        });
      })
      .catch((e) => {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: e.message }));
      });

    return () => { cancelled = true; };
  }, [filterKey]);

  return state;
}
