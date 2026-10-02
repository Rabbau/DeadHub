import { useEffect, useState } from 'react';
import { fetchHeat } from '../api/index.js';
import { useStatsFilters } from './useStatsFilters.js';

// Ответ тяжёлый (до 2,3 МБ), а API бесплатный и с лимитом запросов: если посетитель быстро щёлкает по
// периодам, рангам и фазам, запрашиваем только то, на чём он остановился
const REQUEST_DELAY_MS = 300;

/**
 * Тепловая карта убийств и смертей для общих фильтров статистики (период и ранги) и фазы матча.
 * Запрос уходит только при `enabled` — ответ тяжёлый, пока слой выключен, он не нужен.
 * При смене фильтров прежняя картинка остаётся на экране, пока грузится новая.
 */
export function useHeat(enabled, phase) {
  const { filters, ready, key: filterKey } = useStatsFilters({ normalOnly: true });
  const [state, setState] = useState({ heat: null, loading: false, error: null });

  useEffect(() => {
    if (!enabled || !ready) return undefined;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const timer = setTimeout(() => {
      fetchHeat(filters, phase)
        .then((heat) => { if (!cancelled) setState({ heat, loading: false, error: null }); })
        .catch((e) => { if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: e.message })); });
    }, REQUEST_DELAY_MS);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- вместо объекта фильтров следим за его ключом
  }, [enabled, ready, filterKey, phase]);

  return state;
}
