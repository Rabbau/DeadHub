import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CURVE_MIN_POINTS, compareCurves, isUsableCurve, slimCurve, soulsRange } from '../src/services/curveService.js'

// Настоящие ответы player-performance-curve (игрок и диапазон рангов 9–11), урезанные до нескольких полей, снято 2026-10-03
const FIXTURE = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'fixtures/performance-curve.json'), 'utf8'))
const player = slimCurve(FIXTURE.player)
const band = slimCurve(FIXTURE.band)

describe('slimCurve', () => {
  it('turns the answer into points by share of the match, oldest first', () => {
    expect(player).toHaveLength(11)
    expect(player.map((p) => p.at)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    expect(player[0]).toMatchObject({ at: 0, souls: expect.any(Number), kills: expect.any(Number) })
    // душ становится больше к концу матча
    for (let i = 1; i < player.length; i++) expect(player[i].souls).toBeGreaterThan(player[i - 1].souls)
  })

  it('keeps only what the page draws', () => {
    expect(Object.keys(player[0]).sort()).toEqual(['assists', 'at', 'deaths', 'kills', 'souls'])
  })

  it('sorts a shuffled answer', () => {
    const shuffled = [...FIXTURE.player].reverse()
    expect(slimCurve(shuffled).map((p) => p.at)).toEqual(player.map((p) => p.at))
  })

  it('drops rows without a share of the match or without souls, and fills missing counts with zeros', () => {
    const curve = slimCurve([
      { game_time: 10, net_worth_avg: 5000 },
      { game_time: null, net_worth_avg: 1 },
      { net_worth_avg: 2 },
      { game_time: 20 },
      { game_time: 30, net_worth_avg: 'x' },
      { game_time: 40, net_worth_avg: 9000, kills_avg: 2.5, deaths_avg: 1, assists_avg: 6 },
    ])
    expect(curve).toEqual([
      { at: 10, souls: 5000, kills: 0, deaths: 0, assists: 0 },
      { at: 40, souls: 9000, kills: 2.5, deaths: 1, assists: 6 },
    ])
  })

  it('is empty for anything that is not a list', () => {
    expect(slimCurve(undefined)).toEqual([])
    expect(slimCurve({ error: 'x' })).toEqual([])
    expect(slimCurve([])).toEqual([])
  })
})

describe('isUsableCurve', () => {
  it('needs enough points and souls at the end', () => {
    expect(isUsableCurve(player)).toBe(true)
    expect(isUsableCurve(player.slice(0, CURVE_MIN_POINTS - 1))).toBe(false)
    expect(isUsableCurve(player.slice(0, CURVE_MIN_POINTS))).toBe(true)
    expect(isUsableCurve(player.map((p) => ({ ...p, souls: 0 })))).toBe(false)
    expect(isUsableCurve([])).toBe(false)
    expect(isUsableCurve(null)).toBe(false)
  })
})

describe('compareCurves', () => {
  it('compares the end of the match of the player with the end of the match of the rank', () => {
    const result = compareCurves(player, band)
    expect(result.rows.map((r) => r.key)).toEqual(['souls', 'kills', 'deaths', 'assists'])
    const souls = result.rows[0]
    expect(souls.player).toBe(player[player.length - 1].souls)
    expect(souls.average).toBe(band[band.length - 1].souls)
    expect(souls.ratio).toBeCloseTo(souls.player / souls.average, 6)
  })

  it('shows the player alone when there is no curve of the rank', () => {
    for (const none of [null, [], band.slice(0, 2)]) {
      const result = compareCurves(player, none)
      expect(result.rows[0]).toMatchObject({ average: null, ratio: null })
      expect(result.rows[0].player).toBeGreaterThan(0)
    }
  })

  it('has nothing to show for a player without a usable curve', () => {
    expect(compareCurves([], band)).toBeNull()
    expect(compareCurves(player.slice(0, 2), band)).toBeNull()
  })

  it('leaves out the ratio where the average is zero', () => {
    const zeroKills = band.map((p) => ({ ...p, kills: 0 }))
    expect(compareCurves(player, zeroKills).rows.find((r) => r.key === 'kills').ratio).toBeNull()
  })
})

describe('soulsRange', () => {
  it('covers both curves with a margin and never goes below zero', () => {
    const { min, max } = soulsRange(player, band)
    const all = [...player, ...band].map((p) => p.souls)
    expect(min).toBeLessThan(Math.min(...all))
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeGreaterThan(Math.max(...all))
  })

  it('works for one curve and for a flat one', () => {
    expect(soulsRange(player, null).max).toBeGreaterThan(player[player.length - 1].souls)
    const flat = [{ souls: 100 }, { souls: 100 }]
    const { min, max } = soulsRange(flat, null)
    expect(max).toBeGreaterThan(min)
  })
})
