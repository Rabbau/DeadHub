import { describe, expect, it } from 'vitest'
import {
  FORM_LIMIT, FORM_WINDOW, MIN_FORM_MATCHES, TREND_WINDOW,
  badgePosition, currentStreak, formSeries, formTrend, isStatsMatch, rankSteps, statsMatches, summarizeRows,
} from '../src/services/playerHistoryService.js'

let counter = 0
/** Строка истории; новые строки в тестах собираются сверху вниз, поэтому `at` убывает. */
function row(overrides = {}) {
  counter += 1
  return { id: counter, heroId: 13, at: 2_000_000 - counter * 100, duration: 1800, kills: 5, deaths: 5, assists: 5, win: true, mode: 4, gameMode: 1, delta: null, badge: null, abandoned: false, ...overrides }
}
/** Серия результатов (новые сверху): 'WWL' → победа, победа, поражение. */
const results = (pattern, extra = {}) => [...pattern].map((c) => row({ win: c === 'W', ...extra }))

describe('isStatsMatch', () => {
  it('takes ranked and unranked games of the main mode', () => {
    expect(isStatsMatch(row({ mode: 4 }))).toBe(true)
    expect(isStatsMatch(row({ mode: 1 }))).toBe(true)
  })

  it('leaves out bots, custom games and Street Brawl', () => {
    expect(isStatsMatch(row({ mode: 3 }))).toBe(false)
    expect(isStatsMatch(row({ mode: 2 }))).toBe(false)
    expect(isStatsMatch(row({ mode: 1, gameMode: 4 }))).toBe(false)
  })

  it('treats a row without a game mode (an older cache entry) as a main-mode match', () => {
    const { gameMode: _gameMode, ...old } = row({ mode: 4 })
    expect(isStatsMatch(old)).toBe(true)
  })
})

describe('statsMatches', () => {
  it('filters by mode and age and keeps the order', () => {
    const list = [row({ at: 900 }), row({ mode: 3, at: 800 }), row({ at: 700 }), row({ at: 100 })]
    expect(statsMatches(list, 500).map((r) => r.at)).toEqual([900, 700])
    expect(statsMatches(list).map((r) => r.at)).toEqual([900, 700, 100])
    expect(statsMatches(undefined)).toEqual([])
  })
})

describe('summarizeRows', () => {
  it('sums results and takes KDA as a ratio of sums', () => {
    const s = summarizeRows([row({ win: true, kills: 10, deaths: 2, assists: 4 }), row({ win: false, kills: 2, deaths: 8, assists: 0 })])
    expect(s).toMatchObject({ matches: 2, wins: 1, kills: 12, deaths: 10, assists: 4, winrate: 0.5 })
    expect(s.kda).toBeCloseTo(1.6)
  })

  it('does not divide by zero for no matches or no deaths', () => {
    expect(summarizeRows([])).toMatchObject({ matches: 0, winrate: 0, kda: 0 })
    expect(summarizeRows([row({ kills: 3, deaths: 0, assists: 2 })]).kda).toBe(5)
  })
})

describe('currentStreak', () => {
  it('counts the latest matches that ended the same way', () => {
    expect(currentStreak(results('WWWLW'))).toEqual({ win: true, length: 3 })
    expect(currentStreak(results('LLW'))).toEqual({ win: false, length: 2 })
    expect(currentStreak(results('W'))).toEqual({ win: true, length: 1 })
  })

  it('is null without matches', () => {
    expect(currentStreak([])).toBeNull()
  })
})

describe('formSeries', () => {
  it('draws nothing while there are too few matches', () => {
    expect(formSeries(results('W'.repeat(MIN_FORM_MATCHES - 1)))).toEqual([])
  })

  it('moves a window over the matches from old to new', () => {
    // старые → новые: 10 побед, потом 10 поражений; новые сверху
    const rows = results('L'.repeat(10) + 'W'.repeat(10))
    const series = formSeries(rows)
    expect(series).toHaveLength(20 - FORM_WINDOW + 1)
    expect(series[0].winrate).toBe(1)
    expect(series[series.length - 1].winrate).toBe(0)
    // винрейт убывает по одной победе за шаг
    expect(series.map((p) => p.winrate)).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0])
    // точки идут от старых к новым
    for (let i = 1; i < series.length; i++) expect(series[i].at).toBeGreaterThan(series[i - 1].at)
  })

  it('keeps only the latest FORM_LIMIT points', () => {
    const series = formSeries(results('WL'.repeat(150)))
    expect(series).toHaveLength(FORM_LIMIT)
  })

  it('stays inside 0..1', () => {
    for (const point of formSeries(results('WLLWWLWLLLWWWLWLWL'))) {
      expect(point.winrate).toBeGreaterThanOrEqual(0)
      expect(point.winrate).toBeLessThanOrEqual(1)
    }
  })
})

describe('formTrend', () => {
  it('needs a full recent window and some earlier matches to compare with', () => {
    expect(formTrend(results('W'.repeat(TREND_WINDOW - 1)))).toBeNull()
    expect(formTrend(results('W'.repeat(TREND_WINDOW + 5)))).toBeNull()
    expect(formTrend(results('W'.repeat(TREND_WINDOW + 10)))).not.toBeNull()
  })

  it('calls a clear improvement "up" and a clear slump "down"', () => {
    const up = formTrend(results('W'.repeat(18) + 'LL' + 'L'.repeat(16) + 'WWWW'))
    expect(up.verdict).toBe('up')
    expect(up.deltaWinrate).toBeCloseTo(0.9 - 0.2)
    const down = formTrend(results('L'.repeat(18) + 'WW' + 'W'.repeat(16) + 'LLLL'))
    expect(down.verdict).toBe('down')
  })

  it('does not call ordinary swings a trend', () => {
    // 11 побед из 20 против 9 из 20 — это шум
    const steady = formTrend(results('WLWLWLWLWWWLWLWLWLWW' + 'LWLWLWWLWLLWLWLWLWWL'))
    expect(steady.verdict).toBe('steady')
    expect(Math.abs(steady.z)).toBeLessThan(1.28)
  })

  it('reports no change when every match was a win (no spread to measure)', () => {
    const same = formTrend(results('W'.repeat(40)))
    expect(same.z).toBe(0)
    expect(same.verdict).toBe('steady')
  })

  it('compares KDA of the same two windows', () => {
    const rows = [...results('W'.repeat(20), { kills: 10, deaths: 2, assists: 5 }), ...results('W'.repeat(20), { kills: 4, deaths: 4, assists: 4 })]
    expect(formTrend(rows).deltaKda).toBeCloseTo(7.5 - 2)
  })
})

describe('rankSteps', () => {
  it('lists rank changes of ranked games from old to new and ignores the rest', () => {
    const history = [
      row({ at: 500, badge: 53 }),
      row({ at: 400, badge: 53 }),
      row({ at: 450, mode: 1, badge: 99 }), // обычный матч бейдж не меняет
      row({ at: 300, badge: 52 }),
      row({ at: 200, badge: 52 }),
      row({ at: 100, badge: null }),
    ]
    // смена ранга — на матче at=400; последняя точка тянет линию до самого свежего рейтингового матча
    expect(rankSteps(history)).toEqual([{ at: 200, badge: 52 }, { at: 400, badge: 53 }, { at: 500, badge: 53 }])
  })

  it('draws a flat line from the first to the last match when the rank never changed', () => {
    const history = [row({ at: 300, badge: 61 }), row({ at: 200, badge: 61 }), row({ at: 100, badge: 61 })]
    expect(rankSteps(history)).toEqual([{ at: 100, badge: 61 }, { at: 300, badge: 61 }])
  })

  it('is a single point for a single ranked match', () => {
    expect(rankSteps([row({ at: 300, badge: 61 })])).toEqual([{ at: 300, badge: 61 }])
  })

  it('is empty without ranked games', () => {
    expect(rankSteps([row({ mode: 1, badge: 40 })])).toEqual([])
    expect(rankSteps(undefined)).toEqual([])
  })
})

describe('badgePosition', () => {
  it('puts the 66 badges on one scale from 0 to 65', () => {
    expect(badgePosition(11)).toBe(0)
    expect(badgePosition(16)).toBe(5)
    expect(badgePosition(21)).toBe(6)
    expect(badgePosition(116)).toBe(65)
  })
})
