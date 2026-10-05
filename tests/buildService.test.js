import { describe, expect, it } from 'vitest'
import {
  BUDGET,
  BUILD_SIZE,
  DEFAULT_OPTIONS,
  HISTORY_LIMIT,
  SEED_COUNT,
  SLOTS,
  assembleBuild,
  balancedCounts,
  buildFromEntry,
  buildSearch,
  clampBudget,
  dailySeed,
  dayKey,
  formatSeed,
  hashString,
  historyEntry,
  isDefaultOptions,
  makeBuild,
  normalizeHistory,
  normalizeOptions,
  normalizeSlots,
  parseBuildSearch,
  parseSeed,
  phaseSizes,
  pickHero,
  pushHistory,
  randomSeed,
  sortForPurchase,
  usefulItemIds,
} from '../src/services/buildService.js'

const COSTS = [800, 1600, 3200, 6400, 9999]
const TIER = { 800: 1, 1600: 2, 3200: 3, 6400: 4, 9999: 5 }

/** Справочник: по `perSlot` предметов в каждом слоте, цены по кругу. */
function catalog(perSlot = 20) {
  const items = []
  let id = 100
  SLOTS.forEach((slot) => {
    for (let i = 0; i < perSlot; i += 1) {
      const cost = COSTS[i % COSTS.length]
      items.push({ id, name: `${slot}-${i}`, item_slot_type: slot, cost, item_tier: TIER[cost] })
      id += 1
    }
  })
  return items
}

const heroes = [1, 2, 6, 13, 65].map((id) => ({ id, name: `Hero ${id}` }))
const ITEMS = catalog()
const slotCounts = (build) => Object.fromEntries(SLOTS.map((slot) => [slot, build.items.filter((i) => i.item_slot_type === slot).length]))
const build = (overrides = {}) => makeBuild({ hero: heroes[0], items: ITEMS, options: DEFAULT_OPTIONS, seed: 1234, ...overrides })

describe('seed', () => {
  it('hashes a string to the same 32 bits every time and spreads close strings apart', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
    expect(hashString('')).toBeGreaterThanOrEqual(0)
    expect(hashString('x')).toBeLessThan(2 ** 32)
  })

  it('writes the seed as four hex digits and two decimal ones, and reads it back', () => {
    expect(formatSeed(0)).toBe('0000-00')
    expect(formatSeed(42)).toBe('0000-42')
    expect(formatSeed(SEED_COUNT - 1)).toBe('FFFF-99')
    expect(parseSeed('FFFF-99')).toBe(SEED_COUNT - 1)
    for (const seed of [0, 1, 99, 100, 4_265_017, 6_553_599]) expect(parseSeed(formatSeed(seed))).toBe(seed)
  })

  it('reads a seed with a hash sign and in lower case, and rejects the rest', () => {
    expect(parseSeed('#a7f3-29')).toBe(parseSeed('A7F3-29'))
    expect(parseSeed(' A7F3-29 ')).toBe(parseSeed('A7F3-29'))
    for (const bad of [null, undefined, '', 'A7F3', 'A7F3-2', 'A7F3-290', 'G7F3-29', 'A7F3_29']) expect(parseSeed(bad), String(bad)).toBeNull()
  })

  it('clamps a seed that is out of range when writing it', () => {
    expect(formatSeed(-5)).toBe('0000-00')
    expect(formatSeed(SEED_COUNT * 3)).toBe('FFFF-99')
    expect(formatSeed('abc')).toBe('0000-00')
  })

  it('draws a random seed in range', () => {
    expect(randomSeed(() => 0)).toBe(0)
    expect(randomSeed(() => 0.999999999)).toBe(SEED_COUNT - 1)
    const seed = randomSeed()
    expect(Number.isInteger(seed) && seed >= 0 && seed < SEED_COUNT).toBe(true)
  })

  it('gives every day of the build of the day its own stable seed', () => {
    expect(dailySeed('2026-10-05')).toBe(dailySeed('2026-10-05'))
    expect(dailySeed('2026-10-05')).not.toBe(dailySeed('2026-10-06'))
    expect(dailySeed('2026-10-05')).toBeLessThan(SEED_COUNT)
    // дата — местная: проверка не зависит от часового пояса машины
    expect(dayKey(new Date(2026, 9, 5, 23, 59, 59))).toBe('2026-10-05')
    expect(dayKey(new Date(2026, 9, 6, 0, 0, 0))).toBe('2026-10-06')
    expect(dayKey(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

describe('options', () => {
  it('keeps slots in the canonical order and drops the unknown', () => {
    expect(normalizeSlots(['vitality', 'weapon', 'x'])).toEqual(['weapon', 'vitality'])
    expect(normalizeSlots(null)).toEqual([])
  })

  it('clamps the budget to the slider and its step', () => {
    expect(clampBudget(50000)).toBe(50000)
    expect(clampBudget(1)).toBe(BUDGET.min)
    expect(clampBudget(1e9)).toBe(BUDGET.max)
    expect(clampBudget(42_400)).toBe(42_000)
    expect(clampBudget('abc')).toBe(BUDGET.default)
  })

  it('fills in the defaults and cleans junk', () => {
    expect(normalizeOptions(undefined)).toEqual({ heroId: null, slots: SLOTS, mode: 'balance', budget: 50000, useful: true })
    expect(normalizeOptions({ heroId: '6', slots: ['spirit'], mode: 'random', budget: 30000, useful: false }))
      .toEqual({ heroId: 6, slots: ['spirit'], mode: 'random', budget: 30000, useful: false })
    expect(normalizeOptions({ heroId: -3, slots: ['nope'], mode: 'weird' })).toMatchObject({ heroId: null, slots: SLOTS, mode: 'balance' })
  })

  it('recognises the default options', () => {
    expect(isDefaultOptions(DEFAULT_OPTIONS)).toBe(true)
    expect(isDefaultOptions({ ...DEFAULT_OPTIONS, budget: 40000 })).toBe(false)
    expect(isDefaultOptions({ ...DEFAULT_OPTIONS, heroId: 6 })).toBe(false)
    expect(isDefaultOptions({ ...DEFAULT_OPTIONS, slots: ['weapon'] })).toBe(false)
    expect(isDefaultOptions({ ...DEFAULT_OPTIONS, useful: false })).toBe(false)
  })
})

describe('pickHero', () => {
  it('returns the chosen hero, or null when it has left the game', () => {
    expect(pickHero(heroes, { heroId: 6 }, 5).id).toBe(6)
    expect(pickHero(heroes, { heroId: 999 }, 5)).toBeNull()
  })

  it('draws the same hero from the same seed whatever the order of the list', () => {
    const forward = pickHero(heroes, { heroId: null }, 777)
    const backward = pickHero([...heroes].reverse(), { heroId: null }, 777)
    expect(forward.id).toBe(backward.id)
  })

  it('draws every hero given enough seeds', () => {
    const seen = new Set()
    for (let seed = 0; seed < 300; seed += 1) seen.add(pickHero(heroes, { heroId: null }, seed).id)
    expect(seen.size).toBe(heroes.length)
  })

  it('keeps its choice when another hero appears, unless the newcomer wins', () => {
    const newcomer = { id: 999, name: 'Newcomer' }
    let changed = 0
    for (let seed = 0; seed < 300; seed += 1) {
      const before = pickHero(heroes, { heroId: null }, seed)
      const after = pickHero([...heroes, newcomer], { heroId: null }, seed)
      if (after.id !== before.id) {
        changed += 1
        expect(after.id).toBe(newcomer.id)
      }
    }
    expect(changed).toBeGreaterThan(0)
    expect(changed).toBeLessThan(120) // примерно каждый шестой, а не каждый второй
  })

  it('has nobody to pick from an empty list', () => {
    expect(pickHero([], { heroId: null }, 1)).toBeNull()
  })
})

describe('order of purchase and phases', () => {
  it('buys the cheap first and breaks ties by tier, slot and name', () => {
    const items = [
      { id: 1, name: 'b', item_slot_type: 'vitality', cost: 800, item_tier: 1 },
      { id: 2, name: 'a', item_slot_type: 'spirit', cost: 800, item_tier: 1 },
      { id: 3, name: 'z', item_slot_type: 'weapon', cost: 800, item_tier: 1 },
      { id: 4, name: 'c', item_slot_type: 'weapon', cost: 6400, item_tier: 4 },
      { id: 5, name: 'd', item_slot_type: 'weapon', cost: 1600, item_tier: 2 },
    ]
    expect(sortForPurchase(items).map((i) => i.id)).toEqual([3, 2, 1, 5, 4])
  })

  it('does not change the list it sorts', () => {
    const items = [{ id: 2, cost: 5 }, { id: 1, cost: 1 }]
    sortForPurchase(items)
    expect(items.map((i) => i.id)).toEqual([2, 1])
  })

  it('cuts twelve items into three phases of four, and any other count as evenly as possible', () => {
    expect(phaseSizes(12)).toEqual([4, 4, 4])
    expect(phaseSizes(11)).toEqual([4, 4, 3])
    expect(phaseSizes(10)).toEqual([4, 3, 3])
    expect(phaseSizes(5)).toEqual([2, 2, 1])
    expect(phaseSizes(1)).toEqual([1, 0, 0])
    expect(phaseSizes(0)).toEqual([0, 0, 0])
  })
})

describe('balancedCounts', () => {
  const order = ['weapon', 'spirit', 'vitality']

  it('splits evenly', () => {
    expect(balancedCounts(12, order, {}, { weapon: 20, spirit: 20, vitality: 20 })).toEqual({ weapon: 4, spirit: 4, vitality: 4 })
    expect(balancedCounts(12, ['weapon', 'spirit'], {}, { weapon: 20, spirit: 20 })).toEqual({ weapon: 6, spirit: 6 })
    expect(balancedCounts(12, ['spirit'], {}, { spirit: 20 })).toEqual({ spirit: 12 })
  })

  it('gives the odd item to the slot that comes first in the order', () => {
    expect(balancedCounts(10, order, {}, { weapon: 20, spirit: 20, vitality: 20 })).toEqual({ weapon: 4, spirit: 3, vitality: 3 })
    expect(balancedCounts(10, ['vitality', 'weapon', 'spirit'], {}, { weapon: 20, spirit: 20, vitality: 20 })).toEqual({ weapon: 3, spirit: 3, vitality: 4 })
  })

  it('counts what is already taken (pinned) and evens out the rest', () => {
    // В оружии уже два закреплённых: остальные десять делятся так, чтобы всего вышло 4 / 4 / 4
    expect(balancedCounts(10, order, { weapon: 2 }, { weapon: 20, spirit: 20, vitality: 20 })).toEqual({ weapon: 2, spirit: 4, vitality: 4 })
  })

  it('moves the shortfall to the other slots when one slot runs out', () => {
    expect(balancedCounts(12, order, {}, { weapon: 2, spirit: 20, vitality: 20 })).toEqual({ weapon: 2, spirit: 5, vitality: 5 })
  })

  it('takes what exists when there are not enough items at all', () => {
    expect(balancedCounts(12, order, {}, { weapon: 1, spirit: 2, vitality: 3 })).toEqual({ weapon: 1, spirit: 2, vitality: 3 })
  })
})

describe('makeBuild', () => {
  it('picks twelve different items in the chosen slots, four of each in balance mode', () => {
    const result = build()
    expect(result.items).toHaveLength(BUILD_SIZE)
    expect(new Set(result.items.map((i) => i.id)).size).toBe(BUILD_SIZE)
    expect(slotCounts(result)).toEqual({ weapon: 4, spirit: 4, vitality: 4 })
    expect(result.hero.id).toBe(1)
    expect(result.seedLabel).toBe(formatSeed(1234))
  })

  it('divides six and six between two slots and twelve for one', () => {
    expect(slotCounts(build({ options: { ...DEFAULT_OPTIONS, slots: ['weapon', 'spirit'] } }))).toEqual({ weapon: 6, spirit: 6, vitality: 0 })
    expect(slotCounts(build({ options: { ...DEFAULT_OPTIONS, slots: ['vitality'] } }))).toEqual({ weapon: 0, spirit: 0, vitality: 12 })
  })

  it('makes the same build from the same seed and a different one from another', () => {
    const ids = (r) => r.items.map((i) => i.id).join()
    expect(ids(build())).toBe(ids(build()))
    expect(ids(build({ seed: 9999 }))).not.toBe(ids(build()))
  })

  it('does not depend on the order of the catalogue', () => {
    const ids = (r) => r.items.map((i) => i.id).join()
    expect(ids(build({ items: [...ITEMS].reverse() }))).toBe(ids(build()))
  })

  it('changes by at most one item when the shop gains an item (the build of the day does not fall apart)', () => {
    const extra = { id: 5000, name: 'extra', item_slot_type: 'spirit', cost: 800, item_tier: 1 }
    const options = { ...DEFAULT_OPTIONS, budget: BUDGET.max }
    for (let seed = 0; seed < 60; seed += 1) {
      const before = new Set(build({ seed, options }).items.map((i) => i.id))
      const after = new Set(build({ seed, options, items: [...ITEMS, extra] }).items.map((i) => i.id))
      const lost = [...before].filter((id) => !after.has(id))
      expect(lost.length, `seed ${seed}`).toBeLessThanOrEqual(1)
    }
  })

  it('changes by at most one item when one item starts or stops being useful for the hero', () => {
    const everything = new Set(ITEMS.map((i) => i.id))
    const options = { ...DEFAULT_OPTIONS, budget: BUDGET.max }
    const without = new Set([...everything].filter((id) => id !== ITEMS[3].id))
    for (let seed = 0; seed < 60; seed += 1) {
      const before = new Set(build({ seed, options, useful: everything }).items.map((i) => i.id))
      const after = new Set(build({ seed, options, useful: without }).items.map((i) => i.id))
      expect([...before].filter((id) => !after.has(id)).length, `seed ${seed}`).toBeLessThanOrEqual(1)
    }
  })

  it('pinning items that are already in the build leaves the rest of it as it was', () => {
    for (const mode of ['balance', 'random']) {
      for (let seed = 0; seed < 25; seed += 1) {
        const options = { ...DEFAULT_OPTIONS, mode, budget: BUDGET.max }
        const base = build({ seed, options }).items.map((i) => i.id)
        const pinned = build({ seed, options, pins: [base[1], base[7]] }).items.map((i) => i.id)
        expect([...pinned].sort((a, b) => a - b), `${mode}/${seed}`).toEqual([...base].sort((a, b) => a - b))
      }
    }
  })

  it('in random mode ignores the slot balance but keeps twelve unique items from the chosen slots', () => {
    let uneven = false
    for (let seed = 0; seed < 40; seed += 1) {
      const result = build({ seed, options: { ...DEFAULT_OPTIONS, mode: 'random', slots: ['weapon', 'spirit'] } })
      expect(result.items).toHaveLength(BUILD_SIZE)
      expect(new Set(result.items.map((i) => i.id)).size).toBe(BUILD_SIZE)
      expect(result.items.every((i) => i.item_slot_type !== 'vitality')).toBe(true)
      if (slotCounts(result).weapon !== 6) uneven = true
    }
    expect(uneven).toBe(true)
  })

  it('keeps the pinned items, counts them toward the slots and fills the rest', () => {
    const pinned = [ITEMS[0].id, ITEMS[1].id] // два предмета оружия
    const result = build({ pins: pinned, options: { ...DEFAULT_OPTIONS, budget: BUDGET.max } })
    expect(pinned.every((id) => result.items.some((i) => i.id === id))).toBe(true)
    expect(result.items).toHaveLength(BUILD_SIZE)
    expect(slotCounts(result)).toEqual({ weapon: 4, spirit: 4, vitality: 4 })
    const flagged = result.phases.flatMap((p) => p.entries).filter((entry) => entry.pinned).map((entry) => entry.item.id)
    expect(flagged.sort()).toEqual([...pinned].sort())
  })

  it('rerolls only what is not pinned when the seed changes', () => {
    const pinned = [ITEMS[0].id, ITEMS[25].id]
    const a = build({ pins: pinned, seed: 1, options: { ...DEFAULT_OPTIONS, budget: BUDGET.max } })
    const b = build({ pins: pinned, seed: 2, options: { ...DEFAULT_OPTIONS, budget: BUDGET.max } })
    expect(pinned.every((id) => a.items.some((i) => i.id === id) && b.items.some((i) => i.id === id))).toBe(true)
    expect(a.items.map((i) => i.id).join()).not.toBe(b.items.map((i) => i.id).join())
  })

  it('ignores a pinned item that is unknown or lies in a slot that is switched off', () => {
    const vitality = ITEMS.find((i) => i.item_slot_type === 'vitality')
    const result = build({ pins: [vitality.id, 99999], options: { ...DEFAULT_OPTIONS, slots: ['weapon', 'spirit'], budget: BUDGET.max } })
    expect(result.items.some((i) => i.id === vitality.id)).toBe(false)
    expect(result.items).toHaveLength(BUILD_SIZE)
  })

  it('takes twelve pinned items as they are', () => {
    const pins = ITEMS.slice(0, 12).map((i) => i.id)
    const result = build({ pins, options: { ...DEFAULT_OPTIONS, slots: SLOTS, budget: BUDGET.max } })
    expect(result.items.map((i) => i.id).sort((a, b) => a - b)).toEqual([...pins].sort((a, b) => a - b))
  })

  it('stays within the budget when it can', () => {
    for (const budget of [20000, 30000, 40000, 50000, 60000]) {
      for (let seed = 0; seed < 25; seed += 1) {
        const result = build({ seed, options: { ...DEFAULT_OPTIONS, budget } })
        expect(result.totals.total, `${budget}/${seed}`).toBeLessThanOrEqual(budget)
        expect(result.overBudget).toBe(false)
        expect(result.items).toHaveLength(BUILD_SIZE)
      }
    }
  })

  it('reaches the cheapest possible build at the lowest budget', () => {
    const result = build({ options: { ...DEFAULT_OPTIONS, budget: BUDGET.min } })
    expect(result.overBudget).toBe(false)
    expect(result.totals.total).toBeLessThanOrEqual(BUDGET.min)
  })

  it('says so when the budget cannot be met, and never replaces a pinned item', () => {
    const expensive = ITEMS.filter((i) => i.cost === 9999).slice(0, 6).map((i) => i.id)
    const result = build({ pins: expensive, options: { ...DEFAULT_OPTIONS, budget: BUDGET.min } })
    expect(result.overBudget).toBe(true)
    expect(expensive.every((id) => result.items.some((i) => i.id === id))).toBe(true)
  })

  it('prefers the items useful for the hero and falls back to the others when they run out', () => {
    const useful = new Set(ITEMS.filter((i) => i.item_slot_type === 'weapon' && i.cost <= 3200).map((i) => i.id)
      .concat(ITEMS.filter((i) => i.item_slot_type !== 'weapon').map((i) => i.id)))
    const result = build({ useful, options: { ...DEFAULT_OPTIONS, budget: BUDGET.max } })
    expect(result.usefulApplied).toBe(true)
    expect(result.items.every((i) => useful.has(i.id))).toBe(true)

    const few = new Set(ITEMS.filter((i) => i.item_slot_type === 'weapon').slice(0, 2).map((i) => i.id))
    const relaxed = build({ useful: few, options: { ...DEFAULT_OPTIONS, budget: BUDGET.max } })
    expect(relaxed.items).toHaveLength(BUILD_SIZE) // полезных оружейных всего два — остальное добрано из прочих
    expect(relaxed.items.filter((i) => few.has(i.id))).toHaveLength(2)
  })

  it('does not filter when the option is off or there is no data', () => {
    const useful = new Set([ITEMS[0].id])
    expect(build({ useful, options: { ...DEFAULT_OPTIONS, useful: false } }).usefulApplied).toBe(false)
    expect(build({ useful: null }).usefulApplied).toBe(false)
    expect(build({ useful: new Set() }).usefulApplied).toBe(false)
  })

  it('takes as many items as exist when the catalogue is small', () => {
    const result = build({ items: catalog(1) })
    expect(result.items).toHaveLength(3)
    expect(slotCounts(result)).toEqual({ weapon: 1, spirit: 1, vitality: 1 })
  })

  it('reports a missing choice of slots and an empty catalogue', () => {
    expect(build({ options: { ...DEFAULT_OPTIONS, slots: [] } })).toEqual({ error: 'noSlots' })
    expect(build({ items: [] })).toEqual({ error: 'noItems' })
  })
})

describe('assembleBuild', () => {
  const items = ITEMS.slice(0, 12)

  it('splits the order of purchase into three phases with their own sums', () => {
    const result = assembleBuild({ hero: heroes[0], items, seed: 5, options: DEFAULT_OPTIONS })
    expect(result.phases.map((p) => p.id)).toEqual(['early', 'mid', 'late'])
    expect(result.phases.map((p) => p.entries.length)).toEqual([4, 4, 4])
    expect(result.phases.reduce((sum, p) => sum + p.total, 0)).toBe(result.totals.total)
    const costs = result.phases.flatMap((p) => p.entries.map((e) => e.item.cost))
    expect(costs).toEqual([...costs].sort((a, b) => a - b))
  })

  it('totals by slot add up to the whole', () => {
    const { totals } = assembleBuild({ hero: heroes[0], items, seed: 5, options: DEFAULT_OPTIONS })
    expect(totals.weapon + totals.spirit + totals.vitality).toBe(totals.total)
    expect(totals.total).toBe(items.reduce((sum, i) => sum + i.cost, 0))
  })

  it('flags pinned items', () => {
    const result = assembleBuild({ hero: heroes[0], items, seed: 5, options: DEFAULT_OPTIONS, pinnedIds: [items[3].id] })
    const flagged = result.phases.flatMap((p) => p.entries).filter((e) => e.pinned)
    expect(flagged.map((e) => e.item.id)).toEqual([items[3].id])
  })
})

describe('useful items', () => {
  const rows = (n, matches) => Array.from({ length: n }, (_, i) => ({ itemId: 1000 + i, matches: typeof matches === 'function' ? matches(i) : matches }))

  it('keeps the items bought in at least one percent of the hero matches', () => {
    const data = [...rows(40, 5000), { itemId: 1, matches: 100 }, { itemId: 2, matches: 399 }]
    const set = usefulItemIds(data, 40_000)
    expect(set.has(2)).toBe(false) // 399 из 40 000 — чуть меньше одного процента
    expect(set.has(1)).toBe(false)
    expect(set.size).toBe(40)
    expect(usefulItemIds([...data, { itemId: 3, matches: 400 }], 40_000).has(3)).toBe(true) // ровно один процент проходит
  })

  it('lowers the threshold when too few items pass', () => {
    const data = [...rows(10, 5000), ...rows(40, 250).map((r, i) => ({ ...r, itemId: 2000 + i }))]
    const set = usefulItemIds(data, 40_000) // 1 % = 400: прошли 10, затем порог 0,5 % = 200: прошли все 50
    expect(set.size).toBe(50)
  })

  it('does not filter when even the lowest threshold leaves too few', () => {
    expect(usefulItemIds(rows(10, 5000), 40_000)).toBeNull()
    expect(usefulItemIds([], 40_000)).toBeNull()
    expect(usefulItemIds(null, 40_000)).toBeNull()
  })

  it('measures against the most popular item when the hero matches are unknown', () => {
    const data = [{ itemId: 1, matches: 10_000 }, ...rows(40, 1000).map((r, i) => ({ ...r, itemId: 3000 + i }))]
    expect(usefulItemIds(data, 0).size).toBe(41)
  })

  it('ignores rows without matches', () => {
    expect(usefulItemIds([{ itemId: 1, matches: 0 }, { itemId: 2 }, null], 100)).toBeNull()
  })
})

describe('the address of a build', () => {
  const search = (text) => new URLSearchParams(text)

  it('reads everything and checks it', () => {
    const state = parseBuildSearch(search('seed=A7F3-29&hero=6&slots=vitality,weapon&mode=random&budget=42400&useful=0&pin=101,202,101'))
    expect(state.seed).toBe(parseSeed('A7F3-29'))
    expect(state.options).toEqual({ heroId: 6, slots: ['weapon', 'vitality'], mode: 'random', budget: 42000, useful: false })
    expect(state.pins).toEqual([101, 202])
  })

  it('falls back to the defaults for an empty or broken address', () => {
    for (const text of ['', 'seed=zzz&hero=abc&slots=x&mode=y&budget=&pin=a,-1,0,2.5']) {
      const state = parseBuildSearch(search(text))
      expect(state.options).toEqual(normalizeOptions(DEFAULT_OPTIONS))
      expect(state.seed).toBeNull()
      expect(state.pins).toEqual([])
    }
  })

  it('keeps at most twelve pins', () => {
    const many = Array.from({ length: 30 }, (_, i) => i + 1).join(',')
    expect(parseBuildSearch(search(`pin=${many}`)).pins).toHaveLength(BUILD_SIZE)
  })

  it('writes only what differs from the defaults', () => {
    expect(buildSearch({ options: DEFAULT_OPTIONS, seed: 77, pins: [] }, 1)).toBe(`?seed=${formatSeed(77)}`)
    expect(buildSearch({ options: { ...DEFAULT_OPTIONS, heroId: 6, slots: ['spirit', 'weapon'], mode: 'random', budget: 30000, useful: false }, seed: 77, pins: [5, 6] }, 1))
      .toBe(`?seed=${formatSeed(77)}&hero=6&slots=weapon,spirit&mode=random&budget=30000&useful=0&pin=5,6`)
  })

  it('leaves the address clean for the build of the day with the default settings', () => {
    const today = dailySeed('2026-10-05')
    expect(buildSearch({ options: DEFAULT_OPTIONS, seed: today, pins: [] }, today)).toBe('')
    // но закреплённый предмет или другие настройки делают билд «своим»
    expect(buildSearch({ options: DEFAULT_OPTIONS, seed: today, pins: [5] }, today)).toContain('seed=')
    expect(buildSearch({ options: { ...DEFAULT_OPTIONS, budget: 40000 }, seed: today, pins: [] }, today)).toContain('seed=')
  })

  it('round-trips through the address', () => {
    const state = { options: { heroId: 13, slots: ['weapon', 'vitality'], mode: 'random', budget: 25000, useful: false }, seed: 4_265_017, pins: [300, 301] }
    const back = parseBuildSearch(new URLSearchParams(buildSearch(state, 1)))
    expect(back).toEqual(state)
  })
})

describe('history of rolls', () => {
  const made = (seed, overrides = {}) => build({ seed, ...overrides })
  const entryFor = (seed, at = 1000, pins = []) => historyEntry(made(seed), { now: at, pins })

  it('stores the items, the hero, the settings and the total', () => {
    const result = made(10)
    const entry = historyEntry(result, { now: 555, pins: [7, 8] })
    expect(entry).toMatchObject({ seed: 10, heroId: 1, heroName: 'Hero 1', total: result.totals.total, at: 555, pins: [7, 8] })
    expect(entry.itemIds).toEqual(result.items.map((i) => i.id))
    expect(entry.options.slots).toEqual(SLOTS)
  })

  it('puts the newest first, drops an identical repeat and keeps only the last few', () => {
    let history = []
    for (let seed = 1; seed <= HISTORY_LIMIT + 3; seed += 1) history = pushHistory(history, entryFor(seed, seed))
    expect(history).toHaveLength(HISTORY_LIMIT)
    expect(history[0].seed).toBe(HISTORY_LIMIT + 3)
    const again = pushHistory(history, entryFor(HISTORY_LIMIT + 1, 99))
    expect(again).toHaveLength(HISTORY_LIMIT)
    expect(again[0].seed).toBe(HISTORY_LIMIT + 1)
    expect(again.filter((e) => e.seed === HISTORY_LIMIT + 1)).toHaveLength(1)
  })

  it('keeps two rolls apart when only the hero differs', () => {
    const a = historyEntry(made(5), { now: 1 })
    const b = historyEntry(made(5, { hero: heroes[1] }), { now: 2 })
    expect(pushHistory([a], b)).toHaveLength(2)
  })

  it('cleans what comes back from the storage', () => {
    const good = entryFor(3)
    const cleaned = normalizeHistory([good, null, 5, { itemIds: [], heroId: 1, seed: 1, at: 1 }, { ...good, itemIds: ['a'] }, { ...good, heroId: 'x' }, { ...good, at: 'now' }, { ...good, seed: NaN }])
    expect(cleaned).toEqual([normalizeHistory([good])[0]])
    expect(normalizeHistory('junk')).toEqual([])
    expect(normalizeHistory(Array.from({ length: 30 }, () => good))).toHaveLength(HISTORY_LIMIT)
  })

  it('keeps the pins of a record and cleans them on the way back', () => {
    const entry = entryFor(3, 1000, [ITEMS[0].id, ITEMS[1].id])
    expect(normalizeHistory([entry])[0].pins).toEqual([ITEMS[0].id, ITEMS[1].id])
    expect(normalizeHistory([{ ...entry, pins: 'x' }])[0].pins).toEqual([])
    expect(normalizeHistory([{ ...entry, pins: [5, 5, -1, 'a', 6.5, 9] }])[0].pins).toEqual([5, 9])
    expect(normalizeHistory([{ ...entry, pins: Array.from({ length: 30 }, (_, i) => i + 1) }])[0].pins).toHaveLength(BUILD_SIZE)
  })

  it('restores a build from a record, skipping items that have left the shop', () => {
    const entry = entryFor(3)
    const restored = buildFromEntry(entry, ITEMS, heroes)
    expect(restored.items.map((i) => i.id).sort()).toEqual([...entry.itemIds].sort())
    expect(restored.hero.id).toBe(entry.heroId)
    const fewer = buildFromEntry(entry, ITEMS.filter((i) => i.id !== entry.itemIds[0]), heroes)
    expect(fewer.items).toHaveLength(entry.itemIds.length - 1)
    expect(buildFromEntry(entry, [], heroes)).toBeNull()
    expect(buildFromEntry(entry, ITEMS, [])).toBeNull()
  })
})
