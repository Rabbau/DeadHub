import { describe, expect, it } from 'vitest'
import now from './fixtures/hero-stats-now.json'
import { slimHeroStats } from '../src/api/heroApi.js'
import {
  MIN_GAMES_FLOOR,
  SCORE_WEIGHTS,
  TIER_ORDER,
  TIER_SHARES,
  buildTierList,
  minGamesFor,
  percentileRanks,
  tierSizes,
} from '../src/services/tierService.js'

const hero = (id, name, winrate, games, pickrate = games / 100000, released = true) => ({
  id, name, released, stats: { winrate, pickrate, games_played: games },
})

describe('formula constants', () => {
  it('weights and tier shares each add up to one', () => {
    expect(SCORE_WEIGHTS.winrate + SCORE_WEIGHTS.pickrate).toBeCloseTo(1, 10)
    expect(TIER_SHARES.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(TIER_SHARES).toHaveLength(TIER_ORDER.length)
  })
})

describe('percentileRanks', () => {
  it('maps the smallest value to 0 and the biggest to 1', () => {
    expect(percentileRanks([10, 30, 20])).toEqual([0, 1, 0.5])
  })

  it('gives equal values the same shared rank', () => {
    expect(percentileRanks([5, 5, 9])).toEqual([0.25, 0.25, 1])
  })

  it('handles empty and single inputs', () => {
    expect(percentileRanks([])).toEqual([])
    expect(percentileRanks([42])).toEqual([0.5])
  })
})

describe('tierSizes', () => {
  it('splits 38 heroes 4/7/16/7/4', () => {
    expect(tierSizes(38)).toEqual([4, 7, 16, 7, 4])
  })

  it('never loses or duplicates a hero', () => {
    for (let n = 0; n <= 60; n++) expect(tierSizes(n).reduce((a, b) => a + b, 0)).toBe(n)
  })

  it('keeps small lists sensible', () => {
    expect(tierSizes(5)).toEqual([1, 1, 2, 1, 0])
    expect(tierSizes(0)).toEqual([0, 0, 0, 0, 0])
  })
})

describe('minGamesFor', () => {
  it('is a share of all picks with a floor', () => {
    expect(minGamesFor(1_000_000)).toBe(4000)
    expect(minGamesFor(100)).toBe(MIN_GAMES_FLOOR)
  })
})

describe('buildTierList', () => {
  it('puts the strongest hero (win rate and pick rate) into S and the weakest into D', () => {
    const heroes = [
      hero(1, 'Strong', 0.56, 90000),
      hero(2, 'Mid A', 0.51, 50000), hero(3, 'Mid B', 0.50, 50000), hero(4, 'Mid C', 0.50, 40000),
      hero(5, 'Mid D', 0.49, 40000), hero(6, 'Mid E', 0.52, 30000), hero(7, 'Mid F', 0.48, 30000),
      hero(8, 'Mid G', 0.505, 30000), hero(9, 'Mid H', 0.495, 20000),
      hero(10, 'Weak', 0.44, 10000),
    ]
    const list = buildTierList(heroes)
    expect(list.tiers.S[0].hero.name).toBe('Strong')
    expect(list.tiers.D.map((e) => e.hero.name)).toContain('Weak')
    expect(list.ranked.map((e) => e.rank)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1))
    expect(Object.values(list.tiers).flat()).toHaveLength(10)
  })

  it('weighs win rate four times as much as pick rate', () => {
    // «Любимчик» — самый популярный, но с худшим винрейтом; «Скромник» — самый успешный, но редкий
    const heroes = [
      hero(1, 'Popular', 0.46, 80000, 0.4),
      hero(2, 'Quiet', 0.58, 20000, 0.1),
      hero(3, 'Average', 0.52, 50000, 0.25),
    ]
    const list = buildTierList(heroes)
    const order = list.ranked.map((e) => e.hero.name)
    expect(order.indexOf('Quiet')).toBeLessThan(order.indexOf('Popular'))
    const quiet = list.ranked.find((e) => e.hero.name === 'Quiet')
    expect(quiet.score).toBeCloseTo(0.8 * 1 + 0.2 * 0, 10)
  })

  it('leaves heroes with too few matches out of the tiers', () => {
    const heroes = [hero(1, 'A', 0.55, 90000), hero(2, 'B', 0.5, 90000), hero(3, 'Tiny', 0.9, 20), hero(4, 'None', 0, 0)]
    const list = buildTierList(heroes)
    expect(list.excluded.map((h) => h.name).sort()).toEqual(['None', 'Tiny'])
    expect(Object.values(list.tiers).flat().map((e) => e.hero.name)).not.toContain('Tiny')
    expect(list.minGames).toBe(minGamesFor(180020))
  })

  it('ignores heroes that are not released and handles an empty list', () => {
    const list = buildTierList([hero(1, 'Soon', 0.5, 90000, 0.1, false), hero(2, 'Out', 0.5, 90000)])
    expect(list.ranked.map((e) => e.hero.name)).toEqual(['Out'])
    const empty = buildTierList([])
    expect(empty.ranked).toEqual([])
    expect(empty.spread).toBeNull()
  })

  it('reports the win rate spread so tiers are not mistaken for absolute strength', () => {
    const list = buildTierList([hero(1, 'A', 0.55, 90000), hero(2, 'B', 0.47, 90000), hero(3, 'C', 0.51, 90000)])
    expect(list.spread).toEqual({ best: 0.55, worst: 0.47 })
  })

  it('is deterministic: ties are broken by win rate and then by name', () => {
    const heroes = [hero(1, 'B', 0.5, 10000, 0.1), hero(2, 'A', 0.5, 10000, 0.1)]
    expect(buildTierList(heroes).ranked.map((e) => e.hero.name)).toEqual(['A', 'B'])
  })

  it('on a real hero-stats response puts 38 heroes into 4/7/16/7/4 tiers', () => {
    const stats = slimHeroStats(now)
    const heroes = Object.entries(stats.byHero).map(([id, s]) => ({
      id: Number(id),
      name: `Hero ${id}`,
      released: true,
      stats: { winrate: s.wins / s.matches, pickrate: s.matches / stats.total, games_played: s.matches },
    }))
    const list = buildTierList(heroes)
    expect(TIER_ORDER.map((tier) => list.tiers[tier].length)).toEqual([4, 7, 16, 7, 4])
    expect(list.excluded).toEqual([])
    expect(list.spread.best).toBeGreaterThan(list.spread.worst)
    // Лучший по оценке не может быть хуже среднего по винрейту: на винрейт приходится 80% оценки
    const meanWr = heroes.reduce((a, h) => a + h.stats.winrate, 0) / heroes.length
    expect(list.ranked[0].hero.stats.winrate).toBeGreaterThan(meanWr)
  })
})
