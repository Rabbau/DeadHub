import { useState, useCallback } from 'react';
import { useHeroStore } from '../store/heroStore.js';
import { fetchItemsBySlot } from '../api/itemApi.js';
import { pickRandomHero, pickRandomItems } from '../services/heroService.js';

export function useRandomBuild() {
  const { heroes } = useHeroStore();
  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    if (!heroes.length) return;
    setLoading(true);
    try {
      const hero = pickRandomHero(heroes);

      // Получаем предметы по слотам
      const [weaponItems, spiritItems, vitalityItems] = await Promise.all([
        fetchItemsBySlot('weapon'),
        fetchItemsBySlot('spirit'),
        fetchItemsBySlot('vitality'),
      ]);

      // Выбираем по 4 случайных предмета из каждого слота
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