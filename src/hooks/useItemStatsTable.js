import { useEffect, useState } from 'react';
import { fetchHeroItemStats, fetchItemStatsMap } from '../api/index.js';
import { useStatsFilters } from './useStatsFilters.js';

// Для выбранного героя просим те же 100 матчей, что и страница героя, — запрос и кеш общие
const HERO_MIN_MATCHES = 100;

/**
 * Статистика предметов для таблицы: по всем героям (один запрос на набор фильтров, он же используется
 * на страницах предметов) либо по одному герою (один запрос на героя, общий со страницей героя).
 * @param {number|null} heroId null — все герои
 * @param {{ enabled?: boolean }} [options] enabled: false — запроса нет, пока статистика не нужна (например, панель закрыта)
 * @returns {{ statsById: Record<number, { matches: number, wins: number, avgBuyTimeS: number|null }>|null, loading: boolean, error: string|null }}
 */
export function useItemStatsTable(heroId, { enabled = true } = {}) {
  const { filters, ready, key } = useStatsFilters();
  const [state, setState] = useState({ statsById: null, loading: enabled, error: null });

  useEffect(() => {
    if (!enabled || !ready) return undefined;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const request = heroId
      ? fetchHeroItemStats(heroId, HERO_MIN_MATCHES, filters)
        .then((list) => Object.fromEntries(list.map((stat) => [stat.itemId, stat])))
      : fetchItemStatsMap(filters);

    request
      .then((statsById) => { if (!cancelled) setState({ statsById, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ statsById: null, loading: false, error: e.message }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- вместо объекта фильтров следим за его ключом
  }, [enabled, ready, key, heroId]);

  return state;
}
