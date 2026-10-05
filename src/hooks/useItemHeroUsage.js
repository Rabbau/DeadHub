import { useEffect, useState } from 'react';
import { fetchHeroesUsingItem } from '../api/index.js';
import { useStatsFilters } from './useStatsFilters.js';

// Столько покупок предмета героем уже о чём-то говорят (так же считает страница предмета)
const MIN_MATCHES = 20;

/**
 * Герои, которые чаще всего покупают предмет (по числу покупок). Данные по всем предметам и героям приходят одним
 * запросом, общим со страницей предмета, и кешируются, поэтому переключение между предметами новых запросов не даёт.
 * Пока предмет не выбран или enabled = false, запроса нет; чужие данные (прежнего предмета) не показываются.
 * @param {number|null} itemId
 * @param {number[]} heroIds герои, которых показываем (вышедшие)
 * @param {boolean} enabled
 * @returns {{ usage: Array<{ heroId: number, matches: number, winrate: number }>, loading: boolean }}
 */
export function useItemHeroUsage(itemId, heroIds, enabled) {
  const { filters, ready, key } = useStatsFilters();
  const [state, setState] = useState({ itemId: null, usage: [], loading: false });
  const idsKey = heroIds.join(',');

  useEffect(() => {
    if (!enabled || !ready || itemId == null || heroIds.length === 0) return undefined;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));
    fetchHeroesUsingItem(itemId, heroIds, MIN_MATCHES, filters).then((usage) => {
      if (!cancelled) setState({ itemId, usage, loading: false });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- вместо объекта фильтров и списка героев следим за их ключами
  }, [enabled, ready, key, itemId, idsKey]);

  const current = state.itemId === itemId;
  const wanted = enabled && itemId != null && heroIds.length > 0;
  return { usage: current ? state.usage : [], loading: wanted && (state.loading || !current) };
}
