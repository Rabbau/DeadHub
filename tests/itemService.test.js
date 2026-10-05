import { describe, expect, it } from 'vitest'
import {
  buildItemGraph,
  filterItems,
  getItemStats,
  groupItemsByPrice,
  isAvailableItem,
  isIndevItem,
  itemKind,
  matchesSearch,
  stripTags,
} from '../src/services/itemService.js'

const base = { id: 1, name: 'Extra Spirit', cost: 800, shop_image: 'https://x/y.png', shopable: true, disabled: false, item_slot_type: 'spirit' }

describe('isAvailableItem', () => {
  it('accepts a normal item and the 9999-cost Legendary', () => {
    expect(isAvailableItem(base)).toBe(true)
    expect(isAvailableItem({ ...base, cost: 9999, item_tier: 5 })).toBe(true)
  })

  it('rejects disabled, not shopable, free, placeholder and image-less items', () => {
    expect(isAvailableItem({ ...base, disabled: true })).toBe(false)
    expect(isAvailableItem({ ...base, shopable: false })).toBe(false)
    expect(isAvailableItem({ ...base, cost: null })).toBe(false)
    expect(isAvailableItem({ ...base, name: 'upgrade_clip_size_fixed' })).toBe(false)
    expect(isAvailableItem({ ...base, shop_image: null })).toBe(false)
  })

  it('treats absent flags as available (old cached data)', () => {
    expect(isAvailableItem({ id: 2, name: 'X', cost: 800, shop_image: 'u' })).toBe(true)
  })

  it('isIndevItem is the inverse', () => {
    expect(isIndevItem({ ...base, disabled: true })).toBe(true)
    expect(isIndevItem(base)).toBe(false)
  })
})

describe('grouping and filtering', () => {
  const labels = { t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5', indev: 'OFF' }
  const items = [
    base,
    { ...base, id: 2, name: 'Silencer', cost: 6400 },
    { ...base, id: 3, name: 'Shrink Ray', cost: 9999, item_tier: 5 },
    { ...base, id: 4, name: 'Old Thing', cost: 1600, disabled: true },
    { ...base, id: 5, name: 'upgrade_x', cost: 800 },
  ]
  const grouped = groupItemsByPrice(items, labels)

  it('groups by price tier', () => {
    expect(grouped.t1.items.map((i) => i.id)).toEqual([1])
    expect(grouped.t4.items.map((i) => i.id)).toEqual([2])
  })

  it('puts the 9999 Legendary into t5, not into the disabled group', () => {
    expect(grouped.t5.items.map((i) => i.id)).toEqual([3])
  })

  it('moves disabled items and placeholders to «indev»', () => {
    expect(grouped.indev.items.map((i) => i.id).sort()).toEqual([4, 5])
  })

  it('filters corruptible items and price tiers', () => {
    expect(filterItems([{ ...base, corruptible: true }, { ...base, id: 9 }], { corruptible: true }).map((i) => i.id)).toEqual([1])
    expect(filterItems(items, { priceTier: 't5' }).map((i) => i.id)).toEqual([3])
  })
})

describe('itemKind', () => {
  it('tells active items from passive ones', () => {
    expect(itemKind({ is_active_item: true })).toBe('active')
    expect(itemKind({ is_active_item: false })).toBe('passive')
    expect(itemKind({})).toBe('passive') // старый кеш без поля
  })
})

describe('stripTags', () => {
  it('removes markup, inline icons and decodes entities', () => {
    const html = 'Ваши пули <span class="highlight">лечат</span>&nbsp;вас<br>на 5 &amp; больше <svg width="1"><path d="M0"/></svg>урон'
    expect(stripTags(html)).toBe('Ваши пули лечат вас на 5 & больше урон')
  })

  it('returns an empty string for nothing', () => {
    expect(stripTags(null)).toBe('')
    expect(stripTags(undefined)).toBe('')
  })
})

describe('getItemStats', () => {
  const item = {
    tooltip_sections: [
      { section_attributes: [{ properties: ['Regen', 'Zero'], elevated_properties: ['Power'] }] },
      { section_attributes: [{ properties: ['Regen', 'Cooldown'], elevated_properties: [] }] },
    ],
    properties: {
      Regen: { value: '1', label: 'Восстановление вне боя', prefix: '{s:sign}' },
      Zero: { value: '0', label: 'Ничего' },
      Power: { value: '25', label: 'Урон от оружия', prefix: '{s:sign}', postfix: '%' },
      Cooldown: { value: '40', label: 'Перезарядка', postfix: ' с.' },
    },
  }

  it('lists non-zero properties once, in tooltip order, with the sign and the postfix', () => {
    expect(getItemStats(item)).toEqual([
      { label: 'Восстановление вне боя', text: '+1', elevated: false },
      { label: 'Урон от оружия', text: '+25%', elevated: true },
      { label: 'Перезарядка', text: '40 с.', elevated: false },
    ])
  })

  it('drops the «m» unit marker of distances: the postfix already carries the unit', () => {
    const stats = getItemStats({
      tooltip_sections: [{ section_attributes: [{ properties: ['Range', 'Speed', 'Bare'] }] }],
      properties: {
        Range: { value: '15m', label: 'Малая дальность', postfix: ' м' },
        Speed: { value: '1m', label: 'Скорость бега', prefix: '{s:sign}', postfix: ' м/c' },
        Bare: { value: '12m', label: 'Радиус' }, // без postfix метры остаются в значении
      },
    })
    expect(stats.map((stat) => stat.text)).toEqual(['15 м', '+1 м/c', '12m'])
  })

  it('is empty without tooltip sections', () => {
    expect(getItemStats({})).toEqual([])
    expect(getItemStats({ tooltip_sections: null })).toEqual([])
  })
})

describe('matchesSearch', () => {
  const healing = {
    id: 1,
    name: 'Ударная кража здоровья',
    description: { desc: 'Ваша следующая атака <span class="highlight">лечит вас</span>. Замедление не действует на героев.' },
    tooltip_sections: [{ section_attributes: [{ properties: ['Regen'] }] }],
    properties: { Regen: { value: '1', label: 'Восстановление вне боя' } },
  }

  it('finds by name, in any case', () => {
    expect(matchesSearch(healing, 'КРАЖА')).toBe(true)
    expect(matchesSearch(healing, 'кража зд')).toBe(true)
  })

  it('finds by effect words from the description and the stat labels', () => {
    expect(matchesSearch(healing, 'лечит')).toBe(true)
    expect(matchesSearch(healing, 'замедление')).toBe(true)
    expect(matchesSearch(healing, 'вне боя')).toBe(true)
  })

  it('ignores the ending of long words only', () => {
    expect(matchesSearch(healing, 'замедления')).toBe(true) // в тексте «Замедление»
    expect(matchesSearch(healing, 'здоровье')).toBe(true) // в названии «здоровья»
    expect(matchesSearch(healing, 'кражей')).toBe(true) // шесть букв: ищется «краж»
    expect(matchesSearch(healing, 'кражи')).toBe(false) // пять букв: ищется как есть, «кражи» в названии нет
  })

  it('requires every word of the query', () => {
    expect(matchesSearch(healing, 'лечит замедление')).toBe(true)
    expect(matchesSearch(healing, 'лечит ускорение')).toBe(false)
  })

  it('looks for words of one or two letters only in the name', () => {
    expect(matchesSearch(healing, 'вы')).toBe(false) // «вы» есть в описании, но не в названии
    expect(matchesSearch(healing, 'уд')).toBe(true)
  })

  it('does not tell «ё» from «е»', () => {
    expect(matchesSearch({ id: 2, name: 'Лёд' }, 'лед')).toBe(true)
    expect(matchesSearch({ id: 3, name: 'Лед' }, 'лёд')).toBe(true)
  })

  it('matches everything for an empty query', () => {
    expect(matchesSearch(healing, '   ')).toBe(true)
    expect(matchesSearch(healing, undefined)).toBe(true)
  })

  it('is used by filterItems together with the kind filter', () => {
    const active = { id: 2, name: 'Крепость', is_active_item: true }
    expect(filterItems([healing, active], { search: 'замедление' }).map((i) => i.id)).toEqual([1])
    expect(filterItems([healing, active], { kind: 'active' }).map((i) => i.id)).toEqual([2])
    expect(filterItems([healing, active], { kind: 'passive' }).map((i) => i.id)).toEqual([1])
    expect(filterItems([healing, active], { kind: 'all' })).toHaveLength(2)
  })
})

describe('buildItemGraph', () => {
  const make = (id, className, cost, extra = {}) => ({ ...base, id, name: className.replace('upgrade_', '').toUpperCase(), class_name: className, cost, ...extra })
  const bullets = make(1, 'upgrade_bullets', 800)
  const speed = make(2, 'upgrade_speed', 1600, { component_items: ['upgrade_bullets'] })
  const rapid = make(3, 'upgrade_rapid', 3200, { component_items: ['upgrade_bullets', 'upgrade_speed'] })
  const old = make(4, 'upgrade_old', 3200, { component_items: ['upgrade_bullets'], disabled: true })
  const graph = buildItemGraph([rapid, old, speed, bullets])

  it('finds what an item upgrades into, cheapest first', () => {
    expect(graph.upgradesInto(bullets).map((i) => i.id)).toEqual([2, 3])
    expect(graph.upgradesInto(speed).map((i) => i.id)).toEqual([3])
    expect(graph.upgradesInto(rapid)).toEqual([])
  })

  it('finds what an item is built from', () => {
    expect(graph.components(rapid).map((i) => i.id)).toEqual([1, 2])
    expect(graph.components(bullets)).toEqual([])
  })

  it('ignores items that are not on sale', () => {
    expect(graph.upgradesInto(bullets).map((i) => i.id)).not.toContain(4)
  })

  it('survives items without links (old cache) and unknown component names', () => {
    const lonely = { ...base, id: 5, name: 'Одинокий' }
    const broken = make(6, 'upgrade_broken', 800, { component_items: ['upgrade_missing'] })
    const g = buildItemGraph([lonely, broken])
    expect(g.upgradesInto(lonely)).toEqual([])
    expect(g.components(broken)).toEqual([])
  })
})
