// src/store/compareStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCompareStore = create(
  persist(
    (set, get) => ({
      selectedIds: [],
      search: '',
      history: [],

      setSearch: (search) => set({ search }),

      _recordHistory: (ids) => {
        if (ids.length < 2) return;
        const sorted = [...ids].sort((a, b) => a - b);
        const key = sorted.join('-');
        const filtered = get().history.filter(entry => entry.key !== key);
        set({
          history: [{ ids: sorted, key, at: Date.now() }, ...filtered].slice(0, 8),
        });
      },

      addHero: (id) => {
        const { selectedIds } = get();
        let next = selectedIds;
        if (selectedIds.includes(id)) {
          next = selectedIds.filter(i => i !== id);
        } else if (selectedIds.length < 3) {
          next = [...selectedIds, id];
        }
        set({ selectedIds: next });
        get()._recordHistory(next);
      },

      removeHero: (id) => {
        const next = get().selectedIds.filter(i => i !== id);
        set({ selectedIds: next });
        get()._recordHistory(next);
      },

      clear: () => set({ selectedIds: [] }),

      replace: (ids) => {
        set({ selectedIds: ids });
        get()._recordHistory(ids);
      },

      applyHistory: (ids) => set({ selectedIds: ids }),
    }),
    { name: 'compare-storage' }
  )
);