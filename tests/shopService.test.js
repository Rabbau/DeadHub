import { describe, expect, it } from 'vitest'
import {
  FULL_ROWS,
  PREVIEW_ROWS,
  SHOP_SLOTS,
  SHOP_TIERS,
  buildShop,
  countBySlot,
  firstShopItem,
  groupByTier,
  itemMonogram,
  sortShopItems,
  tierSummary,
  visibleRows,
} from '../src/services/shopService.js'

const item = (id, name, cost, slot, extra = {}) => ({
  id, name, cost, item_slot_type: slot, shop_image: 'https://x/y.png', shopable: true, disabled: false, ...extra,
})

const ITEMS = [
  item(1, 'Ржавый ствол', 800, 'weapon'),
  item(2, 'Бронебой', 3200, 'weapon'),
  item(3, 'Крепость', 800, 'vitality'),
  item(4, 'Мистический импульс', 800, 'spirit'),
  item(5, 'Конденсатор', 6400, 'weapon'),
  item(6, 'Луч уменьшения', 9999, 'spirit'),
  item(7, 'Быстрый стрелок', 1600, 'weapon'),
  item(8, 'Старьё', 800, 'spirit', { disabled: true }),
  item(9, 'upgrade_stub', 800, 'weapon'),
]

describe('itemMonogram', () => {
  it('takes the first letters of the first two words', () => {
    expect(itemMonogram('Ближняя дистанция')).toBe('БД')
    expect(itemMonogram('Усилитель выстрелов в голову')).toBe('УВ')
  })

  it('uses one letter for a one-word name and survives empty input', () => {
    expect(itemMonogram('Крепость')).toBe('К')
    expect(itemMonogram('  ')).toBe('?')
    expect(itemMonogram(null)).toBe('?')
  })
})

describe('counters', () => {
  it('countBySlot counts per slot and overall', () => {
    expect(countBySlot(ITEMS.slice(0, 7))).toEqual({ all: 7, weapon: 4, vitality: 1, spirit: 2 })
  })

  it('tierSummary counts only items on sale and always lists every tier', () => {
    const summary = tierSummary(ITEMS)
    expect(summary.map((tier) => tier.key)).toEqual(SHOP_TIERS)
    expect(summary.map((tier) => tier.count)).toEqual([3, 1, 1, 1, 1]) // отключённый и «upgrade_stub» не считаются
    expect(summary.find((tier) => tier.key === 't4').cost).toBe(6400)
    expect(tierSummary([]).every((tier) => tier.count === 0)).toBe(true)
  })
})

describe('sortShopItems', () => {
  const alphabet = ITEMS.slice(0, 7)

  it('sorts by name with the language collation', () => {
    expect(sortShopItems(alphabet, { language: 'russian' }).map((i) => i.name)).toEqual([
      'Бронебой', 'Быстрый стрелок', 'Конденсатор', 'Крепость', 'Луч уменьшения', 'Мистический импульс', 'Ржавый ствол',
    ])
  })

  it('does not mutate the input', () => {
    const copy = [...alphabet]
    sortShopItems(alphabet, { sort: 'name', language: 'russian' })
    expect(alphabet).toEqual(copy)
  })

  it('falls back to the alphabet while statistics are not loaded', () => {
    const byName = sortShopItems(alphabet, { language: 'russian' })
    expect(sortShopItems(alphabet, { sort: 'usage', language: 'russian', statsById: null })).toEqual(byName)
  })

  it('sorts by usage and by winrate, putting low-sample items last', () => {
    const statsById = {
      1: { matches: 5000, wins: 2400 },
      2: { matches: 9000, wins: 4900 },
      3: { matches: 20000, wins: 10200 },
      4: { matches: 30, wins: 30 }, // 100 % винрейта, но всего 30 покупок
    }
    const options = { statsById, base: 100000, language: 'russian' }
    const usage = sortShopItems(ITEMS.slice(0, 4), { ...options, sort: 'usage' }).map((i) => i.id)
    expect(usage).toEqual([3, 2, 1, 4])
    const winrate = sortShopItems(ITEMS.slice(0, 4), { ...options, sort: 'winrate' }).map((i) => i.id)
    expect(winrate).toEqual([2, 3, 1, 4]) // 54,4 % → 51,0 % → 48,0 %; выборка 30 — в конце
  })
})

describe('buildShop', () => {
  const shop = buildShop(ITEMS, { language: 'russian' })

  it('lists tiers that have items, in price order', () => {
    expect(shop.tiers.map((tier) => tier.key)).toEqual(['t1', 't2', 't3', 't4', 't5'])
    expect(shop.tiers.map((tier) => tier.cost)).toEqual([800, 1600, 3200, 6400, 9999])
  })

  it('drops empty tiers', () => {
    expect(buildShop([item(1, 'А', 800, 'weapon')]).tiers.map((tier) => tier.key)).toEqual(['t1'])
    expect(buildShop([]).tiers).toEqual([])
    expect(buildShop([]).indev).toBeNull()
  })

  it('splits a tier into weapon / vitality / spirit columns', () => {
    const t1 = shop.tiers[0]
    expect(t1.columns.map((column) => column.slot)).toEqual(SHOP_SLOTS)
    expect(t1.columns.map((column) => column.items.map((i) => i.id))).toEqual([[1], [3], [4]])
    expect(t1.total).toBe(3)
  })

  it('collects items that are not on sale into a separate section', () => {
    expect(shop.indev.key).toBe('indev')
    expect(shop.indev.cost).toBeNull()
    expect(shop.indev.columns.flatMap((column) => column.items.map((i) => i.id)).sort()).toEqual([8, 9])
    expect(buildShop(ITEMS.slice(0, 7)).indev).toBeNull()
  })

  it('counts a section by what its columns show', () => {
    const odd = buildShop([item(1, 'А', 800, 'weapon'), item(2, 'Б', 800, null)])
    expect(odd.tiers[0].total).toBe(1) // предмет без слота не попал ни в одну колонку
  })

  it('keeps the chosen order inside columns', () => {
    const many = [item(1, 'Б', 800, 'weapon'), item(2, 'А', 800, 'weapon'), item(3, 'В', 800, 'weapon')]
    expect(buildShop(many, { language: 'russian' }).tiers[0].columns[0].items.map((i) => i.name)).toEqual(['А', 'Б', 'В'])
  })
})

describe('visibleRows', () => {
  it('shows a short column in full', () => {
    expect(visibleRows(FULL_ROWS)).toBe(FULL_ROWS)
    expect(visibleRows(3)).toBe(3)
  })

  it('shows the first rows of a long column until it is expanded', () => {
    expect(visibleRows(FULL_ROWS + 1)).toBe(PREVIEW_ROWS)
    expect(visibleRows(16)).toBe(PREVIEW_ROWS)
    expect(visibleRows(16, { expanded: true })).toBe(16)
  })

  it('shows everything while searching', () => {
    expect(visibleRows(16, { forceAll: true })).toBe(16)
  })
})

describe('firstShopItem', () => {
  it('is the first item of the first non-empty column', () => {
    expect(firstShopItem(buildShop(ITEMS, { language: 'russian' })).id).toBe(1)
  })

  it('falls back to the not-on-sale section and then to null', () => {
    expect(firstShopItem(buildShop([ITEMS[7]])).id).toBe(8)
    expect(firstShopItem(buildShop([]))).toBeNull()
  })
})

describe('groupByTier', () => {
  const groups = groupByTier(ITEMS, { language: 'russian' });

  it('lists the same tiers as the shop, items in one list in the chosen order', () => {
    expect(groups.map((group) => group.key)).toEqual(['t1', 't2', 't3', 't4', 't5', 'indev'])
    expect(groups[0].items.map((i) => i.name)).toEqual(['Крепость', 'Мистический импульс', 'Ржавый ствол'])
    expect(groups[0].cost).toBe(800)
  })

  it('puts items that are not on sale last, without a price', () => {
    const off = groups.at(-1)
    expect(off.cost).toBeNull()
    expect(off.items.map((i) => i.id).sort()).toEqual([8, 9])
  })

  it('skips empty tiers and has no «indev» group without such items', () => {
    expect(groupByTier([item(1, 'А', 3200, 'weapon')]).map((group) => group.key)).toEqual(['t3'])
    expect(groupByTier([])).toEqual([])
  })
})
