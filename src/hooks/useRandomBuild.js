import { useState, useCallback } from 'react';
import { useHeroStore } from '../store/heroStore.js';
import { fetchItemsBySlot } from '../api/itemApi.js';
import { pickRandomItems } from '../services/heroService.js';

export function useRandomBuild() {
  const { heroes } = useHeroStore();
  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    // Фильтруем героев с пикрейтом > 0 (только активные)
    const availableHeroes = heroes.filter(h => h.stats.pickrate > 0);
    if (!availableHeroes.length) {
      console.warn('No available heroes with pickrate > 0');
      return;
    }

    setLoading(true);
    try {
      // Случайный герой из отфильтрованных
      const hero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)];

      // Получаем предметы по слотам
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