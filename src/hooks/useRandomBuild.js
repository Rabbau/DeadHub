import { useState, useCallback } from 'react';
import { useHeroStore } from '../store/heroStore.js';
import { fetchItemsBySlot } from '../api/itemApi.js';
import { pickUniqueRandom } from '../services/itemService.js';

const TOTAL_ITEMS = 12;

const DEFAULT_OPTIONS = {
  heroId: '',
  slots: { weapon: true, spirit: true, vitality: true },
  mode: 'balance', // 'balance' | 'random'
  allowDuplicates: false,
};

// Делит totalItems между слотами максимально поровну,
// учитывая, что в каком-то слоте может не хватить предметов —
// тогда "недобор" перераспределяется на остальные слоты.
function distributeBalanced(totalItems, poolSizes) {
  const counts = new Array(poolSizes.length).fill(0);
  let remaining = totalItems;
  let progress = true;

  while (remaining > 0 && progress) {
    progress = false;
    for (let i = 0; i < poolSizes.length && remaining > 0; i++) {
      if (counts[i] < poolSizes[i]) {
        counts[i]++;
        remaining--;
        progress = true;
      }
    }
  }

  return counts;
}

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

      const slotPools = await Promise.all(
        enabledSlots.map(slot => fetchItemsBySlot(slot)),
      );

      let items = [];

      if (options.mode === 'random') {
        // Объединяем все пулы в один — категории больше не влияют на распределение
        const combinedPool = slotPools.flat();
        items = pickUniqueRandom(combinedPool, TOTAL_ITEMS);
      } else {
        // balance: делим 12 предметов поровну между выбранными категориями
        const poolSizes = slotPools.map(pool => pool.length);
        const counts = distributeBalanced(TOTAL_ITEMS, poolSizes);

        const usedIds = new Set();
        enabledSlots.forEach((slot, index) => {
          let pool = slotPools[index];
          if (!options.allowDuplicates) {
            pool = pool.filter(item => !usedIds.has(item.id));
          }
          const picked = pickUniqueRandom(pool, counts[index]);
          picked.forEach(item => usedIds.add(item.id));
          items.push(...picked);
        });
      }

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