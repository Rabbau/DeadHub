import { useMemo } from 'react';
import { useHeroes } from './useHeroes';
import { formatWinrate, formatPickrate, winrateColor } from '../services/heroService';

// Герой попадает в рейтинги, если у него не меньше этой доли пиков выборки (и не меньше пола):
// иначе при узких фильтрах в топ выскакивали бы герои с горсткой матчей.
const MIN_SHARE = 0.004;
const MIN_GAMES_FLOOR = 30;

export function useMetaDashboard() {
  const { allHeroes, loading, refreshing, error } = useHeroes();

  const activeHeroes = useMemo(() => {
    const released = allHeroes.filter(h => h.released);
    const total = released.reduce((sum, h) => sum + h.stats.games_played, 0);
    const minGames = Math.max(MIN_GAMES_FLOOR, Math.round(total * MIN_SHARE));
    return released.filter(h => h.stats.games_played >= minGames);
  }, [allHeroes]);

  const topWinrate = useMemo(
    () => [...activeHeroes].sort((a, b) => b.stats.winrate - a.stats.winrate).slice(0, 10),
    [activeHeroes],
  );

  const topPickrate = useMemo(
    () => [...activeHeroes].sort((a, b) => b.stats.pickrate - a.stats.pickrate).slice(0, 10),
    [activeHeroes],
  );

  const heroOfWeek = useMemo(() => {
    if (!activeHeroes.length) return null;
    return [...activeHeroes].sort((a, b) => {
      const scoreA = a.stats.winrate * Math.log10(a.stats.games_played + 1);
      const scoreB = b.stats.winrate * Math.log10(b.stats.games_played + 1);
      return scoreB - scoreA;
    })[0];
  }, [activeHeroes]);

  return {
    loading,
    refreshing,
    error,
    activeCount: activeHeroes.length,
    topWinrate,
    topPickrate,
    heroOfWeek,
    formatWinrate,
    formatPickrate,
    winrateColor,
  };
}
