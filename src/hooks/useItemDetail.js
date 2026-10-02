import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchItemById, fetchItemGlobalStats, fetchHeroesUsingItem } from '../api';
import { useHeroStore } from '../store/heroStore';
import { useHeroes } from '../hooks/useHeroes';
import { useStatsFilters } from './useStatsFilters';

export function useItemDetail() {
  const { id } = useParams();
  const language = useHeroStore(state => state.language);
  const { filters, ready, key: filterKey } = useStatsFilters();
  const { allHeroes } = useHeroes();
  const [item, setItem] = useState(null);
  const [stats, setStats] = useState(null);
  const [heroUsage, setHeroUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Сам предмет — зависит только от id и языка
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItem(null);
    setStats(null);
    setHeroUsage([]);

    fetchItemById(id, language)
      .then((data) => {
        if (cancelled) return;
        if (data) setItem(data);
        else setError('notFound');
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [id, language]);

  // Статистика предмета — зависит ещё и от фильтров, поэтому карточка предмета не перезагружается
  const itemId = item?.id;
  useEffect(() => {
    if (!itemId || !ready) return;
    let cancelled = false;
    setStatsLoading(true);

    const heroIds = allHeroes.filter(h => h.released).map(h => h.id);

    Promise.all([
      fetchItemGlobalStats(itemId, 20, filters).catch(() => null),
      heroIds.length ? fetchHeroesUsingItem(itemId, heroIds, 20, filters) : Promise.resolve([]),
    ])
      .then(([globalStats, usage]) => {
        if (cancelled) return;
        setStats(globalStats);
        setHeroUsage(usage);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => { cancelled = true; };
  }, [itemId, allHeroes, ready, filterKey]);

  return { item, stats, heroUsage, loading, statsLoading, error };
}
