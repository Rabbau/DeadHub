import { describe, expect, it } from 'vitest'
import { MATES, buildCircle, circleIds, dataCoverage } from '../src/services/matesService.js'

const row = (id, matches, wins) => ({ id, matches, wins })

describe('dataCoverage', () => {
  it('is the share of the player’s matches that the API analytics knows', () => {
    expect(dataCoverage(688, 799)).toMatchObject({ level: 'full' })
    expect(dataCoverage(688, 799).share).toBeCloseTo(0.861, 2)
    expect(dataCoverage(60, 100)).toMatchObject({ share: 0.6, level: 'partial' })
    expect(dataCoverage(10, 100)).toMatchObject({ share: 0.1, level: 'low' })
  })

  it('never exceeds 100% (the two sources are counted a little differently)', () => {
    expect(dataCoverage(120, 100).share).toBe(1)
  })

  it('says "unknown" when there is nothing to compare with', () => {
    expect(dataCoverage(10, 0)).toEqual({ share: 0, level: 'unknown' })
    expect(dataCoverage(0, undefined)).toEqual({ share: 0, level: 'unknown' })
  })
})

describe('buildCircle', () => {
  it('lists the most frequent teammates with their win rate and its difference to the player’s own', () => {
    const { friends } = buildCircle([row(1, 10, 6), row(2, 30, 21), row(3, 3, 0)], [], { baseline: 0.5 })
    expect(friends.map((f) => f.id)).toEqual([2, 1, 3])
    expect(friends[0]).toMatchObject({ matches: 30, wins: 21, losses: 9, winrate: 0.7 })
    expect(friends[0].diff).toBeCloseTo(0.2)
  })

  it('ignores people met fewer than MIN_MATCHES times and keeps at most TOP rows', () => {
    const many = Array.from({ length: 12 }, (_, i) => row(100 + i, MATES.MIN_MATCHES + i, 1))
    const { friends } = buildCircle([row(1, MATES.MIN_MATCHES - 1, 2), ...many], [])
    expect(friends).toHaveLength(MATES.TOP)
    expect(friends.map((f) => f.id)).not.toContain(1)
    expect(friends[0].id).toBe(111) // больше всего матчей
  })

  it('breaks ties by wins and then by id, so the order does not depend on the response', () => {
    const { friends } = buildCircle([row(9, 5, 2), row(7, 5, 4), row(8, 5, 4)], [])
    expect(friends.map((f) => f.id)).toEqual([7, 8, 9])
  })

  it('finds a nemesis: an opponent the player keeps losing to', () => {
    const { nemesis } = buildCircle([], [row(1, 6, 3), row(2, 5, 1), row(3, 8, 3), row(4, 4, 2)])
    // у 2: 1 победа при 4 поражениях (перевес 3); у 3: 3 и 5 (перевес 2)
    expect(nemesis).toMatchObject({ id: 2, wins: 1, losses: 4 })
  })

  it('has no nemesis when nobody really beats the player', () => {
    expect(buildCircle([], [row(1, 6, 3), row(2, 4, 2), row(3, 10, 6)]).nemesis).toBeNull()
    // мало встреч — не «немезида», даже при 0 побед
    expect(buildCircle([], [row(1, MATES.NEMESIS_MIN_MATCHES - 1, 0)]).nemesis).toBeNull()
  })

  it('lists frequent opponents separately from the nemesis', () => {
    const { rivals, nemesis } = buildCircle([], [row(1, 12, 6), row(2, 5, 1)])
    expect(rivals.map((r) => r.id)).toEqual([1, 2])
    expect(nemesis.id).toBe(2)
  })

  it('works with no data at all', () => {
    expect(buildCircle([], [])).toEqual({ friends: [], rivals: [], nemesis: null })
  })
})

describe('circleIds', () => {
  it('collects every player to name, once', () => {
    const circle = buildCircle([row(1, 9, 5), row(2, 8, 4)], [row(2, 9, 2), row(3, 7, 3)])
    expect(circleIds(circle).sort()).toEqual([1, 2, 3])
  })

  it('is empty for an empty circle', () => {
    expect(circleIds({ friends: [], rivals: [], nemesis: null })).toEqual([])
  })
})
