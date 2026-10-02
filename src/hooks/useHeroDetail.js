import { useState, useEffect, useRef } from 'react';
import { fetchHeroDetail } from '../api/index.js';
import { useStatsFilters } from './useStatsFilters.js';

export function useHeroDetail(id, language = 'english') {
  const { filters, ready, key: filterKey } = useStatsFilters();

  const [hero, setHero] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const loadedFor = useRef({ id: null, language: null });

  useEffect(() => {
    if (!id || !ready) return;
    let cancelled = false;

    // Тот же герой, сменились только фильтры — обновляем цифры на месте, без экрана загрузки
    const sameHero = loadedFor.current.id === id && loadedFor.current.language === language;
    if (sameHero) {
      setRefreshing(true);
    } else {
      setHero(null);
      setLoading(true);
    }
    setError(null);

    fetchHeroDetail(id, language, filters)
      .then((data) => {
        if (cancelled) return;
        loadedFor.current = { id, language };
        setHero(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Failed to load hero');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- вместо объекта фильтров следим за его ключом
  }, [id, language, ready, filterKey]);

  return { hero, loading, refreshing, error };
}
