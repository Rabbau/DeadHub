import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../api/index.js';

/** Лидерборд региона (и, при heroId, конкретного героя). */
export function useLeaderboard(region, heroId) {
  const [state, setState] = useState({ entries: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    // Записи другого региона/героя не показываем, пока грузятся новые
    setState({ entries: [], loading: true, error: null });

    fetchLeaderboard(region, heroId)
      .then((entries) => { if (!cancelled) setState({ entries, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ entries: [], loading: false, error: e.message }); });

    return () => { cancelled = true; };
  }, [region, heroId]);

  return state;
}
