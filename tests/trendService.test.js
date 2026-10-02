import { describe, expect, it } from 'vitest'
import rows from './fixtures/hero-stats-weekly.json'
import {
  MIN_TREND_MATCHES,
  TREND_WEEKS,
  axisRange,
  heroTrend,
  scaleSeries,
  seriesPath,
  slimWeeklyStats,
  trendSince,
} from '../src/services/trendService.js'

const WEEK = 7 * 86400
const row = (hero_id, bucket, matches, wins) => ({ hero_id, bucket, matches, wins })

describe('slimWeeklyStats', () => {
  it('aligns every hero to the same weeks and totals the picks of each week', () => {
    const weekly = slimWeeklyStats([
      row(1, 2 * WEEK, 100, 55), row(1, 0, 80, 40),
      row(2, 0, 20, 10), // у героя 2 нет строки за вторую неделю
    ])
    expect(weekly.weeks).toEqual([0, 2 * WEEK])
    expect(weekly.total).toEqual([100, 100])
    expect(weekly.byHero[1]).toEqual({ matches: [80, 100], wins: [40, 55] })
    expect(weekly.byHero[2]).toEqual({ matches: [20, 0], wins: [10, 0] })
  })

  it('reads buckets sent as strings and skips broken rows', () => {
    const weekly = slimWeeklyStats([row(1, String(WEEK), 10, 5), null, { hero_id: 1, bucket: 'x', matches: 5 }])
    expect(weekly.weeks).toEqual([WEEK])
    expect(slimWeeklyStats(null)).toEqual({ weeks: [], total: [], byHero: {} })
  })

  it('on a real response gives 10 weeks whose totals match the API own matches_per_bucket', () => {
    const weekly = slimWeeklyStats(rows)
    expect(weekly.weeks).toHaveLength(10)
    expect(weekly.weeks.every((w, i) => i === 0 || w - weekly.weeks[i - 1] === WEEK)).toBe(true)
    weekly.weeks.forEach((week, i) => {
      const reported = rows.find((r) => r.bucket === week).matches_per_bucket
      expect(weekly.total[i]).toBe(reported)
    })
    expect(Object.keys(weekly.byHero)).toHaveLength(38)
  })
})

describe('heroTrend', () => {
  const weekly = slimWeeklyStats([
    row(1, 0, 1000, 500), row(1, WEEK, 1000, 550), row(1, 2 * WEEK, 150, 90), row(1, 3 * WEEK, 1000, 600),
    row(2, 0, 3000, 1500), row(2, WEEK, 1000, 500), row(2, 2 * WEEK, 850, 400), row(2, 3 * WEEK, 1000, 500),
  ])

  it('gives win rate and pick rate per week', () => {
    const points = heroTrend(weekly, 1, { sinceSec: 0, nowSec: 99 * WEEK })
    expect(points.map((p) => p.week)).toEqual([0, WEEK, 3 * WEEK]) // неделя с 150 матчами пропущена
    expect(points[0]).toMatchObject({ matches: 1000, wr: 0.5, pr: 0.25 })
    expect(points[1].wr).toBeCloseTo(0.55, 10)
    expect(points[1].pr).toBeCloseTo(0.5, 10)
  })

  it('marks the first and the current weeks as incomplete', () => {
    const points = heroTrend(weekly, 1, { sinceSec: 0.5 * WEEK, nowSec: 3.5 * WEEK })
    expect(points.map((p) => p.partial)).toEqual([true, false, true])
  })

  it('respects the minimum, returns nothing for unknown heroes', () => {
    expect(heroTrend(weekly, 1, { minMatches: 0, nowSec: 99 * WEEK })).toHaveLength(4)
    expect(heroTrend(weekly, 99)).toEqual([])
    expect(heroTrend(null, 1)).toEqual([])
    expect(MIN_TREND_MATCHES).toBeGreaterThan(0)
  })

  it('shows the real trend of a hero over the last weeks', () => {
    const real = slimWeeklyStats(rows)
    const points = heroTrend(real, 25, { sinceSec: trendSince(Date.UTC(2026, 9, 2)), nowSec: Date.UTC(2026, 9, 2) / 1000 })
    expect(points.length).toBeGreaterThanOrEqual(8)
    expect(points.every((p) => p.wr > 0.3 && p.wr < 0.7)).toBe(true)
    expect(points[points.length - 1].partial).toBe(true) // текущая неделя ещё идёт
  })
})

describe('trendSince', () => {
  it('goes back TREND_WEEKS weeks from the UTC midnight', () => {
    expect(trendSince(Date.UTC(2026, 9, 2, 15, 30))).toBe(Date.UTC(2026, 9, 2) / 1000 - TREND_WEEKS * WEEK)
    expect(trendSince(Date.UTC(2026, 9, 2, 0, 1))).toBe(trendSince(Date.UTC(2026, 9, 2, 23, 59)))
  })
})

describe('chart geometry', () => {
  it('gives the axis a margin so small changes are visible but nothing touches the frame', () => {
    const { min, max } = axisRange([0.5, 0.52])
    expect(min).toBeLessThan(0.5)
    expect(max).toBeGreaterThan(0.52)
    const flat = axisRange([0.5, 0.5, 0.5])
    expect(flat.max).toBeGreaterThan(flat.min)
  })

  it('scales values into the frame: first point left, higher value higher up', () => {
    const points = scaleSeries([0.4, 0.5, 0.6], { width: 100, height: 50, pad: 5, min: 0.4, max: 0.6 })
    expect(points[0]).toEqual({ x: 5, y: 45 })
    expect(points[1]).toEqual({ x: 50, y: 25 })
    expect(points[2]).toEqual({ x: 95, y: 5 })
  })

  it('puts a single point in the middle and does not divide by zero', () => {
    expect(scaleSeries([0.5], { width: 100, height: 50, pad: 5, min: 0.5, max: 0.5 })[0].x).toBe(50)
    expect(scaleSeries([0.5, 0.5], { width: 100, height: 50, pad: 5, min: 0.5, max: 0.5 }).every((p) => Number.isFinite(p.y))).toBe(true)
  })

  it('writes a polyline path', () => {
    expect(seriesPath([{ x: 0, y: 10 }, { x: 5.55, y: 4.04 }])).toBe('M0 10 L5.6 4')
    expect(seriesPath([])).toBe('')
  })
})
