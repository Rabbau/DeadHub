import { describe, expect, it } from 'vitest'
import rows from './fixtures/rank-distribution.json'
import { positionOf, slimDistribution, tierShare } from '../src/services/rankDistributionService.js'

const row = (rank, subrank, players) => ({ rank, subrank, players })

describe('slimDistribution', () => {
  it('groups by tier and sorts tiers and subranks', () => {
    const d = slimDistribution([row(2, 2, 30), row(1, 1, 10), row(2, 1, 20), row(1, 2, 15)])
    expect(d.total).toBe(75)
    expect(d.tiers.map((t) => t.tier)).toEqual([1, 2])
    expect(d.tiers[0]).toEqual({ tier: 1, players: 25, subs: [{ sub: 1, players: 10 }, { sub: 2, players: 15 }] })
    expect(d.tiers[1].players).toBe(50)
  })

  it('skips broken rows and survives non-arrays', () => {
    expect(slimDistribution([row(0, 1, 5), row(1, 0, 5), row('x', 1, 5), null, { rank: 1, subrank: 1 }]).total).toBe(0)
    expect(slimDistribution(null)).toEqual({ total: 0, tiers: [] })
  })

  it('on the real response has 11 tiers × 6 subranks and a plausible total', () => {
    const d = slimDistribution(rows)
    expect(d.tiers).toHaveLength(11)
    expect(d.tiers.every((t) => t.subs.length === 6)).toBe(true)
    expect(d.total).toBe(rows.reduce((sum, r) => sum + r.players, 0))
    expect(d.total).toBeGreaterThan(100_000)
    // Эфирный (Eternus) тир — самый редкий, середина лестницы — самая населённая
    const counts = d.tiers.map((t) => t.players)
    expect(counts[counts.length - 1]).toBe(Math.min(...counts))
    expect(Math.max(...counts)).toBeGreaterThan(counts[0])
  })
})

describe('positionOf', () => {
  const d = slimDistribution([row(1, 1, 100), row(1, 2, 100), row(2, 1, 600), row(2, 2, 200)]) // всего 1000

  it('counts the players below and half of the own badge', () => {
    expect(positionOf(d, 21)).toMatchObject({ below: 200, own: 600, total: 1000, betterThan: 0.5, topPercent: 50 })
    expect(positionOf(d, 11)).toMatchObject({ below: 0, own: 100, betterThan: 0.05, topPercent: 95 })
  })

  it('puts the best badge in the top few percent, never at 0%', () => {
    expect(positionOf(d, 22)).toMatchObject({ below: 800, betterThan: 0.9, topPercent: 10 })
    const lone = slimDistribution([row(1, 1, 1), row(11, 6, 1_000_000)])
    expect(positionOf(lone, 116).topPercent).toBeGreaterThanOrEqual(0.1)
  })

  it('has no position for an unknown badge or an empty distribution', () => {
    expect(positionOf(d, 66)).toBeNull()
    expect(positionOf(d, 0)).toBeNull()
    expect(positionOf(d, null)).toBeNull()
    expect(positionOf(slimDistribution([]), 21)).toBeNull()
    expect(positionOf(null, 21)).toBeNull()
  })

  it('on the real distribution orders positions by rank', () => {
    const real = slimDistribution(rows)
    const low = positionOf(real, 21).betterThan
    const mid = positionOf(real, 56).betterThan
    const high = positionOf(real, 96).betterThan
    expect(low).toBeLessThan(mid)
    expect(mid).toBeLessThan(high)
    expect(positionOf(real, 116).topPercent).toBeLessThan(2) // Эфирный — доли процента игроков
  })
})

describe('tierShare', () => {
  it('is the tier part of all players', () => {
    const d = slimDistribution([row(1, 1, 250), row(2, 1, 750)])
    expect(tierShare(d, 1)).toBe(0.25)
    expect(tierShare(d, 2)).toBe(0.75)
    expect(tierShare(d, 3)).toBe(0)
    expect(tierShare(null, 1)).toBe(0)
  })
})
