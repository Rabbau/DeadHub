import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

export const useTierStore = create(
  persist(
    (set, get) => ({
      tiers: { S: [], A: [], B: [], C: [], D: [] },
      availableHeroes: [],
      initialized: false,

      init: (activeHeroes) => {
        const state = get();
        if (state.initialized) return;
        // Если уже есть сохранённые данные, не сбрасываем
        if (state.availableHeroes.length > 0 || Object.values(state.tiers).some(a => a.length > 0)) {
          set({ initialized: true });
          return;
        }
        set({ availableHeroes: activeHeroes, initialized: true });
      },

      moveToTier: (heroId, tier) => {
        const { availableHeroes, tiers } = get();
        const idx = availableHeroes.findIndex(h => h.id === heroId);
        if (idx === -1) return;
        const [hero] = availableHeroes.splice(idx, 1);
        const newTiers = { ...tiers };
        newTiers[tier] = [...newTiers[tier], hero];
        set({ availableHeroes: [...availableHeroes], tiers: newTiers });
      },

      moveToPool: (heroId, fromTier) => {
        const { availableHeroes, tiers } = get();
        const list = [...tiers[fromTier]];
        const idx = list.findIndex(h => h.id === heroId);
        if (idx === -1) return;
        const [hero] = list.splice(idx, 1);
        const newTiers = { ...tiers, [fromTier]: list };
        set({ availableHeroes: [...availableHeroes, hero], tiers: newTiers });
      },

      moveBetweenTiers: (heroId, from, to) => {
        const { tiers } = get();
        const fromList = [...tiers[from]];
        const idx = fromList.findIndex(h => h.id === heroId);
        if (idx === -1) return;
        const [hero] = fromList.splice(idx, 1);
        const toList = [...(tiers[to] || [])];
        toList.push(hero);
        set({ tiers: { ...tiers, [from]: fromList, [to]: toList } });
      },

      reorder: (tier, oldIndex, newIndex) => {
        const { tiers } = get();
        const list = [...tiers[tier]];
        const [removed] = list.splice(oldIndex, 1);
        list.splice(newIndex, 0, removed);
        set({ tiers: { ...tiers, [tier]: list } });
      },

      reset: (activeHeroes) => {
        set({
          tiers: { S: [], A: [], B: [], C: [], D: [] },
          availableHeroes: activeHeroes,
          initialized: true,
        });
      },

      findHero: (id) => {
        const { availableHeroes, tiers } = get();
        const all = [...availableHeroes, ...Object.values(tiers).flat()];
        return all.find(h => h.id === id);
      },

      getContainer: (id) => {
        const { availableHeroes, tiers } = get();
        if (availableHeroes.some(h => h.id === id)) return 'pool';
        for (const key of TIER_ORDER) {
          if (tiers[key].some(h => h.id === id)) return key;
        }
        return null;
      },
    }),
    { name: 'tier-storage' }
  )
);