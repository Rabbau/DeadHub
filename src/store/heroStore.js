import { create } from 'zustand'
import { fetchHeroes } from '../api/index.js'
import { DEFAULT_FILTERS, filtersKey, normalizeFilters } from '../services/statsFilters.js'

const FILTERS_STORAGE_KEY = 'dlhub_filters'

const getSavedLanguage = () => {
  return localStorage.getItem('dlhub_language') || 'english'
}

const getSavedFilters = () => {
  try {
    return normalizeFilters(JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY)))
  } catch {
    return DEFAULT_FILTERS
  }
}

// Номер последнего запроса: ответ более раннего (язык или фильтры успели смениться) отбрасываем.
let requestSeq = 0

export const useHeroStore = create((set, get) => ({
  heroes: [],
  loading: false,
  error: null,
  lastFetched: null,
  loadedKey: null,   // язык + фильтры, для которых загружен текущий список
  pendingKey: null,  // то же для запроса, который сейчас летит
  language: getSavedLanguage(),

  // Период и диапазон рангов — общие для всех страниц со статистикой
  filters: getSavedFilters(),

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

  setFilters: (patch) => {
    const current = get().filters
    const filters = normalizeFilters({ ...current, ...patch })
    if (filtersKey(filters) === filtersKey(current)) return

    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // не критично: фильтры просто не переживут перезагрузку
    }
    // Старый список остаётся на экране, пока грузится новый
    set({ filters })
    get().loadHeroes()
  },

  loadHeroes: async () => {
    const { language, filters, heroes, lastFetched, loadedKey, loading, pendingKey } = get()
    const key = `${language}|${filtersKey(filters)}`

    const isFresh = heroes.length && loadedKey === key && lastFetched && Date.now() - lastFetched < 5 * 60 * 1000
    if (isFresh) return
    if (loading && pendingKey === key) return

    const seq = ++requestSeq
    set({ loading: true, error: null, pendingKey: key })
    try {
      const next = await fetchHeroes(language, filters)
      if (seq !== requestSeq) return
      set({ heroes: next, loading: false, lastFetched: Date.now(), loadedKey: key, pendingKey: null })
    } catch (e) {
      if (seq !== requestSeq) return
      set({ error: e.message, loading: false, pendingKey: null })
    }
  },
}))
