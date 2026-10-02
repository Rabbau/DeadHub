import { describe, expect, it } from 'vitest'
import now from './fixtures/hero-stats-now.json'
import before from './fixtures/hero-stats-prev.json'
import brawl from './fixtures/hero-stats-street-brawl.json'
import { slimHeroStats } from '../src/api/heroApi.js'
import {
  MIN_DELTA_MATCHES,
  Z_SIGNIFICANT,
  computeHeroDeltas,
  deltaDirection,
  previousWindow,
  winnersLosers,
} from '../src/services/deltaService.js'
import { formatPoints } from '../src/services/format.js'

const NOW = Date.UTC(2026, 9, 2, 12, 0)
const DAY = 86400
const PATCHES = [
  { at: 1790713511, title: 'City Never Sleeps' },
  { at: 1789589803, title: ' Minor Update - 09-16-2026' },
  { at: 1787434846, title: ' Minor Update - 08-22-2026' },
]

describe('previousWindow', () => {
  it('for «с патча» it is the period between the previous update and this one', () => {
    expect(previousWindow({ period: 'patch', since: 1790713511 }, PATCHES, NOW)).toEqual({
      since: 1789589803, until: 1790713511, kind: 'patch', title: ' Minor Update - 09-16-2026',
    })
    expect(previousWindow({ period: 'patch', since: 1789589803 }, PATCHES, NOW)).toMatchObject({ since: 1787434846, until: 1789589803 })
  })

  it('has nothing to compare with when there is no earlier update', () => {
    expect(previousWindow({ period: 'patch', since: 1787434846 }, PATCHES, NOW)).toBeNull()
    expect(previousWindow({ period: 'patch', since: 1790713511 }, [], NOW)).toBeNull()
    expect(previousWindow({ period: 'patch', since: 1790713511 }, undefined, NOW)).toBeNull()
  })

  it('for N days it is the N days before the current period, rounded to the UTC midnight', () => {
    const w = previousWindow({ period: 14 }, PATCHES, NOW)
    // сейчас 2 октября: текущие 14 дней — с 18 сентября, прошлые — с 4 по 18 сентября
    expect(w).toEqual({ since: Date.UTC(2026, 8, 4) / 1000, until: Date.UTC(2026, 8, 18) / 1000, kind: 'days' })
    expect(w.until - w.since).toBe(14 * DAY)
  })

  it('keeps the same boundaries during the day (cacheable URL)', () => {
    const morning = previousWindow({ period: 7 }, [], Date.UTC(2026, 9, 2, 0, 5))
    const evening = previousWindow({ period: 7 }, [], Date.UTC(2026, 9, 2, 23, 55))
    expect(evening).toEqual(morning)
  })
})

describe('computeHeroDeltas', () => {
  const stats = (rows, total = rows.reduce((a, r) => a + r.matches, 0)) => ({
    total,
    byHero: Object.fromEntries(rows.map((r) => [r.id, { matches: r.matches, wins: r.wins }])),
  })

  it('computes the change in win rate and pick rate in fractions', () => {
    const d = computeHeroDeltas(
      stats([{ id: 1, matches: 1000, wins: 550 }, { id: 2, matches: 3000, wins: 1500 }]),
      stats([{ id: 1, matches: 1000, wins: 500 }, { id: 2, matches: 1000, wins: 500 }]),
    )
    expect(d[1].dWr).toBeCloseTo(0.05, 10)
    expect(d[1].wr0).toBe(0.5)
    expect(d[1].dPr).toBeCloseTo(0.25 - 0.5, 10)
    expect(d[1].pr0).toBe(0.5)
    expect(d[1].matches0).toBe(1000)
  })

  it('marks a change as significant only beyond the 95% interval', () => {
    const d = computeHeroDeltas(
      stats([{ id: 1, matches: 1000, wins: 550 }, { id: 2, matches: 1000, wins: 505 }]),
      stats([{ id: 1, matches: 1000, wins: 500 }, { id: 2, matches: 1000, wins: 500 }]),
    )
    expect(d[1].z).toBeGreaterThan(Z_SIGNIFICANT) // +5 п. п. на тысяче матчей — это не шум
    expect(d[1].significant).toBe(true)
    expect(d[2].significant).toBe(false) // +0,5 п. п. — в пределах разброса
    expect(d[2].reliable).toBe(true)
  })

  it('does not trust heroes with too few matches in either period', () => {
    const d = computeHeroDeltas(
      stats([{ id: 1, matches: MIN_DELTA_MATCHES - 1, wins: 280 }, { id: 2, matches: 1000, wins: 700 }]),
      stats([{ id: 1, matches: 1000, wins: 400 }, { id: 2, matches: MIN_DELTA_MATCHES - 1, wins: 100 }]),
    )
    expect(d[1]).toMatchObject({ reliable: false, significant: false, z: 0 })
    expect(d[2]).toMatchObject({ reliable: false, significant: false })
  })

  it('skips heroes that were absent in the previous period and survives empty input', () => {
    expect(computeHeroDeltas(stats([{ id: 1, matches: 500, wins: 250 }]), stats([]))).toEqual({})
    expect(computeHeroDeltas(null, null)).toEqual({})
    expect(computeHeroDeltas({ total: 0, byHero: {} }, { total: 0, byHero: {} })).toEqual({})
  })

  it('gives zero change and z for identical periods', () => {
    const same = stats([{ id: 1, matches: 800, wins: 400 }])
    expect(computeHeroDeltas(same, same)[1]).toMatchObject({ dWr: 0, dPr: 0, z: 0, significant: false })
  })

  it('works on real hero-stats responses (3 days after City Never Sleeps vs the 13 days before)', () => {
    const d = computeHeroDeltas(slimHeroStats(now), slimHeroStats(before))
    expect(Object.keys(d)).toHaveLength(38)
    expect(Object.values(d).every((x) => x.reliable)).toBe(true)
    // Известные изменения: у героя 25 винрейт заметно упал, у героя 60 вырос
    expect(d[25].dWr).toBeLessThan(-0.02)
    expect(d[25].significant).toBe(true)
    expect(d[60].dWr).toBeGreaterThan(0.015)
    // Пикрейт — доли от суммы пиков, их изменения в сумме дают ноль
    expect(Object.values(d).reduce((a, x) => a + x.dPr, 0)).toBeCloseTo(0, 6)
  })
})

describe('winnersLosers', () => {
  const d = computeHeroDeltas(slimHeroStats(now), slimHeroStats(before))
  const { winners, losers } = winnersLosers(d, { count: 3 })

  it('takes only significant changes and sorts them by size', () => {
    expect(winners.every((w) => w.significant && w.dWr > 0)).toBe(true)
    expect(losers.every((l) => l.significant && l.dWr < 0)).toBe(true)
    expect(winners.map((w) => w.dWr)).toEqual([...winners.map((w) => w.dWr)].sort((a, b) => b - a))
    expect(losers.map((l) => l.dWr)).toEqual([...losers.map((l) => l.dWr)].sort((a, b) => a - b))
    expect(winners).toHaveLength(3)
    expect(losers).toHaveLength(3)
  })

  it('puts the biggest drop first among the losers', () => {
    expect(losers[0].id).toBe(25)
  })

  it('does not call noise a win', () => {
    const noise = { 7: { dWr: 0.01, significant: false, reliable: true }, 8: { dWr: -0.01, significant: false, reliable: true } }
    expect(winnersLosers(noise)).toEqual({ winners: [], losers: [] })
    expect(winnersLosers(null)).toEqual({ winners: [], losers: [] })
  })
})

describe('direction and formatting', () => {
  it('reads the direction of a trustworthy change', () => {
    expect(deltaDirection({ reliable: true, dWr: 0.02 })).toBe('up')
    expect(deltaDirection({ reliable: true, dWr: -0.02 })).toBe('down')
    expect(deltaDirection({ reliable: true, dWr: 0 })).toBe('flat')
    expect(deltaDirection({ reliable: false, dWr: 0.5 })).toBe('flat')
    expect(deltaDirection(undefined)).toBe('flat')
  })

  it('writes points with a real minus sign and no fake precision', () => {
    expect(formatPoints(0.0124)).toBe('+1.2')
    expect(formatPoints(-0.007)).toBe('−0.7')
    expect(formatPoints(0.00004)).toBe('0.0')
    expect(formatPoints(-0.00004)).toBe('0.0')
    expect(formatPoints(null)).toBe('—')
    expect(formatPoints(NaN)).toBe('—')
    expect(formatPoints(0.0124, 2)).toBe('+1.24')
  })
})

describe('hero-stats snapshots', () => {
  it('slimHeroStats keeps the counters the site uses', () => {
    const slim = slimHeroStats(brawl)
    expect(slim.total).toBe(brawl.reduce((a, r) => a + r.matches, 0))
    const first = brawl[0]
    expect(slim.byHero[first.hero_id]).toEqual({
      matches: first.matches, wins: first.wins, kills: first.total_kills, deaths: first.total_deaths, assists: first.total_assists,
    })
    expect(slimHeroStats(null)).toEqual({ total: 0, byHero: {} })
  })
})
