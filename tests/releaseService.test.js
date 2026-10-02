import { describe, expect, it } from 'vitest'
import { CURRENT_UPDATE, isHighlightsActive } from '../src/data/updates.js'
import { isReleaseWindow, nextRelease, previousRelease, splitDuration, zonedTimeToUtc } from '../src/services/releaseService.js'

const S = CURRENT_UPDATE.releases // вторник и пятница, 14:00 PT, первый релиз 2026-10-02
const MIN = 60 * 1000
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString())
const first = Date.UTC(2026, 9, 2, 21, 0) // пт 2 окт 14:00 PDT = 21:00 UTC
const tuesday = Date.UTC(2026, 9, 6, 21, 0)

describe('zonedTimeToUtc', () => {
  const la = 'America/Los_Angeles'
  it('handles summer and winter time', () => {
    expect(iso(zonedTimeToUtc({ year: 2026, month: 10, day: 2, hour: 14 }, la))).toBe('2026-10-02T21:00:00.000Z')
    expect(iso(zonedTimeToUtc({ year: 2026, month: 12, day: 1, hour: 14 }, la))).toBe('2026-12-01T22:00:00.000Z')
  })

  it('handles the days the clocks change', () => {
    expect(iso(zonedTimeToUtc({ year: 2026, month: 11, day: 1, hour: 14 }, la))).toBe('2026-11-01T22:00:00.000Z')
    expect(iso(zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 14 }, la))).toBe('2026-03-08T21:00:00.000Z')
  })
})

describe('nextRelease', () => {
  it('finds the next Tuesday/Friday slot', () => {
    expect(iso(nextRelease(S, Date.UTC(2026, 9, 2, 8, 0)))).toBe('2026-10-02T21:00:00.000Z')
    expect(iso(nextRelease(S, Date.UTC(2026, 9, 2, 21, 0, 1)))).toBe('2026-10-06T21:00:00.000Z')
    expect(iso(nextRelease(S, Date.UTC(2026, 9, 2, 21, 0, 0)))).toBe('2026-10-06T21:00:00.000Z')
    expect(iso(nextRelease(S, Date.UTC(2026, 9, 6, 22, 0)))).toBe('2026-10-09T21:00:00.000Z')
  })

  it('judges the weekday in Pacific time, not UTC', () => {
    expect(iso(nextRelease(S, Date.UTC(2026, 9, 3, 3, 0)))).toBe('2026-10-06T21:00:00.000Z')
  })

  it('does not start before the first release date', () => {
    expect(iso(nextRelease(S, Date.UTC(2026, 8, 30, 12, 0)))).toBe('2026-10-02T21:00:00.000Z')
  })

  it('follows the switch to winter time', () => {
    expect(iso(nextRelease(S, Date.UTC(2026, 10, 2, 0, 0)))).toBe('2026-11-03T22:00:00.000Z')
  })

  it('returns null without weekdays', () => {
    expect(nextRelease({ ...S, weekdays: [] }, Date.UTC(2026, 9, 2))).toBeNull()
  })
})

describe('previousRelease', () => {
  it('is null before the first release', () => {
    expect(previousRelease(S, first - 60 * MIN)).toBeNull()
  })

  it('finds the latest slot that has already passed', () => {
    expect(previousRelease(S, first)).toBe(first)
    expect(previousRelease(S, first + 10 * MIN)).toBe(first)
    expect(previousRelease(S, first + 3 * 24 * 60 * MIN)).toBe(first)
    expect(previousRelease(S, tuesday + MIN)).toBe(tuesday)
  })
})

describe('isReleaseWindow', () => {
  it('opens 2 minutes before and closes 45 minutes after a release', () => {
    expect(isReleaseWindow(S, first - 3 * MIN)).toBe(false)
    expect(isReleaseWindow(S, first - 2 * MIN)).toBe(true)
    expect(isReleaseWindow(S, first)).toBe(true)
    expect(isReleaseWindow(S, first + 44 * MIN)).toBe(true)
    expect(isReleaseWindow(S, first + 46 * MIN)).toBe(false)
  })

  it('is closed far from any release and before the schedule starts', () => {
    expect(isReleaseWindow(S, Date.UTC(2026, 9, 4, 12, 0))).toBe(false)
    expect(isReleaseWindow(S, Date.UTC(2026, 8, 20, 21, 0))).toBe(false)
  })

  it('opens for the Tuesday release too and honours the DST change', () => {
    expect(isReleaseWindow(S, tuesday + 20 * MIN)).toBe(true)
    const winterTuesday = Date.UTC(2026, 10, 3, 22, 0)
    expect(isReleaseWindow(S, winterTuesday + 5 * MIN)).toBe(true)
    expect(isReleaseWindow(S, Date.UTC(2026, 10, 3, 21, 0) - 10 * MIN)).toBe(false)
  })

  it('covers about 2 × 47 minutes a week (keeps polling cheap)', () => {
    const weekStart = Date.UTC(2026, 9, 5, 0, 0)
    let open = 0
    for (let m = 0; m < 7 * 24 * 60; m++) if (isReleaseWindow(S, weekStart + m * MIN)) open++
    expect(open).toBeGreaterThanOrEqual(90)
    expect(open).toBeLessThanOrEqual(98)
  })
})

describe('splitDuration', () => {
  it('splits into days, hours and minutes', () => {
    expect(splitDuration(((3 * 24 + 4) * 60 + 12) * 60000 + 59000)).toEqual({ days: 3, hours: 4, minutes: 12 })
  })

  it('clamps negatives and keeps seconds out', () => {
    expect(splitDuration(-5000)).toEqual({ days: 0, hours: 0, minutes: 0 })
    expect(splitDuration(59000)).toEqual({ days: 0, hours: 0, minutes: 0 })
  })
})

describe('«что нового» block', () => {
  it('is shown for 90 days after the release', () => {
    expect(isHighlightsActive(Date.UTC(2026, 9, 2))).toBe(true)
    expect(isHighlightsActive(Date.UTC(2027, 0, 5))).toBe(false)
  })
})
