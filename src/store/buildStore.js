import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeHistory, pushHistory } from '../services/buildService.js';

/**
 * История бросков случайного билда. Хранится только в этом браузере (localStorage, `dlhub_build_history`): ни аккаунта,
 * ни входа на сайте нет. Всё, что читается из хранилища, проходит через normalizeHistory.
 */
export const useBuildStore = create(
  persist(
    (set, get) => ({
      /** Записи buildService.historyEntry, новые первыми */
      history: [],

      record: (entry) => set({ history: pushHistory(get().history, entry) }),

      clear: () => set({ history: [] }),
    }),
    {
      name: 'dlhub_build_history',
      version: 1,
      partialize: (state) => ({ history: state.history }),
      merge: (persisted, current) => ({ ...current, history: normalizeHistory(persisted?.history) }),
    },
  ),
);
