import { describe, expect, it } from 'vitest'
import { INSIGHTS, buildAdvice, compareWithMeta, heroResults, rankBand, suggestHeroes, windowStart } from '../src/services/playerInsightsService.js'

let counter = 0
function match(heroId, win, overrides = {}) {
  counter += 1
  return { id: counter, heroId, at: 1_000_000 - counter, duration: 1800, kills: 6, deaths: 4, assists: 8, win, mode: 4, gameMode: 1, delta: null, badge: null, abandoned: false, ...overrides }
}
/** `wins` побед и `losses` поражений на герое. */
const games = (heroId, wins, losses, overrides) => [
  ...Array.from({ length: wins }, () => match(heroId, true, overrides)),
  ...Array.from({ length: losses }, () => match(heroId, false, overrides)),
]
const metaRow = (matches, wins) => ({ matches, wins, kills: matches * 6, deaths: matches * 5, assists: matches * 9 })

describe('rankBand', () => {
  it('takes the player’s tier and one neighbour on each side', () => {
    expect(rankBand(53)).toEqual({ rankMin: 4, rankMax: 6 })
    expect(rankBand(86)).toEqual({ rankMin: 7, rankMax: 9 })
  })

  it('stays inside tiers 1..11', () => {
    expect(rankBand(11)).toEqual({ rankMin: 1, rankMax: 2 })
    expect(rankBand(112)).toEqual({ rankMin: 10, rankMax: 11 })
  })

  it('has no band for no rank or a rank that does not exist', () => {
    expect(rankBand(null)).toBeNull()
    expect(rankBand(0)).toBeNull()
    expect(rankBand(6)).toBeNull() // тир 0
    expect(rankBand(126)).toBeNull() // тир 12
  })
})

describe('windowStart', () => {
  it('goes back the given number of days from now, in unix seconds', () => {
    expect(windowStart(1_000_000_000_000, 1)).toBe(1_000_000_000 - 86_400)
    expect(windowStart(1_000_000_000_000)).toBe(1_000_000_000 - INSIGHTS.WINDOW_DAYS * 86_400)
  })
})

describe('heroResults', () => {
  it('counts matches per hero and sums kills, deaths and assists', () => {
    const results = heroResults([...games(1, 3, 1), ...games(2, 0, 2)])
    expect(results[1]).toMatchObject({ heroId: 1, matches: 4, wins: 3, kills: 24, deaths: 16, assists: 32 })
    expect(results[2]).toMatchObject({ matches: 2, wins: 0 })
  })

  it('skips bots, custom games, Street Brawl and matches older than the window', () => {
    const history = [match(1, true), match(1, true, { mode: 3 }), match(1, true, { mode: 2 }), match(1, true, { gameMode: 4 }), match(1, true, { at: 10 })]
    expect(heroResults(history, 500)[1].matches).toBe(1)
    expect(heroResults(history, 0)[1].matches).toBe(2)
  })

  it('is empty without history', () => {
    expect(heroResults(undefined)).toEqual({})
    expect(heroResults([])).toEqual({})
  })
})

describe('compareWithMeta', () => {
  const meta = { total: 0, byHero: { 1: metaRow(10_000, 5000), 2: metaRow(10_000, 5000), 3: metaRow(10_000, 5000), 4: metaRow(10_000, 5000), 5: metaRow(100, 60), 6: metaRow(100_000, 50_000) } }

  it('finds a hero the player wins on much more often than the rank average', () => {
    const [row] = compareWithMeta(heroResults(games(1, 15, 5)), meta)
    expect(row).toMatchObject({ heroId: 1, matches: 20, wins: 15, verdict: 'strong' })
    expect(row.winrate).toBe(0.75)
    expect(row.metaWinrate).toBe(0.5)
    expect(row.diff).toBeCloseTo(0.25)
    expect(row.z).toBeCloseTo(2.236, 2)
    expect(row.extraWins).toBeCloseTo(5)
    // сглаженный винрейт тянется к мете: (15 + 10 * 0.5) / (20 + 10)
    expect(row.adjusted).toBeCloseTo(20 / 30)
  })

  it('finds a hero the player loses on', () => {
    const [row] = compareWithMeta(heroResults(games(1, 5, 15)), meta)
    expect(row.verdict).toBe('weak')
    expect(row.extraWins).toBeCloseTo(-5)
  })

  it('calls an average result average', () => {
    expect(compareWithMeta(heroResults(games(1, 10, 10)), meta)[0].verdict).toBe('even')
  })

  it('does not call a lucky streak on a few matches a strength', () => {
    // на четырёх матчах героя в разборе нет совсем, на пяти он есть, но без вывода, с восьми «5 из 5» уже заметно
    expect(compareWithMeta(heroResults(games(1, 4, 0)), meta)).toEqual([])
    expect(compareWithMeta(heroResults(games(1, 5, 0)), meta)[0].verdict).toBe('even')
    expect(compareWithMeta(heroResults(games(1, 7, 0)), meta)[0].verdict).toBe('even')
    expect(compareWithMeta(heroResults(games(1, 8, 0)), meta)[0].verdict).toBe('strong')
  })

  it('needs a z-score that is not a coin flip: 13 of 20 is not yet a strength, 14 of 20 is', () => {
    expect(compareWithMeta(heroResults(games(1, 13, 7)), meta)[0].verdict).toBe('even')
    expect(compareWithMeta(heroResults(games(1, 14, 6)), meta)[0].verdict).toBe('strong')
  })

  it('needs both a noticeable z and a difference of a few points', () => {
    // 52% на двух тысячах матчей: z ≈ 1,8 — пройдено, но разница всего два пункта: не сильная сторона
    const [row] = compareWithMeta(heroResults(games(6, 1040, 960)), meta)
    expect(row.z).toBeGreaterThan(INSIGHTS.Z)
    expect(row.diff).toBeLessThan(INSIGHTS.MIN_DIFF)
    expect(row.verdict).toBe('even')
  })

  it('compares only with a meta that has enough matches, and only heroes the meta knows', () => {
    expect(compareWithMeta(heroResults(games(5, 15, 5)), meta)).toEqual([]) // в мете 100 матчей
    expect(compareWithMeta(heroResults(games(99, 15, 5)), meta)).toEqual([]) // героя нет в мете
    expect(compareWithMeta(heroResults(games(1, 15, 5)), { byHero: {} })).toEqual([])
  })

  it('sorts by matches, the most played hero first', () => {
    const rows = compareWithMeta(heroResults([...games(1, 6, 4), ...games(2, 10, 10), ...games(3, 3, 3)]), meta)
    expect(rows.map((row) => row.heroId)).toEqual([2, 1, 3])
  })

  it('compares KDA of the player and of the hero in the meta', () => {
    const [row] = compareWithMeta(heroResults(games(1, 10, 10)), meta)
    expect(row.kda).toBeCloseTo((6 + 8) / 4)
    expect(row.metaKda).toBeCloseTo((6 + 9) / 5)
  })
})

describe('buildAdvice', () => {
  const meta = { total: 0, byHero: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((id) => [id, metaRow(10_000, 5000)])) }
  const rowsFor = (history) => compareWithMeta(heroResults(history), meta)

  it('splits heroes into strengths and weaknesses and sorts by wins gained or lost', () => {
    const history = [...games(1, 14, 6), ...games(2, 18, 2), ...games(3, 4, 16), ...games(4, 6, 14), ...games(5, 10, 10)]
    const { strengths, weaknesses, model } = buildAdvice(rowsFor(history), { meta })
    expect(model).toBe('strengths')
    expect(strengths.map((row) => row.heroId)).toEqual([2, 1]) // +8 побед и +4
    expect(weaknesses.map((row) => row.heroId)).toEqual([3, 4]) // −6 и −4
  })

  it('shows at most TOP heroes in each list', () => {
    const history = [1, 2, 3, 4, 5].flatMap((id) => games(id, 17, 3))
    expect(buildAdvice(rowsFor(history), { meta }).strengths).toHaveLength(INSIGHTS.TOP)
  })

  it('gives empty lists when nothing stands out', () => {
    const advice = buildAdvice(rowsFor(games(1, 10, 10)), { meta })
    expect(advice).toEqual({ strengths: [], weaknesses: [], suggestions: [], model: 'played' })
  })
})

describe('suggestHeroes', () => {
  const hero = (id, role, gunTag, extra = {}) => ({ id, name: `Hero ${id}`, role, released: true, stats: { gunTag }, ...extra })
  const heroes = [
    hero(1, 'Brawler', 'shotgun'),
    hero(2, 'Marksman', 'rifle'),
    hero(3, 'Brawler', 'pistol'), // той же роли, хорошая мета, не играл → подходит
    hero(4, 'Mystic', 'rifle'), // другая роль, но то же оружие, что у героя 2
    hero(5, 'Mystic', 'smg'), // ни роль, ни оружие не совпадают
    hero(6, 'Brawler', 'pistol'), // мета ниже 50%
    hero(7, 'Brawler', 'pistol'), // уже играл
    hero(8, 'Brawler', 'pistol', { released: false }), // не вышел
    hero(9, 'Brawler', 'pistol'), // в мете слишком мало матчей
  ]
  const meta = {
    byHero: {
      1: metaRow(10_000, 5000), 2: metaRow(10_000, 5000), 3: metaRow(10_000, 5400), 4: metaRow(10_000, 5200), 5: metaRow(10_000, 5600),
      6: metaRow(10_000, 4800), 7: metaRow(10_000, 5500), 8: metaRow(10_000, 5500), 9: metaRow(50, 40),
    },
  }

  it('offers meta-strong heroes that look like the heroes the player does well on', () => {
    const results = heroResults([...games(1, 16, 4), ...games(2, 10, 10), ...games(7, 3, 2)])
    const rows = compareWithMeta(results, meta)
    const strengths = rows.filter((row) => row.verdict === 'strong')
    expect(strengths.map((row) => row.heroId)).toEqual([1])
    const suggestions = suggestHeroes({ rows, strengths, heroes, results, meta })
    // 3: роль как у героя 1; 4 по оружию не подходит — образец только герой 1 (shotgun)
    expect(suggestions.map((s) => s.heroId)).toEqual([3])
    expect(suggestions[0]).toMatchObject({ roleLike: 1, gunLike: null, metaMatches: 10_000 })
    expect(suggestions[0].metaWinrate).toBeCloseTo(0.54)
  })

  it('takes the most played heroes as the model when nothing stands out', () => {
    const results = heroResults([...games(2, 10, 10)])
    const rows = compareWithMeta(results, meta)
    const suggestions = suggestHeroes({ rows, strengths: [], heroes, results, meta })
    // герой 2 — Marksman/rifle: подходит герой 4 по оружию (мета 52%)
    expect(suggestions.map((s) => s.heroId)).toEqual([4])
    expect(suggestions[0]).toMatchObject({ roleLike: null, gunLike: 2 })
  })

  it('never offers the hero the player already plays, an unreleased one, or one with a weak meta', () => {
    const results = heroResults([...games(1, 16, 4)])
    const rows = compareWithMeta(results, meta)
    const ids = suggestHeroes({ rows, strengths: rows.filter((r) => r.verdict === 'strong'), heroes, results, meta }).map((s) => s.heroId)
    for (const forbidden of [1, 6, 8, 9]) expect(ids).not.toContain(forbidden)
  })

  it('offers nothing without a model hero or without a meta', () => {
    expect(suggestHeroes({ rows: [], strengths: [], heroes, results: {}, meta })).toEqual([])
    const results = heroResults(games(1, 16, 4))
    const rows = compareWithMeta(results, meta)
    expect(suggestHeroes({ rows, strengths: rows, heroes, results, meta: { byHero: {} } })).toEqual([])
  })

  it('shows at most TOP suggestions, best meta first', () => {
    const many = [hero(1, 'Brawler', 'a'), ...Array.from({ length: 6 }, (_, i) => hero(20 + i, 'Brawler', 'b'))]
    const bigMeta = { byHero: { 1: metaRow(10_000, 5000), ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [20 + i, metaRow(10_000, 5100 + i * 100)])) } }
    const results = heroResults(games(1, 16, 4))
    const rows = compareWithMeta(results, bigMeta)
    const suggestions = suggestHeroes({ rows, strengths: rows, heroes: many, results, meta: bigMeta })
    expect(suggestions.map((s) => s.heroId)).toEqual([25, 24, 23])
  })
})
