import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAVORITES_LIMITS, addPlayer, normalizeFavorites, refreshPlayer, removePlayer, toggleHero } from '../src/services/favoritesService.js'
import { CARD_STRIP, CARD_WINDOW, summarizeForCard } from '../src/services/favoritesCardService.js'

const player = (id, extra = {}) => ({ id, name: `Player ${id}`, avatar: `https://avatars.example/${id}.jpg`, ...extra })

describe('normalizeFavorites', () => {
  it('keeps valid players and heroes', () => {
    const result = normalizeFavorites({ players: [player(5), player(9)], heroes: [13, 25] })
    expect(result.players.map((p) => p.id)).toEqual([5, 9])
    expect(result.heroes).toEqual([13, 25])
  })

  it('survives anything that is not the expected shape', () => {
    for (const bad of [null, undefined, 42, 'text', [], { players: 'no', heroes: {} }]) {
      expect(normalizeFavorites(bad), String(bad)).toEqual({ players: [], heroes: [] })
    }
  })

  it('drops invalid ids, duplicates and entries that are not objects', () => {
    const result = normalizeFavorites({
      players: [player(5), player(5), null, 'x', { id: -1 }, { id: 1.5 }, { id: '7' }, { id: 2 ** 40 }, { name: 'no id' }],
      heroes: [13, 13, -2, 0, '5', 1.5, null, 2_000_000],
    })
    expect(result.players.map((p) => p.id)).toEqual([5])
    expect(result.heroes).toEqual([13])
  })

  it('cleans names and refuses avatars that are not https links', () => {
    const [clean] = normalizeFavorites({ players: [{ id: 3, name: '  Name  ', avatar: 'javascript:alert(1)' }] }).players
    expect(clean).toEqual({ id: 3, name: 'Name', avatar: null })
    expect(normalizeFavorites({ players: [{ id: 3, name: 'x'.repeat(500), avatar: 'http://insecure/a.jpg' }] }).players[0]).toMatchObject({ avatar: null })
    expect(normalizeFavorites({ players: [{ id: 3, name: 'x'.repeat(500) }] }).players[0].name).toHaveLength(64)
    expect(normalizeFavorites({ players: [{ id: 3, name: '   ' }] }).players[0].name).toBeNull()
  })

  it('cuts the lists to the limits', () => {
    const many = normalizeFavorites({ players: Array.from({ length: 40 }, (_, i) => player(i + 1)), heroes: Array.from({ length: 200 }, (_, i) => i + 1) })
    expect(many.players).toHaveLength(FAVORITES_LIMITS.players)
    expect(many.heroes).toHaveLength(FAVORITES_LIMITS.heroes)
  })
})

describe('addPlayer / removePlayer', () => {
  it('puts a new player first', () => {
    const { players, result } = addPlayer([player(1)], player(2))
    expect(result).toBe('added')
    expect(players.map((p) => p.id)).toEqual([2, 1])
  })

  it('does not add twice', () => {
    const start = [player(1)]
    const { players, result } = addPlayer(start, player(1))
    expect(result).toBe('exists')
    expect(players).toBe(start)
  })

  it('refuses to push someone out when the list is full', () => {
    const start = Array.from({ length: FAVORITES_LIMITS.players }, (_, i) => player(i + 1))
    const { players, result } = addPlayer(start, player(999))
    expect(result).toBe('full')
    expect(players).toBe(start)
  })

  it('refuses garbage', () => {
    expect(addPlayer([], { id: 'x' }).result).toBe('invalid')
    expect(addPlayer([], null).result).toBe('invalid')
  })

  it('removes by id', () => {
    expect(removePlayer([player(1), player(2)], 1).map((p) => p.id)).toEqual([2])
    expect(removePlayer([player(1)], 5)).toHaveLength(1)
  })
})

describe('refreshPlayer', () => {
  it('updates a changed name and avatar of a favourite', () => {
    const list = [player(1, { name: 'Old' })]
    expect(refreshPlayer(list, player(1, { name: 'New' }))[0].name).toBe('New')
  })

  it('returns the same list when nothing changed or the player is not a favourite', () => {
    const list = [player(1)]
    expect(refreshPlayer(list, player(1))).toBe(list)
    expect(refreshPlayer(list, player(2))).toBe(list)
    expect(refreshPlayer(list, { id: 'bad' })).toBe(list)
  })

  it('does not erase a known name with an empty one', () => {
    const list = [player(1, { name: 'Known' })]
    expect(refreshPlayer(list, { id: 1, name: null, avatar: 'https://avatars.example/new.jpg' })[0]).toMatchObject({ name: 'Known', avatar: 'https://avatars.example/new.jpg' })
  })
})

describe('toggleHero', () => {
  it('adds and removes', () => {
    const added = toggleHero([13], 25)
    expect(added).toEqual({ heroes: [13, 25], result: 'added' })
    expect(toggleHero(added.heroes, 13)).toEqual({ heroes: [25], result: 'removed' })
  })

  it('takes the id as a number or a string from the address', () => {
    expect(toggleHero([], '25').heroes).toEqual([25])
  })

  it('stops at the limit and ignores garbage', () => {
    const full = Array.from({ length: FAVORITES_LIMITS.heroes }, (_, i) => i + 1)
    expect(toggleHero(full, 999).result).toBe('full')
    expect(toggleHero(full, 1).result).toBe('removed') // убрать можно и из полного списка
    expect(toggleHero([], 'abc').result).toBe('invalid')
    expect(toggleHero([], -1).result).toBe('invalid')
  })
})

let counter = 0
const m = (win, overrides = {}) => {
  counter += 1
  return { id: counter, heroId: 13, at: 9_000_000 - counter * 100, win, kills: 6, deaths: 4, assists: 8, mode: 4, gameMode: 1, badge: null, ...overrides }
}

describe('summarizeForCard', () => {
  it('shows when the player last played, the last five results and the form over twenty matches', () => {
    const history = [m(true), m(false), m(true), m(true), m(false), ...Array.from({ length: 25 }, () => m(false))]
    const card = summarizeForCard(history)
    expect(card.lastMatchAt).toBe(history[0].at)
    expect(card.results).toEqual([true, false, true, true, false].slice(0, CARD_STRIP))
    expect(card.recent.matches).toBe(CARD_WINDOW)
    expect(card.recent.wins).toBe(3)
  })

  it('does not count bots and custom games, but counts every game mode', () => {
    const history = [m(true, { mode: 3 }), m(true, { mode: 2 }), m(false, { gameMode: 4, mode: 1 }), m(true)]
    const card = summarizeForCard(history)
    expect(card.recent.matches).toBe(2)
    expect(card.results).toEqual([false, true])
  })

  it('takes the freshest badge and the current streak', () => {
    const history = [m(true), m(true, { badge: 61 }), m(true, { badge: 55 }), m(false)]
    const card = summarizeForCard(history)
    expect(card.badge).toBe(61)
    expect(card.streak).toEqual({ win: true, length: 3 })
  })

  it('lists the heroes played most in those matches', () => {
    const history = [m(true, { heroId: 2 }), m(true, { heroId: 5 }), m(true, { heroId: 5 }), m(true, { heroId: 5 }), m(true, { heroId: 2 }), m(true, { heroId: 9 }), m(true, { heroId: 7 })]
    expect(summarizeForCard(history).heroes).toEqual([5, 2, 7]) // при равенстве — по id
  })

  it('is empty for no history', () => {
    expect(summarizeForCard([])).toMatchObject({ lastMatchAt: null, results: [], badge: null, streak: null, heroes: [] })
    expect(summarizeForCard(undefined).results).toEqual([])
  })
})

// zustand/persist берёт хранилище из window.localStorage при создании: в Node его нет, поэтому до импорта подставляем замену
const memory = new Map()
const storage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)) },
  removeItem: (key) => { memory.delete(key) },
}

describe('favorites store', () => {
  let useFavoritesStore
  beforeAll(async () => {
    vi.stubGlobal('window', { localStorage: storage })
    ;({ useFavoritesStore } = await import('../src/store/favoritesStore.js'))
  })
  beforeEach(() => {
    useFavoritesStore.getState().clear()
    memory.clear()
  })
  const state = () => useFavoritesStore.getState()

  it('adds, removes and saves players', () => {
    expect(state().togglePlayer(player(5))).toBe('added')
    expect(state().players.map((p) => p.id)).toEqual([5])
    expect(JSON.parse(memory.get('dlhub_favorites')).state.players[0].id).toBe(5)
    expect(state().togglePlayer(player(5))).toBe('removed')
    expect(state().players).toEqual([])
  })

  it('reports a full list instead of dropping somebody', () => {
    for (let i = 1; i <= FAVORITES_LIMITS.players; i++) state().togglePlayer(player(i))
    expect(state().togglePlayer(player(999))).toBe('full')
    expect(state().players).toHaveLength(FAVORITES_LIMITS.players)
  })

  it('toggles heroes', () => {
    expect(state().toggleHero(13)).toBe('added')
    expect(state().heroes).toEqual([13])
    expect(state().toggleHero(13)).toBe('removed')
    expect(state().toggleHero('abc')).toBe('invalid')
    expect(state().heroes).toEqual([])
  })

  it('refreshes a name only for a favourite and leaves the list alone otherwise', () => {
    state().togglePlayer(player(5, { name: 'Old' }))
    const before = state().players
    state().refreshPlayer(player(7, { name: 'Stranger' }))
    expect(state().players).toBe(before)
    state().refreshPlayer(player(5, { name: 'New' }))
    expect(state().players[0].name).toBe('New')
  })

  it('does not trust what it reads back from the browser', async () => {
    memory.set('dlhub_favorites', JSON.stringify({ state: { players: [player(5), { id: 'x' }, null], heroes: [13, 'bad', -1] }, version: 1 }))
    await useFavoritesStore.persist.rehydrate()
    expect(state().players.map((p) => p.id)).toEqual([5])
    expect(state().heroes).toEqual([13])
  })
})
