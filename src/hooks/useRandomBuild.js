import { useState, useCallback } from 'react';
import { useHeroStore } from '../store/heroStore.js';
import { fetchItemsBySlot } from '../api/itemApi.js';
import { pickUniqueRandom } from '../services/itemService.js';

const DEFAULT_OPTIONS = {
  heroId: '',
  slots: { weapon: true, spirit: true, vitality: true },
  itemsPerSlot: 4,
  allowDuplicates: false,
};

export function useRandomBuild() {
  const { heroes } = useHeroStore();
  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);

  const updateOptions = useCallback((patch) => {
    setOptions(prev => ({ ...prev, ...patch }));
  }, []);

  const generate = useCallback(async () => {
    setError(null);

    if (!heroes.length) {
      setError('heroesNotLoaded');
      return;
    }

    let availableHeroes = heroes.filter(h => h.stats.pickrate > 0);
    if (!availableHeroes.length) availableHeroes = heroes;

    if (!availableHeroes.length) {
      setError('noHeroes');
      return;
    }

    const enabledSlots = Object.entries(options.slots)
      .filter(([, enabled]) => enabled)
      .map(([slot]) => slot);

    if (!enabledSlots.length) {
      setError('noSlots');
      return;
    }

    setLoading(true);
    try {
      const hero = options.heroId
        ? availableHeroes.find(h => h.id === Number(options.heroId)) || availableHeroes[0]
        : availableHeroes[Math.floor(Math.random() * availableHeroes.length)];

      const slotItems = await Promise.all(
        enabledSlots.map(slot => fetchItemsBySlot(slot)),
      );

      const usedIds = new Set();
      const items = [];

      enabledSlots.forEach((slot, index) => {
        let pool = slotItems[index];
        if (!options.allowDuplicates) {
          pool = pool.filter(item => !usedIds.has(item.id));
        }
        const picked = pickUniqueRandom(pool, options.itemsPerSlot);
        picked.forEach(item => usedIds.add(item.id));
        items.push(...picked);
      });

      if (!items.length) {
        setError('noItems');
        return;
      }

      setBuild({ hero, items, generatedAt: Date.now() });
    } catch (e) {
      setError(e.message || 'generateError');
    } finally {
      setLoading(false);
    }
  }, [heroes, options]);

  return { build, loading, error, options, updateOptions, generate };
}