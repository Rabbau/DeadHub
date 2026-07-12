import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchItemById, fetchItemGlobalStats, fetchHeroesUsingItem } from '../api';
import { useHeroStore } from '../store/heroStore';
import { useHeroes } from '../hooks/useHeroes';

export function useItemDetail() {
  const { id } = useParams();
  const language = useHeroStore(state => state.language);
  const { allHeroes } = useHeroes();
  const [item, setItem] = useState(null);
  const [stats, setStats] = useState(null);
  const [heroUsage, setHeroUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchItemById(id, language)
      .then(async (data) => {
        if (cancelled) return;
        if (!data) {
          setError('notFound');
          setLoading(false);
          return;
        }
        setItem(data);

        const activeHeroIds = allHeroes
          .filter(h => h.stats.pickrate > 0)
          .map(h => h.id);

        const [globalStats, usage] = await Promise.all([
          fetchItemGlobalStats(data.id),
          activeHeroIds.length
            ? fetchHeroesUsingItem(data.id, activeHeroIds.slice(0, 24))
            : Promise.resolve([]),
        ]);

        if (cancelled) return;
        setStats(globalStats);
        setHeroUsage(usage);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [id, language, allHeroes]);

  return { item, stats, heroUsage, loading, error };
}
