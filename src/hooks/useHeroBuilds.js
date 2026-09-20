import { useState, useEffect } from 'react';
import { fetchHeroItemStats, fetchHeroItemPermutations } from '../api';
import { fetchAllItems } from '../api/itemApi';
import { useHeroStore } from '../store/heroStore';
import { filtersKey } from '../services/statsFilters';

export function useHeroBuilds(heroId) {
  const language = useHeroStore(state => state.language);
  const filters = useHeroStore(state => state.filters);
  const filterKey = filtersKey(filters);

  const [popularItems, setPopularItems] = useState([]);
  const [combinations, setCombinations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!heroId) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchHeroItemStats(heroId, 100, filters),
      fetchHeroItemPermutations(heroId, 50, 5, filters),
      fetchAllItems(language),
    ])
      .then(([itemStats, perms, allItems]) => {
        if (cancelled) return;

        const byId = Object.fromEntries(allItems.map(i => [i.id, i]));

        const topItems = itemStats
          .slice(0, 12)
          .map(stat => ({
            ...stat,
            item: byId[stat.itemId] ?? null,
          }))
          .filter(entry => entry.item);

        const topCombos = perms
          .map(perm => ({
            ...perm,
            items: perm.itemIds.map(itemId => byId[itemId]).filter(Boolean),
          }))
          .filter(entry => entry.items.length >= 2);

        setPopularItems(topItems);
        setCombinations(topCombos);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [heroId, language, filterKey]);

  return { popularItems, combinations, loading };
}
