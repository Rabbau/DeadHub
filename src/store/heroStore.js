import { create } from 'zustand'
import { fetchHeroes, fetchPatches } from '../api/index.js'
import {
  DEFAULT_FILTERS,
  PATCH_PERIOD,
  defaultFiltersFor,
  filtersKey,
  normalizeFilters,
} from '../services/statsFilters.js'
import { latestPatch } from '../services/patchService.js'

const FILTERS_STORAGE_KEY = 'dlhub_filters'
const SEEN_UPDATE_STORAGE_KEY = 'dlhub_seen_update'

// Сколько ждём список обновлений при первом визите, прежде чем принять фильтры по умолчанию.
// Если успели — по умолчанию берём «с патча» без лишнего перезапроса; если нет — остаёмся на 30 днях.
const PATCH_WAIT_MS = 1500

const getSavedLanguage = () => {
  return localStorage.getItem('dlhub_language') || 'english'
}

/** Сохранённые фильтры или null, если посетитель их ещё не выбирал. */
const readSavedFilters = () => {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
    return raw ? normalizeFilters(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

// Номер последнего запроса: ответ более раннего (язык или фильтры успели смениться) отбрасываем.
let requestSeq = 0
// Список обновлений и выбор фильтров по умолчанию — по одному запуску на всё приложение.
let patchPromise = null
let resolvePromise = null

const savedFilters = readSavedFilters()

const readSeenUpdate = () => {
  try {
    return localStorage.getItem(SEEN_UPDATE_STORAGE_KEY)
  } catch {
    return null
  }
}

export const useHeroStore = create((set, get) => ({
  heroes: [],
  loading: false,
  error: null,
  lastFetched: null,
  loadedKey: null,   // язык + фильтры, для которых загружен текущий список
  pendingKey: null,  // то же для запроса, который сейчас летит
  language: getSavedLanguage(),

  // Период и диапазон рангов — общие для всех страниц со статистикой
  filters: savedFilters ?? DEFAULT_FILTERS,
  defaultFilters: DEFAULT_FILTERS,           // к ним возвращает кнопка «Сброс»
  filtersChosen: savedFilters !== null,      // посетитель уже выбирал фильтры сам
  filtersReady: savedFilters !== null,       // можно запрашивать статистику
  patch: null,                               // последнее обновление игры: { id, title, at, link }
  seenUpdate: readSeenUpdate(),              // id обновления, которое посетитель уже открывал (значок NEW в меню)

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

  markUpdateSeen: (id) => {
    if (!id || get().seenUpdate === id) return
    try {
      localStorage.setItem(SEEN_UPDATE_STORAGE_KEY, id)
    } catch {
      // не критично: значок NEW появится снова при следующем визите
    }
    set({ seenUpdate: id })
  },

  /** Информация о последнем обновлении игры (один запрос на приложение, дальше из кеша). */
  loadPatch: () => {
    if (!patchPromise) {
      patchPromise = fetchPatches()
        .then((patches) => {
          const patch = latestPatch(patches)
          set({ patch, defaultFilters: defaultFiltersFor(patch) })

          // Выбран период «с патча», а вышло новое обновление — подтягиваем его время
          const { filters } = get()
          if (patch && filters.period === PATCH_PERIOD && filters.since !== patch.at) {
            get().setFilters({ period: PATCH_PERIOD })
          }
          return patch
        })
        .catch(() => {
          patchPromise = null // временный сбой: в следующий раз попробуем снова
          return null
        })
    }
    return patchPromise
  },

  /**
   * Определяет фильтры для первого визита (когда посетитель их ещё не выбирал) и открывает
   * загрузку статистики. Повторные вызовы возвращают тот же результат.
   */
  resolveFilters: () => {
    if (get().filtersReady) return Promise.resolve()
    if (!resolvePromise) {
      const timeout = new Promise((resolve) => setTimeout(resolve, PATCH_WAIT_MS))
      resolvePromise = Promise.race([get().loadPatch(), timeout]).then(() => {
        // Пока ждали, посетитель мог выбрать фильтры сам — его выбор важнее
        if (!get().filtersChosen) set({ filters: get().defaultFilters })
        set({ filtersReady: true })
      })
    }
    return resolvePromise
  },

  setFilters: (change) => {
    const { filters: current, patch } = get()
    const merged = { ...current, ...change }
    // Период «с патча» всегда привязываем к актуальному обновлению
    if (merged.period === PATCH_PERIOD) merged.since = patch?.at ?? merged.since
    const filters = normalizeFilters(merged)

    if (filtersKey(filters) === filtersKey(current)) {
      // Тот же выбор, но осознанный: перестаём подменять фильтры значениями по умолчанию
      if (!get().filtersChosen) set({ filtersChosen: true })
      return
    }

    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // не критично: фильтры просто не переживут перезагрузку
    }
    // Старый список остаётся на экране, пока грузится новый
    set({ filters, filtersChosen: true, filtersReady: true })
    get().loadHeroes()
  },

  /**
   * Загружает список героев со статистикой.
   * silent — фоновое обновление: экран не переходит в состояние «загрузка» и не тускнеет, а при сбое
   * остаётся прежний список (так обновляется полоса новых героев, пока страница открыта).
   */
  loadHeroes: async ({ silent = false } = {}) => {
    if (!get().filtersReady) await get().resolveFilters()

    const { language, filters, heroes, lastFetched, loadedKey, loading, pendingKey } = get()
    const key = `${language}|${filtersKey(filters)}`

    // Фоновое обновление приходит по таймеру раз в 5 минут: свежесть чуть меньше, чтобы оно не пропускалось
    const freshMs = (silent ? 4 : 5) * 60 * 1000
    const isFresh = heroes.length && loadedKey === key && lastFetched && Date.now() - lastFetched < freshMs
    if (isFresh) return
    if (loading && pendingKey === key) return

    const seq = ++requestSeq
    set(silent ? { pendingKey: key } : { loading: true, error: null, pendingKey: key })
    try {
      const next = await fetchHeroes(language, filters)
      if (seq !== requestSeq) return
      set({ heroes: next, loading: false, lastFetched: Date.now(), loadedKey: key, pendingKey: null })
    } catch (e) {
      if (seq !== requestSeq) return
      set(silent ? { pendingKey: null } : { error: e.message, loading: false, pendingKey: null })
    }
  },
}))
