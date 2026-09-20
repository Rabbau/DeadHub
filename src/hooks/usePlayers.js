import { useEffect, useState } from 'react';
import {
  searchPlayers,
  fetchSteamProfile,
  fetchPlayerRank,
  fetchMatchHistory,
  fetchPlayerHeroStats,
} from '../api/index.js';

const MIN_QUERY_LENGTH = 2;

/** Поиск игроков по нику / Account ID / SteamID64. Запрос уходит, только когда в query что-то есть. */
export function usePlayerSearch(query) {
  const [state, setState] = useState({ results: [], loading: false, error: null });

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH) {
      setState({ results: [], loading: false, error: null });
      return undefined;
    }

    let cancelled = false;
    setState({ results: [], loading: true, error: null });

    searchPlayers(text)
      .then((results) => { if (!cancelled) setState({ results, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ results: [], loading: false, error: e.message }); });

    return () => { cancelled = true; };
  }, [query]);

  return state;
}

const EMPTY_PROFILE = { steam: null, rank: null, history: [], heroStats: [] };

/**
 * Профиль игрока: Steam-профиль, ранг, история матчей и статистика по героям.
 * Каждый источник может упасть отдельно — показываем то, что пришло; «не найден» — только когда пусто всё.
 */
export function usePlayerProfile(accountId) {
  const [state, setState] = useState({ ...EMPTY_PROFILE, loading: true, error: null });

  useEffect(() => {
    if (!accountId) {
      setState({ ...EMPTY_PROFILE, loading: false, error: 'notFound' });
      return undefined;
    }

    let cancelled = false;
    setState({ ...EMPTY_PROFILE, loading: true, error: null });

    Promise.allSettled([
      fetchSteamProfile(accountId),
      fetchPlayerRank(accountId),
      fetchMatchHistory(accountId),
      fetchPlayerHeroStats(accountId),
    ]).then(([steam, rank, history, heroStats]) => {
      if (cancelled) return;
      const value = (result, fallback) => (result.status === 'fulfilled' && result.value ? result.value : fallback);
      const next = {
        steam: value(steam, null),
        rank: value(rank, null),
        history: value(history, []),
        heroStats: value(heroStats, []),
      };
      const hasData = next.steam || next.history.length > 0 || next.heroStats.length > 0;
      setState({ ...next, loading: false, error: hasData ? null : 'notFound' });
    });

    return () => { cancelled = true; };
  }, [accountId]);

  return state;
}
