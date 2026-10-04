import { describe, expect, it } from 'vitest'
import {
  COMPARE_STATS,
  MAX_COMPARED,
  RADAR_FLOOR,
  compareStats,
  filterPicker,
  formatPerLevel,
  formatStat,
  heroMeta,
  nextSelection,
  pickSelected,
  radarAxes,
  radarLevel,
  radarPoint,
} from '../src/services/compareService.js'

const hero = (id, name, stats = {}, extra = {}) => ({
  id,
  name,
  role: 'Brawler',
  complexity: 2,
  stats: {
    winrate: 0.5,
    pickrate: 0.03,
    games_played: 100,
    maxHealth: 800,
    maxMoveSpeed: 7,
    sprintSpeed: 1,
    stamina: 3,
    heavyMeleeDamage: 100,
    lightMeleeDamage: 50,
    ...stats,
  },
  levelScaling: { healthPerLevel: 40, meleeDamagePerLevel: 1.5 },
  ...extra,
})

describe('nextSelection', () => {
  it('adds a hero while there is room, keeping the order of picking', () => {
    expect(nextSelection([], 5)).toEqual([5])
    expect(nextSelection([5, 9], 2)).toEqual([5, 9, 2])
  })

  it('removes a hero that is already selected', () => {
    expect(nextSelection([5, 9, 2], 9)).toEqual([5, 2])
  })

  it('pushes out the oldest pick when there is no room', () => {
    expect(MAX_COMPARED).toBe(3)
    expect(nextSelection([5, 9, 2], 7)).toEqual([9, 2, 7])
  })
})

describe('pickSelected', () => {
  const heroes = [hero(1, 'A'), hero(2, 'B'), hero(3, 'C')]

  it('keeps the order of picking, not the order of the list', () => {
    expect(pickSelected(heroes, [3, 1]).map((h) => h.id)).toEqual([3, 1])
  })

  it('skips ids that are not in the list (hero left the game, stale storage)', () => {
    expect(pickSelected(heroes, [2, 99]).map((h) => h.id)).toEqual([2])
  })
})

describe('filterPicker', () => {
  const heroes = [hero(1, 'Abrams'), hero(2, 'Haze', {}, { role: 'Assassin' }), hero(3, 'Haze Twin', {}, { role: 'Mystic' })]

  it('searches by name ignoring case and surrounding spaces', () => {
    expect(filterPicker(heroes, { search: '  haze ' }).map((h) => h.id)).toEqual([2, 3])
  })

  it('filters by role and combines it with the search', () => {
    expect(filterPicker(heroes, { role: 'assassin' }).map((h) => h.id)).toEqual([2])
    expect(filterPicker(heroes, { search: 'haze', role: 'Mystic' }).map((h) => h.id)).toEqual([3])
    expect(filterPicker(heroes, { search: 'nobody' })).toEqual([])
  })

  it('shows everyone by default', () => {
    expect(filterPicker(heroes)).toHaveLength(3)
  })
})

describe('compareStats', () => {
  it('has nothing to compare for a single hero', () => {
    expect(compareStats([hero(1, 'A')])).toEqual({ differing: [], identical: [] })
  })

  it('finds the leader of every stat the heroes differ in', () => {
    const { differing } = compareStats([hero(1, 'A', { maxHealth: 730 }), hero(2, 'B', { maxHealth: 820 }), hero(3, 'C', { maxHealth: 800 })])
    const health = differing.find((row) => row.stat.id === 'health')
    expect(health.values).toEqual([730, 820, 800])
    expect(health.best).toBe(820)
    expect(health.leaders).toEqual([1])
  })

  it('marks every hero that shares the best value as a leader', () => {
    const { differing } = compareStats([hero(1, 'A', { maxMoveSpeed: 8 }), hero(2, 'B', { maxMoveSpeed: 8 }), hero(3, 'C', { maxMoveSpeed: 6 })])
    expect(differing.find((row) => row.stat.id === 'moveSpeed').leaders).toEqual([0, 1])
  })

  it('puts equal stats into the identical list, but never the meta ones', () => {
    const { differing, identical } = compareStats([hero(1, 'A', { maxHealth: 700 }), hero(2, 'B', { maxHealth: 900 })])
    expect(identical.map((row) => row.stat.id)).toEqual(expect.arrayContaining(['moveSpeed', 'sprint', 'stamina', 'heavyMelee', 'lightMelee']))
    expect(identical.map((row) => row.stat.id)).not.toContain('winrate')
    expect(identical.map((row) => row.stat.id)).not.toContain('pickrate')
    expect(differing.map((row) => row.stat.id)).toEqual(['health'])
  })

  it('skips a stat that one of the heroes does not have', () => {
    const { differing, identical } = compareStats([hero(1, 'A', { stamina: null }), hero(2, 'B', { stamina: 4 })])
    const ids = [...differing, ...identical].map((row) => row.stat.id ?? row.id)
    expect(ids).not.toContain('stamina')
  })

  it('carries the growth per level of each hero', () => {
    const a = hero(1, 'A', { maxHealth: 700 }, { levelScaling: { healthPerLevel: 33 } })
    const b = hero(2, 'B', { maxHealth: 800 }, { levelScaling: {} })
    const { differing } = compareStats([a, b])
    expect(differing.find((row) => row.stat.id === 'health').extras).toEqual([33, null])
  })

  it('reads winrate as a share or as a percent', () => {
    const { differing } = compareStats([hero(1, 'A', { winrate: 0.545 }), hero(2, 'B', { winrate: 46.9 })])
    expect(differing.find((row) => row.stat.id === 'winrate').values).toEqual([54.5, 46.9])
  })
})

describe('formatting', () => {
  const stat = (id) => COMPARE_STATS.find((s) => s.id === id)

  it('writes percents with one decimal and other numbers without trailing zeros', () => {
    expect(formatStat(stat('winrate'), 54.5)).toBe('54.5%')
    expect(formatStat(stat('winrate'), 60)).toBe('60.0%')
    expect(formatStat(stat('moveSpeed'), 8.2)).toBe('8.2')
    expect(formatStat(stat('health'), 730)).toBe('730')
    expect(formatStat(stat('sprint'), 1.6000000000000001)).toBe('1.6')
    expect(formatStat(stat('health'), null)).toBe('—')
  })

  it('writes growth per level with a plus and nothing when there is none', () => {
    expect(formatPerLevel(43)).toBe('+43')
    expect(formatPerLevel(1.58)).toBe('+1.58')
    expect(formatPerLevel(null)).toBe('')
    expect(formatPerLevel(0)).toBe('')
  })
})

describe('heroMeta', () => {
  it('converts shares to percents and picks the tone by winrate', () => {
    expect(heroMeta(hero(1, 'A', { winrate: 0.602 }))).toMatchObject({ winrate: 60.2, tone: 'good', matches: 100 })
    expect(heroMeta(hero(1, 'A', { winrate: 0.5 })).tone).toBe('neutral')
    expect(heroMeta(hero(1, 'A', { winrate: 0.469 })).tone).toBe('bad')
  })

  it('does not break on a hero without stats', () => {
    expect(heroMeta({ id: 1, name: 'A' })).toEqual({ winrate: null, tone: 'neutral', pickrate: null, matches: null })
  })
})

describe('radar', () => {
  const roster = [
    hero(1, 'A', { maxHealth: 700, maxMoveSpeed: 6, sprintSpeed: 1 }, { complexity: 1 }),
    hero(2, 'B', { maxHealth: 900, maxMoveSpeed: 8, sprintSpeed: 1 }, { complexity: 3 }),
    hero(3, 'C', { maxHealth: 800, maxMoveSpeed: 7, sprintSpeed: 1 }, { complexity: 2 }),
  ]

  it('scales every axis from the weakest to the strongest hero of the roster', () => {
    const axes = radarAxes(roster)
    const health = axes.find((axis) => axis.id === 'health')
    expect([health.min, health.max]).toEqual([700, 900])
  })

  it('drops an axis on which every hero is the same', () => {
    const ids = radarAxes(roster).map((axis) => axis.id)
    expect(ids).not.toContain('sprint')
    expect(ids).not.toContain('melee')
    expect(ids).toEqual(['health', 'moveSpeed', 'complexity'])
  })

  it('ignores heroes without a value when it measures the range', () => {
    const withGap = [...roster, hero(4, 'D', { maxHealth: null })]
    expect(radarAxes(withGap).find((axis) => axis.id === 'health').max).toBe(900)
  })

  it('puts the weakest hero on the floor, the strongest on the rim and the rest in between', () => {
    const health = radarAxes(roster).find((axis) => axis.id === 'health')
    expect(radarLevel(health, roster[0])).toBeCloseTo(RADAR_FLOOR)
    expect(radarLevel(health, roster[1])).toBeCloseTo(1)
    expect(radarLevel(health, roster[2])).toBeCloseTo((RADAR_FLOOR + 1) / 2)
  })

  it('puts a hero without a value on the floor', () => {
    const health = radarAxes(roster).find((axis) => axis.id === 'health')
    expect(radarLevel(health, hero(9, 'X', { maxHealth: null }))).toBe(RADAR_FLOOR)
  })

  it('points the first axis up and goes clockwise', () => {
    const box = { cx: 100, cy: 100, radius: 50 }
    const [x0, y0] = radarPoint(0, 4, 1, box)
    expect([Math.round(x0), Math.round(y0)]).toEqual([100, 50])
    const [x1, y1] = radarPoint(1, 4, 1, box)
    expect([Math.round(x1), Math.round(y1)]).toEqual([150, 100])
    const [x2, y2] = radarPoint(2, 4, 0.5, box)
    expect([Math.round(x2), Math.round(y2)]).toEqual([100, 125])
  })
})
