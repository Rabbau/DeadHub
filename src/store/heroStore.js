import { create } from 'zustand'
import { fetchHeroes } from '../api/index.js'

const getSavedLanguage = () => {
  return localStorage.getItem('dlhub_language') || 'english'
}

export const useHeroStore = create((set, get) => ({
  heroes: [],
  loading: false,
  error: null,
  lastFetched: null,
  language: getSavedLanguage(),

  search: '',
  role: 'all',
  sort: 'winrate',
  dir: 'desc',

  setSearch: (search) => set({ search }),
  setRole: (role) => set({ role }),
  setSort: (sort) => set({ sort }),
  setDir: (dir) => set({ dir }),

  setLanguage: (lang) => {
    localStorage.setItem('dlhub_language', lang)
    set({ language: lang, heroes: [], lastFetched: null })
    get().loadHeroes()
  },

  loadHeroes: async () => {
    if (get().loading) return
    const { lastFetched, heroes, language } = get()
    if (heroes.length && lastFetched && Date.now() - lastFetched < 5 * 60 * 1000) return

    set({ loading: true, error: null })
    try {
      const heroes = await fetchHeroes(language)
      set({ heroes, loading: false, lastFetched: Date.now() })
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },
}))