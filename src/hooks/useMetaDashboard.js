import { useState, useEffect, useMemo } from 'react';
import { useHeroes } from './useHeroes';
import { formatWinrate, formatPickrate, winrateColor } from '../services/heroService';

const MIN_GAMES = 500;

export function useMetaDashboard() {
  const { allHeroes, loading, error } = useHeroes();

  const activeHeroes = useMemo(
    () => allHeroes.filter(h => h.stats.pickrate > 0 && h.stats.games_played >= MIN_GAMES),
    [allHeroes],
  );

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
