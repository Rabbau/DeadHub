/**
 * @fileoverview Глобальный стор героев (Zustand).
 * Единственное место, где хранится список героев и фильтры.
 */

import { create } from 'zustand'
import { fetchHeroes } from '../api/index.js'

export const useHeroStore = create((set, get) => ({
  /** @type {import('../types/index.js').Hero[]} */
  heroes: [],
  loading: false,
  error: null,
  lastFetched: null,

  // UI-фильтры
  search: '',
  role: 'all',
  sort: 'winrate',
  dir: 'desc',

  setSearch: (search) => set({ search }),
  setRole: (role) => set({ role }),
  setSort: (sort) => set({ sort }),
  setDir: (dir) => set({ dir }),

  /**
   * Загрузить героев (с дедупликацией запросов).
   */
  loadHeroes: async () => {
    if (get().loading) return
    // Не перезапрашиваем если свежие данные (< 5 мин в рамках сессии)
    const { lastFetched, heroes } = get()
    if (heroes.length && lastFetched && Date.now() - lastFetched < 5 * 60 * 1000) return

    set({ loading: true, error: null })
    try {
      const heroes = await fetchHeroes()
      set({ heroes, loading: false, lastFetched: Date.now() })
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },
}))