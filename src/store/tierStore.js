import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

export const useTierStore = create(
  persist(
    (set, get) => ({
      // Храним только ID героев
      tiers: { S: [], A: [], B: [], C: [], D: [] },
      availableHeroIds: [],
      initialized: false,

      // Инициализация: принимает массив героев, сохраняет их ID
      init: (heroes) => {
        const state = get();
        if (state.initialized) return;
        // Если уже есть сохранённые ID, не сбрасываем
        if (state.availableHeroIds.length > 0 || Object.values(state.tiers).some(a => a.length > 0)) {
          set({ initialized: true });
          return;
        }
        const ids = heroes.map(h => h.id);
        set({ availableHeroIds: ids, initialized: true });
      },

      moveToTier: (heroId, tier) => {
        const { availableHeroIds, tiers } = get();
        const idx = availableHeroIds.indexOf(heroId);
        if (idx === -1) return;
        const newAvailable = [...availableHeroIds];
        newAvailable.splice(idx, 1);
        const newTiers = { ...tiers };
        newTiers[tier] = [...newTiers[tier], heroId];
        set({ availableHeroIds: newAvailable, tiers: newTiers });
      },

      moveToPool: (heroId, fromTier) => {
        const { availableHeroIds, tiers } = get();
        const list = [...tiers[fromTier]];
        const idx = list.indexOf(heroId);
        if (idx === -1) return;
        list.splice(idx, 1);
        const newTiers = { ...tiers, [fromTier]: list };
        set({ availableHeroIds: [...availableHeroIds, heroId], tiers: newTiers });
      },

      moveBetweenTiers: (heroId, from, to) => {
        const { tiers } = get();
        const fromList = [...tiers[from]];
        const idx = fromList.indexOf(heroId);
        if (idx === -1) return;
        fromList.splice(idx, 1);
        const toList = [...(tiers[to] || [])];
        toList.push(heroId);
        set({ tiers: { ...tiers, [from]: fromList, [to]: toList } });
      },

      reorder: (tier, oldIndex, newIndex) => {
        const { tiers } = get();
        const list = [...tiers[tier]];
        const [removed] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, removed);
        set({ tiers: { ...tiers, [tier]: list } });
      },

      reset: (heroes) => {
        const ids = heroes.map(h => h.id);
        set({
          tiers: { S: [], A: [], B: [], C: [], D: [] },
          availableHeroIds: ids,
          initialized: true,
        });
      },

      // Вспомогательные методы для работы с ID
      getHeroIdsInTiers: () => {
        const { tiers } = get();
        return Object.values(tiers).flat();
      },

      getAllHeroIds: () => {
        const { availableHeroIds, tiers } = get();
        return [...availableHeroIds, ...Object.values(tiers).flat()];
      },

      isHeroInTier: (heroId) => {
        const { tiers } = get();
        for (const tier of TIER_ORDER) {
          if (tiers[tier].includes(heroId)) return tier;
        }
        return null;
      },

      isHeroInPool: (heroId) => {
        return get().availableHeroIds.includes(heroId);
      },
    }),
    { name: 'tier-storage' }
  )
);