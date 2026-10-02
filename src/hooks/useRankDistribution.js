import { useEffect, useMemo, useState } from 'react';
import { fetchPlayerRank, fetchRankDistribution } from '../api/index.js';
import { positionOf } from '../services/rankDistributionService.js';

/**
 * Распределение игроков по рангам (один запрос на 3 КБ) и, если задан Account ID, положение этого игрока в нём
 * (ещё один запрос — текущий ранг). Без Account ID второй запрос не делается.
 * @param {number|null|undefined} accountId
 */
export function useRankDistribution(accountId) {
  const [state, setState] = useState({ distribution: null, loading: true, error: null });
  const [mine, setMine] = useState({ badge: null, loading: false });

  useEffect(() => {
    let cancelled = false;
    fetchRankDistribution()
      .then((distribution) => { if (!cancelled) setState({ distribution, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ distribution: null, loading: false, error: e.message }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!accountId) {
      setMine({ badge: null, loading: false });
      return undefined;
    }
    let cancelled = false;
    setMine({ badge: null, loading: true });
    fetchPlayerRank(accountId)
      .then((rank) => { if (!cancelled) setMine({ badge: rank?.badge ?? null, loading: false }); })
      .catch(() => { if (!cancelled) setMine({ badge: null, loading: false }); });
    return () => { cancelled = true; };
  }, [accountId]);

  const position = useMemo(() => positionOf(state.distribution, mine.badge), [state.distribution, mine.badge]);

  return { ...state, myBadge: mine.badge, myLoading: mine.loading, position };
}
