import { useState, useCallback } from 'react';
import { useHeroStore } from '../store/heroStore.js';
import { fetchItemsBySlot } from '../api/itemApi.js';

export function useRandomBuild() {
  const { heroes } = useHeroStore();
  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    if (!heroes.length) {
      console.warn('Heroes not loaded yet');
      return;
    }

    let availableHeroes = heroes.filter(h => h.stats.pickrate > 0);
    if (!availableHeroes.length) {
      console.warn('No heroes with pickrate > 0, using all heroes');
      availableHeroes = heroes;
    }

    if (!availableHeroes.length) {
      console.error('No heroes available');
      return;
    }

    setLoading(true);
    try {
      const hero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];

      const [weaponItems, spiritItems, vitalityItems] = await Promise.all([
        fetchItemsBySlot('weapon'),
        fetchItemsBySlot('spirit'),
        fetchItemsBySlot('vitality'),
      ]);

      const pick4 = (arr) => {
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 4);
      };

      const items = [
        ...pick4(weaponItems),
        ...pick4(spiritItems),
        ...pick4(vitalityItems),
      ];

      setBuild({ hero, items, generatedAt: Date.now() });
    } catch (e) {
      console.error('Generate build error:', e);
    } finally {
      setLoading(false);
    }
  }, [heroes]);

  return { build, loading, generate };
}