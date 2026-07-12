import { useState, useEffect } from 'react';import { fetchHeroItemStats, fetchHeroItemPermutations } from '../api';
import { fetchAllItems } from '../api/itemApi';

export function useHeroBuilds(heroId) {
  const [popularItems, setPopularItems] = useState([]);
  const [combinations, setCombinations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!heroId) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchHeroItemStats(heroId),
      fetchHeroItemPermutations(heroId),
      fetchAllItems(),
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
  }, [heroId]);

  return { popularItems, combinations, loading };
}
