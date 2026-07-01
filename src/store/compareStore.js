// src/store/compareStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCompareStore = create(
  persist(
    (set, get) => ({
      selectedIds: [],

      addHero: (id) => {
        const { selectedIds } = get();
        if (selectedIds.includes(id)) {
          // toggle: если уже есть – удаляем
          set({ selectedIds: selectedIds.filter(i => i !== id) });
        } else if (selectedIds.length < 3) {
          set({ selectedIds: [...selectedIds, id] });
        }
        // если уже 3 – ничего не делаем (используем replace отдельно)
      },

      removeHero: (id) => {
        set({ selectedIds: get().selectedIds.filter(i => i !== id) });
      },

      clear: () => set({ selectedIds: [] }),

      replace: (ids) => set({ selectedIds: ids }),
    }),
    { name: 'compare-storage' }
  )
);