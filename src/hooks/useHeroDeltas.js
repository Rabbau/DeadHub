import { useEffect, useRef, useState } from 'react';
import { fetchHeroDeltas } from '../api/index.js';
import { useHeroStore } from '../store/heroStore.js';
import { filtersKey } from '../services/statsFilters.js';
import { useStatsFilters } from './useStatsFilters.js';

// Если посетитель быстро щёлкает по периодам и рангам, запрашиваем прошлый период только для того,
// на чём он остановился: каждый запрос — это расход лимита бесплатного API
const REQUEST_DELAY_MS = 300;

const EMPTY = { data: null, loading: false, error: null };

/**
 * Изменение статистики героев к прошлому периоду (см. deltaService). Берёт общие фильтры сайта или
 * `filters` из аргумента (страница обновления сравнивает именно «с патча»). С `enabled: false` запросов нет.
 * Текущая статистика приходит из того же кеша, что и список героев, поэтому в сеть уходит один запрос.
 */
export function useHeroDeltas({ enabled = true, filters: override } = {}) {
  const { filters: shared, ready } = useStatsFilters();
  const patches = useHeroStore((state) => state.patches);
  const [state, setState] = useState(EMPTY);
  const hasRun = useRef(false);

  const filters = override ?? shared;
  const key = filtersKey(filters);
  // Для «с патча» нужен список обновлений: до его загрузки сравнивать не с чем
  const needsPatches = filters.period === 'patch';
  const patchesReady = !needsPatches || patches.length > 0;

  useEffect(() => {
    if (!enabled || !ready || !patchesReady) return undefined;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    // Первый запрос страницы уходит сразу, последующие (смена фильтров) — после паузы
    const timer = setTimeout(() => {
      fetchHeroDeltas(filters, patches)
        .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
        .catch((e) => { if (!cancelled) setState({ data: null, loading: false, error: e.message }); });
    }, hasRun.current ? REQUEST_DELAY_MS : 0);
    hasRun.current = true;

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- вместо объекта фильтров следим за его ключом
  }, [enabled, ready, patchesReady, key, patches]);

  return {
    deltas: state.data?.deltas ?? null,
    window: state.data?.window ?? null,
    loading: state.loading,
    error: state.error,
  };
}
