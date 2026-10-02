import { describe, expect, it } from 'vitest'
import { filterItems, groupItemsByPrice, isAvailableItem, isIndevItem } from '../src/services/itemService.js'

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
