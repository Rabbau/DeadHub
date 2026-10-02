import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  MAX_TIER,
  MIN_TIER,
  RANK_PRESETS,
  activeRankPreset,
  defaultFiltersFor,
  filtersKey,
  isDefaultFilters,
  isRankFiltered,
  describeFilters,
  isStreetBrawl,
  normalizeFilters,
  toStatsParams,
  withNormalMode,
} from '../src/services/statsFilters.js'

const NOW = Date.UTC(2026, 9, 2, 12, 0) // 2 октября 2026
const PATCH = { title: 'City Never Sleeps', at: Math.floor(Date.UTC(2026, 8, 29, 20, 25, 11) / 1000) }

describe('normalizeFilters', () => {
  it('keeps «с патча» together with its time', () => {
    expect(normalizeFilters({ period: 'patch', since: 1790713511, rankMin: 2, rankMax: 5 }))
      .toMatchObject({ period: 'patch', since: 1790713511, rankMin: 2, rankMax: 5 })
  })

  it('falls back to 30 days when «с патча» has no usable time', () => {
    expect(normalizeFilters({ period: 'patch' }).period).toBe(30)
    expect(normalizeFilters({ period: 'patch', since: 'abc' }).period).toBe(30)
  })

  it('drops `since` for numeric periods', () => {
    expect('since' in normalizeFilters({ period: 7, since: 123 })).toBe(false)
  })

  it('reads the old saved format and garbage', () => {
    expect(normalizeFilters({ period: 14, rankMin: 3, rankMax: 9 })).toMatchObject({ period: 14, rankMin: 3, rankMax: 9 })
    expect(normalizeFilters(null)).toMatchObject({ period: 30, rankMin: 1, rankMax: 11 })
  })

  it('orders and clamps the rank range', () => {
    expect(normalizeFilters({ period: 30, rankMin: 9, rankMax: 2 })).toMatchObject({ rankMin: 2, rankMax: 9 })
    expect(normalizeFilters({ period: 30, rankMin: -5, rankMax: 99 })).toMatchObject({ rankMin: MIN_TIER, rankMax: MAX_TIER })
  })
})

describe('toStatsParams', () => {
  it('uses the exact patch time for «с патча»', () => {
    expect(toStatsParams({ period: 'patch', since: 1790713511, rankMin: 1, rankMax: 11 }, NOW)).toEqual({ min_unix_timestamp: 1790713511 })
  })

  it('adds the badge range for a rank filter', () => {
    expect(toStatsParams({ period: 'patch', since: 1790713511, rankMin: 9, rankMax: 11 }, NOW))
      .toEqual({ min_unix_timestamp: 1790713511, min_average_badge: 91, max_average_badge: 116 })
  })

  it('rounds a day period to the UTC midnight (cache-friendly URL)', () => {
    expect(toStatsParams({ period: 30, rankMin: 1, rankMax: 11 }, NOW).min_unix_timestamp).toBe(Date.UTC(2026, 8, 2) / 1000)
  })
})

describe('filtersKey', () => {
  it('describes period and ranks', () => {
    expect(filtersKey({ period: 'patch', since: 1790713511, rankMin: 1, rankMax: 11 })).toBe('p1790713511_r1-11')
    expect(filtersKey({ period: 30, rankMin: 1, rankMax: 11 })).toBe('30d_r1-11')
  })

  it('changes with a new patch', () => {
    expect(filtersKey({ period: 'patch', since: 1 })).not.toBe(filtersKey({ period: 'patch', since: 2 }))
  })
})

describe('defaults', () => {
  it('uses «с патча» while the patch is fresh', () => {
    expect(defaultFiltersFor(PATCH, NOW)).toEqual({ period: 'patch', since: PATCH.at, rankMin: 1, rankMax: 11 })
  })

  it('goes back to 30 days for an old patch or no patch', () => {
    expect(defaultFiltersFor(PATCH, NOW + 60 * 86400e3)).toMatchObject({ period: 30 })
    expect(defaultFiltersFor(null, NOW)).toMatchObject({ period: 30 })
  })

  it('isDefaultFilters compares against the given defaults', () => {
    const fresh = defaultFiltersFor(PATCH, NOW)
    expect(isDefaultFilters(fresh, fresh)).toBe(true)
    expect(isDefaultFilters(DEFAULT_FILTERS, fresh)).toBe(false)
    expect(isDefaultFilters({ ...fresh, rankMin: 5 }, fresh)).toBe(false)
    expect(isDefaultFilters({ period: 30, rankMin: 1, rankMax: 11 })).toBe(true)
  })
})

describe('Street Brawl mode', () => {
  const brawl = { period: 'patch', since: 1790713511, rankMin: 9, rankMax: 11, mode: 'street_brawl' }

  it('is kept by normalizeFilters only when it is Street Brawl', () => {
    expect(normalizeFilters(brawl).mode).toBe('street_brawl')
    expect('mode' in normalizeFilters({ ...brawl, mode: 'normal' })).toBe(false)
    expect('mode' in normalizeFilters({ ...brawl, mode: 'explore_n_y_c' })).toBe(false) // чужие режимы не принимаем
    expect(isStreetBrawl(normalizeFilters(brawl))).toBe(true)
    expect(isStreetBrawl(DEFAULT_FILTERS)).toBe(false)
  })

  it('asks the API for game_mode and never sends a rank range (the API answers 400 to it)', () => {
    expect(toStatsParams(brawl, NOW)).toEqual({ min_unix_timestamp: 1790713511, game_mode: 'street_brawl' })
    expect(isRankFiltered(brawl)).toBe(false)
  })

  it('keeps the remembered rank range for the way back to normal matches', () => {
    const back = normalizeFilters({ ...brawl, mode: 'normal' })
    expect([back.rankMin, back.rankMax]).toEqual([9, 11])
    expect(toStatsParams(back, NOW)).toMatchObject({ min_average_badge: 91, max_average_badge: 116 })
  })

  it('has its own cache key that ignores the rank range', () => {
    expect(filtersKey(brawl)).toBe('p1790713511_sb')
    expect(filtersKey({ ...brawl, rankMin: 1, rankMax: 4 })).toBe(filtersKey(brawl))
    expect(filtersKey(brawl)).not.toBe(filtersKey({ ...brawl, mode: undefined }))
  })

  it('withNormalMode drops the mode (for data that exists only for normal matches)', () => {
    expect(withNormalMode(brawl)).toEqual({ period: 'patch', since: 1790713511, rankMin: 9, rankMax: 11 })
    expect(filtersKey(withNormalMode(brawl))).toBe('p1790713511_r9-11')
  })

  it('differs from the defaults, so «Reset» appears', () => {
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, mode: 'street_brawl' })).toBe(false)
  })
})

describe('rank presets', () => {
  it('lists the five ranges', () => {
    expect(RANK_PRESETS.map((p) => p.id)).toEqual(['all', 'low', 'mid', 'high', 'eternus'])
  })

  it('covers every tier exactly once (except «all»)', () => {
    const tiers = RANK_PRESETS.filter((p) => p.id !== 'all').flatMap((p) => Array.from({ length: p.max - p.min + 1 }, (_, i) => p.min + i))
    expect(tiers).toEqual(Array.from({ length: 11 }, (_, i) => i + 1))
  })

  it('finds the active preset', () => {
    expect(activeRankPreset(DEFAULT_FILTERS)).toBe('all')
    expect(activeRankPreset({ rankMin: 1, rankMax: 4 })).toBe('low')
    expect(activeRankPreset({ rankMin: 5, rankMax: 8 })).toBe('mid')
    expect(activeRankPreset({ rankMin: 11, rankMax: 11 })).toBe('eternus')
    expect(activeRankPreset({ rankMin: 3, rankMax: 9 })).toBeNull()
  })

  it.each(RANK_PRESETS)('preset $id survives normalizeFilters and yields the same query as two selects', (p) => {
    const filters = normalizeFilters({ period: 30, rankMin: p.min, rankMax: p.max })
    expect([filters.rankMin, filters.rankMax]).toEqual([p.min, p.max])
    const params = toStatsParams(filters, Date.UTC(2026, 9, 2))
    if (p.id === 'all') expect(params.min_average_badge).toBeUndefined() // матчи без ранга остаются в выборке
    else expect([params.min_average_badge, params.max_average_badge]).toEqual([p.min * 10 + 1, p.max * 10 + 6])
  })

  it('gives distinct cache keys', () => {
    const keys = RANK_PRESETS.map((p) => filtersKey({ period: 30, rankMin: p.min, rankMax: p.max }))
    expect(new Set(keys).size).toBe(RANK_PRESETS.length)
  })
})

describe('describeFilters', () => {
  it('names the period, the rank preset and the mode for a caption', () => {
    expect(describeFilters(DEFAULT_FILTERS)).toEqual({ period: 30, rankPreset: 'all', streetBrawl: false })
    expect(describeFilters({ period: 'patch', since: PATCH.at, rankMin: 5, rankMax: 8 })).toEqual({ period: 'patch', rankPreset: 'mid', streetBrawl: false })
  })

  it('has no preset for a custom range', () => {
    expect(describeFilters({ period: 7, rankMin: 3, rankMax: 9 }).rankPreset).toBeNull()
  })

  it('flags Street Brawl, where ranks do not apply', () => {
    expect(describeFilters({ ...DEFAULT_FILTERS, mode: 'street_brawl' }).streetBrawl).toBe(true)
  })

  it('reads whatever normalizeFilters produced from saved garbage', () => {
    expect(describeFilters(normalizeFilters({ period: 'abc', rankMin: 99, rankMax: -4 }))).toEqual({ period: 30, rankPreset: 'all', streetBrawl: false })
  })
})
