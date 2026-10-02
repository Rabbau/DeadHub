import { describe, expect, it } from 'vitest'
import real from './fixtures/matchups.json'
import { buildCounterIndex, buildSynergyIndex } from '../src/services/matchupService.js'
import {
  EMPTY_SELECTION,
  MAX_ALLIES,
  MAX_ENEMIES,
  baselinesOf,
  certaintyLevel,
  estimateTau2,
  isListFull,
  parseSelection,
  pureEffect,
  rankDraft,
  selectionParams,
  selectionSearch,
  toggleHero,
} from '../src/services/draftService.js'

/** Детерминированный генератор: тесты не должны зависеть от случайности. */
function rng(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Стандартная нормаль (Бокс — Мюллер) из того же детерминированного генератора. */
function normal(random) {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
}

/**
 * Синтетическая «игра» из 30 героев. У героя i общий винрейт base[i] (от 45% до 55%), а винрейт пары складывается
 * из силы героев — так устроены реальные данные — плюс «чистый» эффект: фон (случайный, размах ±spread·√3) и
 * заданные вручную эффекты. Контрэффект антисимметричен, синергия симметрична. Героев много не случайно: при шести
 * исключение самого героя из «остальных» даёт ошибку в пункт, при 38 (как в игре) — около 0,1 пп. Победы в паре —
 * с выборочным шумом (биномиальным), как в настоящих данных: без него сглаживание нечего было бы сглаживать.
 */
const N = 30
const BASE = Object.fromEntries(Array.from({ length: N }, (_, i) => [i + 1, 0.5 + ((i - (N - 1) / 2) / ((N - 1) / 2)) * 0.05]))

function world({ n = 50000, spread = 0, counterEffects = {}, synergyEffects = {}, seed = 7 } = {}) {
  const random = rng(seed)
  const ids = Object.keys(BASE).map(Number)
  const counterRows = []
  const synergyRows = []
  const noise = () => (random() * 2 - 1) * spread * Math.sqrt(3) // равномерный, sd = spread
  const counterBg = new Map()
  const synergyBg = new Map()
  ids.forEach((a) => {
    ids.forEach((b) => {
      if (a >= b) return
      counterBg.set(`${a}>${b}`, noise())
      synergyBg.set(`${a}+${b}`, noise())
    })
  })
  const counter = (a, b) => (a < b
    ? (counterBg.get(`${a}>${b}`) ?? 0) + (counterEffects[`${a}>${b}`] ?? 0) - (counterEffects[`${b}>${a}`] ?? 0)
    : -counter(b, a))
  const sampled = (wr) => Math.round(n * wr + Math.sqrt(n * wr * (1 - wr)) * normal(random))
  ids.forEach((a) => {
    ids.forEach((b) => {
      if (a >= b) return
      // одни и те же матчи с двух сторон: победы героя a — это поражения героя b
      const wins = sampled(BASE[a] - (BASE[b] - 0.5) + counter(a, b))
      counterRows.push([a, b, wins, n], [b, a, n - wins, n])
      const team = 0.5 + (BASE[a] - 0.5) + (BASE[b] - 0.5) + (synergyBg.get(`${a}+${b}`) ?? 0) + (synergyEffects[`${a}+${b}`] ?? 0)
      synergyRows.push([a, b, sampled(team), n])
    })
  })
  const heroes = ids.map((id) => ({ id, name: `H${String(id).padStart(2, '0')}`, role: id % 2 ? 'Brawler' : 'Mystic', released: true, stats: { winrate: BASE[id], games_played: 100000 } }))
  return { heroes, counters: buildCounterIndex(counterRows), synergy: buildSynergyIndex(synergyRows) }
}

describe('baselinesOf', () => {
  it('is the matches-weighted win rate of the hero row', () => {
    const index = buildCounterIndex([[1, 2, 60, 100], [1, 3, 10, 100], [2, 1, 40, 100]])
    const base = baselinesOf(index)
    expect(base.get(1)).toBeCloseTo(0.35, 10)
    expect(base.get(2)).toBeCloseTo(0.4, 10)
    expect(base.get(9)).toBeUndefined()
  })
})

describe('pureEffect', () => {
  it('removes the strength of the other hero (a strong enemy lowers every win rate against it)', () => {
    expect(pureEffect('counter', 0.44, 0.5, 0.56)).toBeCloseTo(0, 10)
    expect(pureEffect('counter', 0.47, 0.5, 0.56)).toBeCloseTo(0.03, 10)
  })

  it('removes the strength of an ally (a strong ally raises every win rate with it)', () => {
    expect(pureEffect('synergy', 0.56, 0.5, 0.56)).toBeCloseTo(0, 10)
    expect(pureEffect('synergy', 0.6, 0.5, 0.56)).toBeCloseTo(0.04, 10)
  })
})

describe('tau (how big real pair effects are)', () => {
  const tauOf = (index, kind) => Math.sqrt(estimateTau2(index, kind, baselinesOf(index)))

  it('is practically zero when pair win rates are explained by hero strength alone', () => {
    const { counters, synergy } = world({ spread: 0 })
    expect(tauOf(counters, 'counter')).toBeLessThan(0.003)
    expect(tauOf(synergy, 'synergy')).toBeLessThan(0.003)
  })

  it('recovers the size of the real pair effects', () => {
    const { counters, synergy } = world({ spread: 0.01 })
    expect(tauOf(counters, 'counter')).toBeGreaterThan(0.008)
    expect(tauOf(counters, 'counter')).toBeLessThan(0.0125)
    expect(tauOf(synergy, 'synergy')).toBeGreaterThan(0.008)
    expect(tauOf(synergy, 'synergy')).toBeLessThan(0.0125)
  })

  it('is smaller than the planted effects when the sample is small (noise is not counted as effect)', () => {
    const big = tauOf(world({ spread: 0.01, n: 50000 }).counters, 'counter')
    const small = tauOf(world({ spread: 0.01, n: 400 }).counters, 'counter')
    expect(Math.abs(small - big)).toBeLessThan(0.006) // шум вычтен: оценка остаётся около настоящей
  })

  it('on real data (30 days, all ranks) is well under 2 pp: counters are weak in Deadlock', () => {
    const counters = buildCounterIndex(real.counters)
    const synergy = buildSynergyIndex(real.synergy)
    expect(tauOf(counters, 'counter')).toBeGreaterThan(0.003)
    expect(tauOf(counters, 'counter')).toBeLessThan(0.015)
    expect(tauOf(synergy, 'synergy')).toBeGreaterThan(0.003)
    expect(tauOf(synergy, 'synergy')).toBeLessThan(0.015)
  })
})

describe('rankDraft', () => {
  it('without picks ranks by hero strength', () => {
    const { rows } = rankDraft({ ...world() })
    expect(rows.map((r) => r.hero.id)).toEqual(Array.from({ length: N }, (_, i) => N - i))
    expect(rows.every((r) => r.advantage === 0 && r.certainty === 1 && r.coverage.requested === 0)).toBe(true)
  })

  it('does not offer heroes that are already picked or unavailable', () => {
    const { rows } = rankDraft({ ...world(), enemies: [1], allies: [2], excluded: [3] })
    expect(rows).toHaveLength(N - 3)
    expect(rows.map((r) => r.hero.id)).not.toContain(1)
    expect(rows.map((r) => r.hero.id)).not.toContain(2)
    expect(rows.map((r) => r.hero.id)).not.toContain(3)
  })

  it('credits a planted counter to the right hero and to nobody else', () => {
    const w = world({ spread: 0.004, counterEffects: { '12>20': 0.05 } }) // герой 12 силён именно против героя 20
    const { rows } = rankDraft({ ...w, enemies: [20] })
    const planted = rows.find((r) => r.hero.id === 12)
    expect(planted.counter.total).toBeGreaterThan(0.03) // 0,05 заплантовано; сильный выброс сглаживается чуть-чуть
    const others = rows.filter((r) => r.hero.id !== 12)
    expect(Math.max(...others.map((r) => Math.abs(r.counter.total)))).toBeLessThan(0.02)
    // и он поднимается в рейтинге выше, чем был бы по силе (место по силе — 19-е из 29)
    const byStrength = [...rows].sort((a, b) => b.base - a.base).findIndex((r) => r.hero.id === 12)
    expect(rows.indexOf(planted)).toBeLessThan(byStrength)
  })

  it('credits a planted synergy to the right hero', () => {
    const w = world({ spread: 0.004, synergyEffects: { '8+15': 0.05 } })
    const { rows } = rankDraft({ ...w, allies: [15] })
    const planted = rows.find((r) => r.hero.id === 8)
    expect(planted.synergy.total).toBeGreaterThan(0.03)
    expect(Math.max(...rows.filter((r) => r.hero.id !== 8).map((r) => Math.abs(r.synergy.total)))).toBeLessThan(0.02)
  })

  it('smooths effects measured on a small sample toward zero', () => {
    const big = rankDraft({ ...world({ spread: 0.01, n: 50000 }), enemies: [20] })
    const small = rankDraft({ ...world({ spread: 0.01, n: 300 }), enemies: [20] })
    const item = (res) => res.rows.find((r) => r.hero.id === 12).counter.items[0]
    expect(item(big).weight).toBeGreaterThan(0.8)
    expect(item(small).weight).toBeLessThan(item(big).weight)
    expect(Math.abs(item(small).effect)).toBeLessThanOrEqual(Math.abs(item(small).pure))
    expect(small.rows.find((r) => r.hero.id === 12).certainty).toBeLessThan(big.rows.find((r) => r.hero.id === 12).certainty)
  })

  it('adjusted = base + counters + synergy, and rows are sorted by it', () => {
    const w = world({ spread: 0.008, counterEffects: { '12>20': 0.05, '5>9': 0.03 }, synergyEffects: { '8+15': 0.02 } })
    const { rows } = rankDraft({ ...w, enemies: [20, 9], allies: [15] })
    rows.forEach((r) => expect(r.adjusted).toBeCloseTo(r.base + r.counter.total + r.synergy.total, 12))
    expect(rows.map((r) => r.adjusted)).toEqual([...rows.map((r) => r.adjusted)].sort((a, b) => b - a))
  })

  it('marks pairs without data and reports the coverage', () => {
    const { rows } = rankDraft({ ...world(), enemies: [1, 999] })
    const row = rows[0]
    expect(row.counter.items.find((item) => item.id === 999)).toEqual({ id: 999, missing: true })
    expect(row.coverage).toEqual({ used: 1, requested: 2 })
  })

  it('filters by role and drops heroes with too few matches to trust their win rate', () => {
    const w = world()
    w.heroes[0].stats.games_played = 5 // герой 1 почти не играется
    expect(rankDraft({ ...w, role: 'Mystic' }).rows.every((r) => r.hero.role === 'Mystic')).toBe(true)
    expect(rankDraft({ ...w }).rows.map((r) => r.hero.id)).not.toContain(1)
  })

  it('ignores heroes that are not released', () => {
    const w = world()
    w.heroes[3].released = false
    expect(rankDraft({ ...w }).rows.map((r) => r.hero.id)).not.toContain(4)
  })

  it('is deterministic for equal scores (by base, then by name)', () => {
    const w = world()
    w.heroes.forEach((h) => { h.stats.winrate = 0.5 })
    const { rows } = rankDraft({ ...w })
    expect(rows.map((r) => r.hero.name)).toEqual(w.heroes.map((h) => h.name).sort())
  })
})

describe('rankDraft on real matrices', () => {
  const counters = buildCounterIndex(real.counters)
  const synergy = buildSynergyIndex(real.synergy)
  const heroes = [...baselinesOf(counters).entries()].map(([id, winrate]) => ({
    id, name: `Hero ${id}`, released: true, role: id % 3 ? 'Brawler' : 'Mystic', stats: { winrate, games_played: 1_000_000 },
  }))

  it('covers all 38 heroes and keeps the order by strength when nothing is picked', () => {
    const { rows } = rankDraft({ heroes, counters, synergy })
    expect(rows).toHaveLength(38)
    expect(rows.map((r) => r.base)).toEqual([...rows.map((r) => r.base)].sort((a, b) => b - a))
  })

  it('keeps pair effects small next to hero strength (they are weak and smoothed)', () => {
    const { rows } = rankDraft({ heroes, counters, synergy, enemies: [7, 18, 1, 13, 64, 31], allies: [25, 6, 16, 50, 35] })
    expect(rows).toHaveLength(38 - 11)
    const advantages = rows.map((r) => r.advantage)
    expect(Math.max(...advantages)).toBeLessThan(0.08)
    expect(Math.min(...advantages)).toBeGreaterThan(-0.08)
    rows.forEach((r) => {
      r.counter.items.concat(r.synergy.items).filter((i) => !i.missing).forEach((i) => {
        expect(Math.abs(i.effect)).toBeLessThanOrEqual(Math.abs(i.pure) + 1e-12)
        expect(i.weight).toBeGreaterThan(0)
        expect(i.weight).toBeLessThanOrEqual(1)
      })
    })
  })

  it('has full coverage for real heroes: every pair exists in the matrices', () => {
    const { rows } = rankDraft({ heroes, counters, synergy, enemies: [7, 18], allies: [25] })
    expect(rows.every((r) => r.coverage.used === r.coverage.requested)).toBe(true)
  })

  it('the pure counter effect is antisymmetric: if A counters B, B is countered by A by the same amount', () => {
    const a = rankDraft({ heroes, counters, synergy, enemies: [7] }).rows.find((r) => r.hero.id === 18).counter.items[0]
    const b = rankDraft({ heroes, counters, synergy, enemies: [18] }).rows.find((r) => r.hero.id === 7).counter.items[0]
    expect(a.pure).toBeCloseTo(-b.pure, 3)
  })
})

describe('certaintyLevel', () => {
  it('has three levels', () => {
    expect(certaintyLevel(1)).toBe('high')
    expect(certaintyLevel(0.6)).toBe('high')
    expect(certaintyLevel(0.4)).toBe('medium')
    expect(certaintyLevel(0.1)).toBe('low')
  })
})

describe('selection', () => {
  it('adds a hero to the chosen list and moves it from another one', () => {
    let s = toggleHero(EMPTY_SELECTION, 'enemies', 5)
    expect(s).toEqual({ enemies: [5], allies: [], excluded: [] })
    s = toggleHero(s, 'allies', 5)
    expect(s).toEqual({ enemies: [], allies: [5], excluded: [] })
    s = toggleHero(s, 'allies', 5)
    expect(s).toEqual({ enemies: [], allies: [], excluded: [] })
  })

  it('does not mutate the previous selection', () => {
    const before = { enemies: [1], allies: [], excluded: [] }
    toggleHero(before, 'enemies', 2)
    expect(before).toEqual({ enemies: [1], allies: [], excluded: [] })
  })

  it('refuses to exceed the team size and tells so by returning the same object', () => {
    let s = EMPTY_SELECTION
    for (let id = 1; id <= MAX_ENEMIES; id++) s = toggleHero(s, 'enemies', id)
    expect(isListFull(s, 'enemies')).toBe(true)
    expect(toggleHero(s, 'enemies', 99)).toBe(s)
    let t = EMPTY_SELECTION
    for (let id = 1; id <= MAX_ALLIES; id++) t = toggleHero(t, 'allies', id)
    expect(toggleHero(t, 'allies', 99)).toBe(t)
    // убрать героя можно и из заполненного списка
    expect(toggleHero(t, 'allies', 1).allies).toHaveLength(MAX_ALLIES - 1)
  })

  it('has no limit for unavailable heroes', () => {
    let s = EMPTY_SELECTION
    for (let id = 1; id <= 20; id++) s = toggleHero(s, 'excluded', id)
    expect(s.excluded).toHaveLength(20)
  })

  it('round-trips through the address bar and ignores junk', () => {
    const selection = { enemies: [1, 2, 3], allies: [4, 5], excluded: [6] }
    const params = new URLSearchParams(selectionParams(selection))
    expect(params.toString()).toBe('e=1%2C2%2C3&a=4%2C5&x=6')
    expect(parseSelection(params, [1, 2, 3, 4, 5, 6, 7])).toEqual(selection)
    expect(selectionParams(EMPTY_SELECTION)).toEqual({})
  })

  it('writes a readable query string with commas as they are and reads it back', () => {
    const selection = { enemies: [13, 6, 16], allies: [31, 11], excluded: [] }
    const search = selectionSearch(selection, 'Brawler')
    expect(search).toBe('?e=13,6,16&a=31,11&r=Brawler')
    expect(parseSelection(new URLSearchParams(search), [6, 11, 13, 16, 31])).toEqual(selection)
    expect(selectionSearch(EMPTY_SELECTION)).toBe('')
    expect(selectionSearch(EMPTY_SELECTION, 'all')).toBe('')
    expect(selectionSearch({ enemies: [], allies: [], excluded: [5, 7] })).toBe('?x=5,7')
    expect(selectionSearch(EMPTY_SELECTION, 'Hard & Fast')).toBe('?r=Hard%20%26%20Fast')
  })

  it('reads only known heroes, without repeats, within the limits; the first mention wins', () => {
    const params = new URLSearchParams('e=1,1,abc,99,2,3,4,5,6,7&a=2,8&x=8,9')
    const valid = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(parseSelection(params, valid)).toEqual({ enemies: [1, 2, 3, 4, 5, 6], allies: [8], excluded: [9] })
    expect(parseSelection(new URLSearchParams(''), valid)).toEqual({ enemies: [], allies: [], excluded: [] })
  })
})
