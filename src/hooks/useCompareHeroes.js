// src/hooks/useCompareHeroes.js
import { useState, useEffect } from 'react';
import { fetchHeroDetail } from '../api';
import { useCompareStore } from '../store/compareStore';

export function useCompareHeroes() {
  const { selectedIds } = useCompareStore();
  const [heroes, setHeroes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedIds.length) {
      setHeroes([]);
      return;
    }
    setLoading(true);
    Promise.all(selectedIds.map(id => fetchHeroDetail(id)))
      .then(results => {
        setHeroes(results.filter(Boolean));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedIds]);

  return { heroes, loading };
}