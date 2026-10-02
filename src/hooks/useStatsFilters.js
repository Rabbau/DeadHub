import { useEffect, useMemo } from 'react';
import { useHeroStore } from '../store/heroStore.js';
import { filtersKey, withNormalMode } from '../services/statsFilters.js';

/**
 * Фильтры статистики для хуков, которые сами ходят в API.
 * `ready` — фильтры определены (при первом визите это занимает долю секунды: ждём данные об
 * обновлении, чтобы сразу запросить статистику «с патча», а не перезапрашивать её через мгновение).
 * Хук сам запускает определение фильтров, поэтому страница может открыться по прямой ссылке.
 * `normalOnly` — для данных без версии под Street Brawl (карта убийств): режим отбрасывается,
 * и ключ меняется только вместе с тем, что действительно уходит в запрос.
 */
export function useStatsFilters({ normalOnly = false } = {}) {
  const stored = useHeroStore((state) => state.filters);
  const ready = useHeroStore((state) => state.filtersReady);

  useEffect(() => {
    const { resolveFilters, loadPatch } = useHeroStore.getState();
    resolveFilters();
    loadPatch();
  }, []);

  const filters = useMemo(() => (normalOnly ? withNormalMode(stored) : stored), [stored, normalOnly]);
  return { filters, ready, key: filtersKey(filters) };
}
