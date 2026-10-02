import { describe, expect, it } from 'vitest'
import {
  GROUP_ORDER,
  SEARCH_PAGES,
  indexEntry,
  matchAction,
  matchScore,
  normalizeQuery,
  playerAction,
  searchEntries,
} from '../src/services/searchService.js'

describe('normalizeQuery', () => {
  it('lowercases, drops accents and turns punctuation into spaces', () => {
    expect(normalizeQuery('Mo & Krill')).toBe('mo krill')
    expect(normalizeQuery('High-Velocity Rounds')).toBe('high velocity rounds')
    expect(normalizeQuery('  Café  ')).toBe('cafe')
    expect(normalizeQuery("Lady Geist's")).toBe('lady geist s')
  })

  it('treats ё as е and keeps Cyrillic letters', () => {
    expect(normalizeQuery('Ёж')).toBe(normalizeQuery('еж'))
    expect(normalizeQuery('Тир-лист')).toBe('тир лист')
  })

  it('survives empty and odd input', () => {
    expect(normalizeQuery('')).toBe('')
    expect(normalizeQuery(null)).toBe('')
    expect(normalizeQuery(undefined)).toBe('')
    expect(normalizeQuery(12345)).toBe('12345')
  })
})

describe('matchScore', () => {
  it('ranks exact > start of the name > start of a word > inside a word > no match', () => {
    const q = 'rem'
    const scores = [matchScore('rem', q), matchScore('remnant', q), matchScore('wraith rem', q), matchScore('supremacy', q), matchScore('abrams', q)]
    expect(scores[0]).toBeGreaterThan(scores[1])
    expect(scores[1]).toBeGreaterThan(scores[2])
    expect(scores[2]).toBeGreaterThan(scores[3])
    expect(scores[3]).toBeGreaterThan(0)
    expect(scores[4]).toBe(0)
  })

  it('needs every word of a multi-word query', () => {
    expect(matchScore('mo krill', 'mo k')).toBeGreaterThan(0)
    expect(matchScore('mo krill', 'krill mo')).toBeGreaterThan(0)
    expect(matchScore('mo krill', 'mo x')).toBe(0)
  })

  it('has no match for an empty query', () => {
    expect(matchScore('abrams', '')).toBe(0)
  })
})

describe('searchEntries', () => {
  const entries = [
    { type: 'hero', id: 1, name: 'Abrams', to: '/hero/1' },
    { type: 'hero', id: 2, name: 'Bebop', to: '/hero/2' },
    { type: 'hero', id: 3, name: 'Mo & Krill', to: '/hero/3' },
    { type: 'item', id: 10, name: 'Mystic Shot', to: '/items/10' },
    { type: 'item', id: 11, name: 'Extra Spirit', to: '/items/11' },
    { type: 'item', id: 12, name: 'Spirit Strike', to: '/items/12' },
    { type: 'page', id: '/items', name: 'Items', to: '/items' },
    { type: 'page', id: '/map', name: 'Map', to: '/map' },
  ].map(indexEntry)

  it('groups results in a fixed order: heroes, items, pages', () => {
    const groups = searchEntries(entries, 'm')
    expect(groups.map((g) => g.type)).toEqual(['hero', 'item', 'page'])
    expect(groups.map((g) => g.type)).toEqual(GROUP_ORDER.filter((t) => groups.some((g) => g.type === t)))
  })

  it('puts the better match first inside a group', () => {
    const items = searchEntries(entries, 'spirit').find((g) => g.type === 'item').results
    expect(items.map((i) => i.name)).toEqual(['Spirit Strike', 'Extra Spirit']) // начало названия лучше слова внутри
  })

  it('finds a hero by a typed fragment with different spelling', () => {
    expect(searchEntries(entries, 'mo & k')[0].results[0].name).toBe('Mo & Krill')
    expect(searchEntries(entries, 'ABR')[0].results[0].name).toBe('Abrams')
  })

  it('returns nothing for an empty or hopeless query', () => {
    expect(searchEntries(entries, '')).toEqual([])
    expect(searchEntries(entries, '   ')).toEqual([])
    expect(searchEntries(entries, 'zzzzzz')).toEqual([])
  })

  it('caps every group', () => {
    const many = Array.from({ length: 20 }, (_, i) => indexEntry({ type: 'item', id: i, name: `Item ${i}`, to: `/items/${i}` }))
    expect(searchEntries(many, 'item')[0].results).toHaveLength(6)
    expect(searchEntries(many, 'item', { item: 3 })[0].results).toHaveLength(3)
  })
})

describe('playerAction', () => {
  it('opens the profile for an Account ID, a SteamID64 and a profile link', () => {
    expect(playerAction('123456789')).toEqual({ kind: 'open', id: 123456789, to: '/player/123456789' })
    expect(playerAction('76561197960265728')).toMatchObject({ kind: 'search' }) // Account ID 0 — не игрок, остаётся поиск по тексту
    expect(playerAction('76561198083722517')).toMatchObject({ kind: 'open', id: 123456789 })
    expect(playerAction('https://steamcommunity.com/profiles/76561198083722517')).toMatchObject({ kind: 'open', id: 123456789 })
  })

  it('searches by nickname from two characters and escapes the query', () => {
    expect(playerAction('Rabbau')).toEqual({ kind: 'search', query: 'Rabbau', to: '/players?q=Rabbau' })
    expect(playerAction('a b&c')).toEqual({ kind: 'search', query: 'a b&c', to: '/players?q=a%20b%26c' })
  })

  it('does nothing for a single character or nothing', () => {
    expect(playerAction('a')).toBeNull()
    expect(playerAction('')).toBeNull()
    expect(playerAction(undefined)).toBeNull()
  })
})

describe('matchAction', () => {
  it('offers a match for a long number', () => {
    expect(matchAction('109064028')).toEqual({ id: 109064028, to: '/match/109064028' })
    expect(matchAction(' 109064028 ')).toEqual({ id: 109064028, to: '/match/109064028' })
    expect(matchAction('0000123456')).toEqual({ id: 123456, to: '/match/123456' })
  })

  it('stays out of the way of nicknames, short numbers and SteamID64', () => {
    expect(matchAction('Rabbau')).toBeNull()
    expect(matchAction('12345')).toBeNull()
    expect(matchAction('76561198083722517')).toBeNull()
    expect(matchAction('1090 64028')).toBeNull()
    expect(matchAction('109064028x')).toBeNull()
    expect(matchAction('')).toBeNull()
    expect(matchAction(undefined)).toBeNull()
  })

  it('goes alongside the player action for an Account ID-like number', () => {
    expect(playerAction('109064028')).toMatchObject({ kind: 'open', to: '/player/109064028' })
    expect(matchAction('109064028')).not.toBeNull()
  })
})

describe('SEARCH_PAGES', () => {
  it('lists unique addresses', () => {
    expect(new Set(SEARCH_PAGES.map((p) => p.to)).size).toBe(SEARCH_PAGES.length)
  })
})
