import { useEffect } from 'react';
import { useHeroStore } from '../store/heroStore.js';
import { filtersKey } from '../services/statsFilters.js';

/**
 * Фильтры статистики для хуков, которые сами ходят в API.
 * `ready` — фильтры определены (при первом визите это занимает долю секунды: ждём данные об
 * обновлении, чтобы сразу запросить статистику «с патча», а не перезапрашивать её через мгновение).
 * Хук сам запускает определение фильтров, поэтому страница может открыться по прямой ссылке.
 */
export function useStatsFilters() {
  const filters = useHeroStore((state) => state.filters);
  const ready = useHeroStore((state) => state.filtersReady);

  useEffect(() => {
    const { resolveFilters, loadPatch } = useHeroStore.getState();
    resolveFilters();
    loadPatch();
  }, []);

  return { filters, ready, key: filtersKey(filters) };
}
