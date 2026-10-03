import { describe, expect, it } from 'vitest'
import {
  RECENT_MIN, SHARED_HERO_LIMIT, compareRows, parseAccountParam, playerSnapshot, sharedHeroes, tally,
} from '../src/services/playersCompareService.js'

let counter = 0
const match = (win, overrides = {}) => {
  counter += 1
  return { id: counter, heroId: 13, at: 5_000_000 - counter * 100, duration: 1800, kills: 6, deaths: 4, assists: 8, win, mode: 4, gameMode: 1, delta: null, badge: null, abandoned: false, ...overrides }
}
const heroRow = (heroId, matches, wins) => ({ heroId, matches, wins, kills: matches * 6, deaths: matches * 4, assists: matches * 8, accuracy: 0.4, lastPlayed: 1 })

describe('parseAccountParam', () => {
  it('takes digits only', () => {
    expect(parseAccountParam('898786482')).toBe(898786482)
    expect(parseAccountParam('12')).toBe(12)
  })

  it('rejects everything else, including zero and too long numbers', () => {
    for (const bad of [null, undefined, '', 'abc', '12abc', '-5', '1.5', '0', '12345678901', ' 12']) expect(parseAccountParam(bad), String(bad)).toBeNull()
  })
})

describe('playerSnapshot', () => {
  const steam = { id: 7, name: 'Real_wiffy', avatar: 'https://example/a.jpg' }
  const heroStats = [heroRow(13, 30, 18), heroRow(2, 10, 4)]

  it('takes totals from the hero statistics, form from the latest matches and rank from the rank endpoint', () => {
    const history = Array.from({ length: 25 }, (_, i) => match(i < 15))
    const snap = playerSnapshot(7, { steam, rank: { badge: 53 }, history, heroStats })
    expect(snap).toMatchObject({ id: 7, name: 'Real_wiffy', badge: 53, matches: 40, lastMatchAt: history[0].at })
    expect(snap.winrate).toBeCloseTo(22 / 40)
    expect(snap.recent).toMatchObject({ matches: 20 })
    expect(snap.recent.winrate).toBeCloseTo(0.75)
    expect(snap.heroes).toBe(heroStats)
  })

  it('falls back to the last ranked match for the rank, and to history for the number of matches', () => {
    const history = [match(true), match(false, { badge: 61 })]
    const snap = playerSnapshot(7, { steam: null, rank: null, history, heroStats: [] })
    expect(snap.badge).toBe(61)
    expect(snap.matches).toBe(2)
    expect(snap.name).toBe('#7')
    expect(snap.winrate).toBeNull()
    expect(snap.kda).toBeNull()
  })

  it('does not show form built on a handful of matches', () => {
    const history = Array.from({ length: RECENT_MIN - 1 }, () => match(true))
    expect(playerSnapshot(7, { steam, rank: null, history, heroStats }).recent).toBeNull()
  })

  it('counts form only over matches that go into the statistics', () => {
    const history = [...Array.from({ length: 10 }, () => match(true)), ...Array.from({ length: 30 }, () => match(false, { mode: 3 }))]
    expect(playerSnapshot(7, { steam, rank: null, history, heroStats }).recent.matches).toBe(10)
  })
})

describe('compareRows', () => {
  const snap = (overrides) => ({ id: 1, name: 'x', avatar: null, badge: 53, matches: 100, winrate: 0.5, kda: 2, accuracy: 0.4, recent: { matches: 20, winrate: 0.5, kda: 2 }, lastMatchAt: 1000, heroes: [], ...overrides })
  const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]))

  it('marks who is ahead where higher is better', () => {
    const rows = byKey(compareRows(snap({ badge: 61, winrate: 0.56, kda: 2.5 }), snap({ badge: 53, winrate: 0.5, kda: 2 })))
    expect(rows.rank.lead).toBe('a')
    expect(rows.winrate.lead).toBe('a')
    expect(rows.kda.lead).toBe('a')
    const reversed = byKey(compareRows(snap({ winrate: 0.4 }), snap({ winrate: 0.5 })))
    expect(reversed.winrate.lead).toBe('b')
  })

  it('does not mark the number of matches or the last match date: more is not better', () => {
    const rows = byKey(compareRows(snap({ matches: 900, lastMatchAt: 5000 }), snap({ matches: 10, lastMatchAt: 10 })))
    expect(rows.matches.lead).toBeNull()
    expect(rows.lastMatch.lead).toBeNull()
    expect(rows.matches.a).toBe(900)
  })

  it('treats a difference below the noise threshold as a tie', () => {
    const rows = byKey(compareRows(snap({ winrate: 0.502, kda: 2.02 }), snap({ winrate: 0.5, kda: 2 })))
    expect(rows.winrate.lead).toBeNull()
    expect(rows.kda.lead).toBeNull()
  })

  it('leaves a row without a leader when one player has no data for it', () => {
    const rows = byKey(compareRows(snap({ recent: null, badge: null }), snap({})))
    expect(rows.recentWinrate).toMatchObject({ a: null, lead: null })
    expect(rows.rank).toMatchObject({ a: null, lead: null })
  })

  it('counts a row in the score only when more means better and both players have data', () => {
    const scored = (rows) => rows.filter((r) => r.scored).map((r) => r.key)
    expect(scored(compareRows(snap({}), snap({})))).toEqual(['rank', 'winrate', 'kda', 'accuracy', 'recentWinrate', 'recentKda'])
    expect(scored(compareRows(snap({ recent: null, badge: null }), snap({})))).toEqual(['winrate', 'kda', 'accuracy'])
  })

  it('always returns the same rows in the same order', () => {
    expect(compareRows(snap({}), snap({})).map((r) => r.key)).toEqual(['rank', 'matches', 'winrate', 'kda', 'accuracy', 'recentWinrate', 'recentKda', 'lastMatch'])
  })
})

describe('sharedHeroes', () => {
  it('lists heroes both have played enough, with who does better', () => {
    const rows = sharedHeroes([heroRow(1, 20, 14), heroRow(2, 10, 5), heroRow(3, 30, 15)], [heroRow(1, 10, 4), heroRow(2, 12, 6), heroRow(4, 9, 9)])
    expect(rows.map((r) => r.heroId)).toEqual([1, 2])
    expect(rows[0]).toMatchObject({ lead: 'a' })
    expect(rows[0].a.winrate).toBeCloseTo(0.7)
    expect(rows[0].b.winrate).toBeCloseTo(0.4)
    expect(rows[1].lead).toBeNull() // 50% и 50%
  })

  it('skips heroes where either player has fewer than the minimum matches', () => {
    expect(sharedHeroes([heroRow(1, 2, 2)], [heroRow(1, 30, 15)])).toEqual([])
    expect(sharedHeroes([heroRow(1, 30, 15)], [heroRow(1, 2, 2)])).toEqual([])
  })

  it('shows the most played heroes first and no more than the limit', () => {
    const left = Array.from({ length: 12 }, (_, i) => heroRow(i + 1, 5 + i, 2))
    const right = left.map((r) => ({ ...r }))
    const rows = sharedHeroes(left, right)
    expect(rows).toHaveLength(SHARED_HERO_LIMIT)
    expect(rows[0].heroId).toBe(12)
  })
})

describe('tally', () => {
  it('counts the rows each side leads', () => {
    expect(tally([{ lead: 'a' }, { lead: 'a' }, { lead: 'b' }, { lead: null }])).toEqual({ a: 2, b: 1, lead: 'a' })
    expect(tally([{ lead: 'b' }])).toMatchObject({ lead: 'b' })
  })

  it('is a draw when both lead equally often or no one leads', () => {
    expect(tally([{ lead: 'a' }, { lead: 'b' }]).lead).toBeNull()
    expect(tally([]).lead).toBeNull()
  })
})
