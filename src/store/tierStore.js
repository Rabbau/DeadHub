import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function tiersEqual(left, right) {
  return TIER_ORDER.every((tier) => arraysEqual(left[tier] || [], right[tier] || []));
}

export const useTierStore = create(
  persist(
    (set, get) => ({
      // Храним только ID героев
      tiers: { S: [], A: [], B: [], C: [], D: [] },
      availableHeroIds: [],
      initialized: false,

      // Инициализация и синхронизация с актуальным списком героев
      init: (heroIds) => {
        const state = get();
        const heroIdSet = new Set(heroIds);

        const hasExistingData =
          state.availableHeroIds.length > 0 ||
          Object.values(state.tiers).some(a => a.length > 0);

        if (!hasExistingData) {
          if (arraysEqual(state.availableHeroIds, heroIds) && state.initialized) return;
          set({ availableHeroIds: heroIds, initialized: true });
          return;
        }

        const newTiers = {};
        for (const tier of TIER_ORDER) {
          newTiers[tier] = (state.tiers[tier] || []).filter(id => heroIdSet.has(id));
        }

        const newPool = state.availableHeroIds.filter(id => heroIdSet.has(id));
        const assignedIds = new Set([
          ...Object.values(newTiers).flat(),
          ...newPool,
        ]);
        const newHeroIds = heroIds.filter(id => !assignedIds.has(id));
        const nextPool = [...newPool, ...newHeroIds];

        if (
          tiersEqual(state.tiers, newTiers) &&
          arraysEqual(state.availableHeroIds, nextPool) &&
          state.initialized
        ) {
          return;
        }

        set({
          tiers: newTiers,
          availableHeroIds: nextPool,
          initialized: true,
        });
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

      reset: (heroIds) => {
        const ids = Array.isArray(heroIds) && typeof heroIds[0] === 'object'
          ? heroIds.map(h => h.id)
          : heroIds;
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