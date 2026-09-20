import { useState, useEffect, useRef } from 'react';
import { fetchHeroDetail } from '../api/index.js';
import { useHeroStore } from '../store/heroStore.js';
import { filtersKey } from '../services/statsFilters.js';

export function useHeroDetail(id, language = 'english') {
  const filters = useHeroStore((state) => state.filters);
  const filterKey = filtersKey(filters);

  const [hero, setHero] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const loadedFor = useRef({ id: null, language: null });

  useEffect(() => {
    if (!id) return;
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
  }, [id, language, filterKey]);

  return { hero, loading, refreshing, error };
}
