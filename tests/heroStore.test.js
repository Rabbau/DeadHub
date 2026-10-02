import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Хранилище читает localStorage при создании: в Node его нет, поэтому подставляем простую замену до импорта
const memory = new Map()
const storage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)) },
  removeItem: (key) => { memory.delete(key) },
  key: (index) => [...memory.keys()][index] ?? null,
  get length() { return memory.size },
}

vi.mock('../src/api/index.js', () => ({
  fetchHeroes: vi.fn(async () => []),
  fetchPatches: vi.fn(async () => []),
}))

let useHeroStore
let fetchHeroes

beforeAll(async () => {
  vi.stubGlobal('localStorage', storage)
  ;({ useHeroStore } = await import('../src/store/heroStore.js'))
  ;({ fetchHeroes } = await import('../src/api/index.js'))
})

const saved = () => JSON.parse(memory.get('dlhub_filters'))
const state = () => useHeroStore.getState()

describe('shared filters in the store', () => {
  beforeEach(() => {
    fetchHeroes.mockClear()
    // Каждый тест начинается с фильтров по умолчанию (30 дней, все ранги, обычные матчи)
    useHeroStore.setState({ filters: { period: 30, rankMin: 1, rankMax: 11 }, defaultFilters: { period: 30, rankMin: 1, rankMax: 11 }, filtersChosen: false, filtersReady: true, patch: null })
    memory.clear()
  })

  it('switches to Street Brawl, saves it and asks the API for that mode', async () => {
    state().setFilters({ mode: 'street_brawl' })
    expect(state().filters.mode).toBe('street_brawl')
    expect(saved().mode).toBe('street_brawl')
    await vi.waitFor(() => expect(fetchHeroes).toHaveBeenCalledTimes(1))
    expect(fetchHeroes.mock.calls[0][1]).toMatchObject({ mode: 'street_brawl' })
  })

  it('does not refetch when only the rank changes in Street Brawl (the API ignores it there)', async () => {
    state().setFilters({ mode: 'street_brawl' })
    await vi.waitFor(() => expect(fetchHeroes).toHaveBeenCalledTimes(1))
    state().setFilters({ rankMin: 5, rankMax: 8 })
    expect(state().filters).toMatchObject({ mode: 'street_brawl', rankMin: 5, rankMax: 8 }) // диапазон помним
    await Promise.resolve()
    expect(fetchHeroes).toHaveBeenCalledTimes(1)
  })

  it('brings the remembered rank back when returning to normal matches', async () => {
    state().setFilters({ rankMin: 9, rankMax: 10 })
    state().setFilters({ mode: 'street_brawl' })
    state().setFilters({ mode: 'normal' })
    expect(state().filters).toEqual({ period: 30, rankMin: 9, rankMax: 10 })
    expect('mode' in saved()).toBe(false)
  })

  it('«Reset» also leaves Street Brawl (setFilters(defaults) alone could not)', () => {
    state().setFilters({ mode: 'street_brawl', rankMin: 9, rankMax: 10, period: 7 })
    state().resetFilters()
    expect(state().filters).toEqual({ period: 30, rankMin: 1, rankMax: 11 })
    expect('mode' in saved()).toBe(false)
  })
})

// «Блокировать все cookie и данные сайтов» (и sandbox-окно без allow-same-origin): любое обращение к localStorage
// бросает SecurityError. Стор читает язык при загрузке модуля — раньше это роняло весь бандл (белый экран)
describe('when access to localStorage is denied', () => {
  const blocked = {
    get length() { throw new DOMException('Access is denied for this document.', 'SecurityError') },
    getItem() { throw new DOMException('Access is denied for this document.', 'SecurityError') },
    setItem() { throw new DOMException('Access is denied for this document.', 'SecurityError') },
    removeItem() { throw new DOMException('Access is denied for this document.', 'SecurityError') },
    key() { throw new DOMException('Access is denied for this document.', 'SecurityError') },
  }

  async function loadBlockedStore() {
    vi.resetModules()
    vi.stubGlobal('localStorage', blocked)
    try {
      return (await import('../src/store/heroStore.js')).useHeroStore
    } finally {
      vi.stubGlobal('localStorage', storage)
    }
  }

  it('still creates the store and starts in English', async () => {
    const store = await loadBlockedStore()
    expect(store.getState().language).toBe('english')
    expect(store.getState().filtersReady).toBe(false) // сохранённых фильтров нет — как у нового посетителя
  })

  it('switches the language even though it cannot be remembered', async () => {
    const store = await loadBlockedStore()
    vi.stubGlobal('localStorage', blocked)
    try {
      expect(() => store.getState().setLanguage('russian')).not.toThrow()
      expect(store.getState().language).toBe('russian')
    } finally {
      vi.stubGlobal('localStorage', storage)
    }
  })

  it('keeps changing filters without remembering them', async () => {
    const store = await loadBlockedStore()
    store.setState({ filters: { period: 30, rankMin: 1, rankMax: 11 }, filtersReady: true, patch: null })
    vi.stubGlobal('localStorage', blocked)
    try {
      expect(() => store.getState().setFilters({ rankMin: 5, rankMax: 8 })).not.toThrow()
      expect(store.getState().filters).toMatchObject({ rankMin: 5, rankMax: 8 })
    } finally {
      vi.stubGlobal('localStorage', storage)
    }
  })
})
