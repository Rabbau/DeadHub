import { useState, useEffect } from 'react';
import { fetchHeroDetail as fetchHero, fetchItemsByHero } from '../api/index.js';

export function useHeroDetail(id, language = 'english') {
  const [hero, setHero] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      fetchHero(id, language),
      fetchItemsByHero(id, language),
    ]).then(([heroRes, itemsRes]) => {
      if (heroRes.status === 'fulfilled') setHero(heroRes.value);
      else setError(heroRes.reason?.message ?? 'Failed to load hero');
      if (itemsRes.status === 'fulfilled') setItems(itemsRes.value);
      setLoading(false);
    });
  }, [id, language]);

  return { hero, items, loading, error };
}