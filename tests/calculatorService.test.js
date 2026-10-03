import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CALC, calcSearch, clampLevel, computeBuild, extractModifiers, filterCalcItems, parseCalcParams, pickItems, slimCalcItem, slimCalcItems,
  toHeroBase, toggleItem,
} from '../src/services/calculatorService.js'

const fixture = (name) => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'fixtures', name), 'utf8'))
const RAW_ITEMS = fixture('calc-items.json')
const HEROES = fixture('calc-heroes.json') // [{ hero, weapon }] — настоящие данные API, урезанные до нужных полей
const ITEMS = slimCalcItems(RAW_ITEMS)
const item = (name) => ITEMS.find((i) => i.name === name)
const base = (name) => {
  const entry = HEROES.find((h) => h.hero.name === name)
  return toHeroBase(entry.hero, entry.weapon)
}
const mod = (it, stat) => it.mods.find((m) => m.stat === stat)

describe('extractModifiers', () => {
  it('reads values, and marks a bonus as permanent only if it is innate and not conditional', () => {
    const { mods } = extractModifiers({
      BonusHealth: { value: '125', tooltip_section: 'innate' },
      BaseAttackDamagePercent: { value: '35', tooltip_section: 'passive', usage_flags: ['ConditionallyApplied'] },
      BonusFireRate: { value: '10', tooltip_section: 'innate', usage_flags: ['ConditionallyApplied'] },
      BonusClipSizePercent: { value: '30' },
    })
    expect(mods).toEqual([
      { stat: 'health', value: 125, always: true },
      { stat: 'weaponDamage', value: 35, always: false },
      { stat: 'fireRate', value: 10, always: false },
      { stat: 'clipPercent', value: 30, always: false },
    ])
  })

  it('skips zero, missing and non-numeric values', () => {
    expect(extractModifiers({ BonusHealth: { value: '0' }, BonusFireRate: { value: 'abc' }, BonusClipSize: {} }).mods).toEqual([])
    expect(extractModifiers(undefined)).toEqual({ mods: [], uncounted: [] })
  })

  it('lists effects it cannot count instead of dropping them silently', () => {
    const { mods, uncounted } = extractModifiers({ BonusBaseHealth: { value: '25', tooltip_section: 'innate' }, MaxHealthLossPercent: { value: '-13' } })
    expect(mods).toEqual([])
    expect(uncounted).toEqual([{ stat: 'baseHealthPercent', value: 25 }, { stat: 'maxHealthPercent', value: -13 }])
  })
})

describe('slimCalcItem on real items', () => {
  it('Extended Magazine: weapon damage and ammo, both permanent', () => {
    const it = item('Extended Magazine')
    expect(mod(it, 'weaponDamage')).toEqual({ stat: 'weaponDamage', value: 8, always: true })
    expect(mod(it, 'clipPercent')).toEqual({ stat: 'clipPercent', value: 30, always: true })
    expect(it).toMatchObject({ cost: 800, slot: 'weapon', tier: 1 })
    expect(it.image).toMatch(/^https:\/\/assets-bucket\.deadlock-api\.com\/.+\.webp$/)
  })

  it('Hollow Point: health is permanent, the weapon damage works only above 65% health', () => {
    const it = item('Hollow Point')
    expect(mod(it, 'health')).toMatchObject({ value: 125, always: true })
    expect(mod(it, 'weaponDamage')).toMatchObject({ value: 35, always: false })
  })

  it('Frenzy: health and fire rate are permanent; the below-half-health bonus is not a counted effect', () => {
    const it = item('Frenzy')
    expect(it.mods).toEqual([
      { stat: 'health', value: 160, always: true },
      { stat: 'fireRate', value: 15, always: true },
    ])
  })

  it('Heroic Aura and Kinetic Dash: active and passive bonuses are conditional', () => {
    expect(mod(item('Heroic Aura'), 'fireRate')).toMatchObject({ value: 26, always: false })
    expect(mod(item('Kinetic Dash'), 'clipFlat')).toMatchObject({ value: 6, always: false })
    expect(mod(item('Kinetic Dash'), 'fireRate')).toMatchObject({ value: 25, always: false })
  })

  it('Unstable Concoction: a one-off 3000 health is conditional, not a build bonus', () => {
    const it = item('Unstable Concoction')
    expect(mod(it, 'health')).toMatchObject({ value: 3000, always: false })
  })

  it('Colossus and Glass Cannon: percent health effects are reported as not counted', () => {
    expect(item('Colossus').uncounted).toEqual([{ stat: 'baseHealthPercent', value: 25 }])
    expect(item('Glass Cannon').uncounted).toEqual([{ stat: 'maxHealthPercent', value: -13 }])
    expect(mod(item('Glass Cannon'), 'weaponDamage')).toMatchObject({ value: 80, always: true })
  })

  it('Healing Booster: flat regeneration', () => {
    expect(mod(item('Healing Booster'), 'regen')).toMatchObject({ value: 3, always: true })
  })

  it('has no modifiers for an item that changes none of the counted stats', () => {
    expect(item('Mystic Burst').mods).toEqual([])
  })
})

describe('slimCalcItems', () => {
  it('keeps only upgrades that are on sale', () => {
    const unavailable = RAW_ITEMS.filter((raw) => raw.disabled === true || raw.shopable === false || raw.type !== 'upgrade')
    expect(unavailable.length).toBeGreaterThanOrEqual(2)
    for (const raw of unavailable) expect(slimCalcItem(raw), raw.name).toBeNull()
    expect(ITEMS).toHaveLength(RAW_ITEMS.length - unavailable.length)
  })

  it('refuses service blanks, items without a price or a picture, and garbage', () => {
    const ok = RAW_ITEMS.find((raw) => raw.name === 'Extended Magazine')
    expect(slimCalcItem({ ...ok, name: 'upgrade_test' })).toBeNull()
    expect(slimCalcItem({ ...ok, cost: null })).toBeNull()
    expect(slimCalcItem({ ...ok, shop_image: '', shop_image_webp: '  ' })).toBeNull()
    expect(slimCalcItem(null)).toBeNull()
    expect(slimCalcItem({})).toBeNull()
  })

  it('sorts by price, then by name', () => {
    for (let i = 1; i < ITEMS.length; i++) {
      const a = ITEMS[i - 1]
      const b = ITEMS[i]
      expect(a.cost < b.cost || (a.cost === b.cost && a.name.localeCompare(b.name) <= 0), `${a.name} → ${b.name}`).toBe(true)
    }
  })

  it('takes a plain list or a wrapped one', () => {
    expect(slimCalcItems({ data: RAW_ITEMS })).toHaveLength(ITEMS.length)
    expect(slimCalcItems(undefined)).toEqual([])
  })
})

describe('toHeroBase on real heroes', () => {
  it('reads health, scaling and the weapon', () => {
    expect(base('Haze')).toMatchObject({ name: 'Haze', maxHealth: 730, healthRegen: 2, healthPerLevel: 33 })
    expect(base('Haze').weapon).toMatchObject({ bulletDamage: 5.26, bullets: 1, damagePerLevel: 0.143, shotsPerSecond: expect.closeTo(9.5238, 3), clipSize: 25, reloadTime: 2.35 })
    expect(base('Abrams').weapon).toMatchObject({ bullets: 9, bulletDamage: 3.6 })
  })

  it('works without a weapon', () => {
    const b = toHeroBase(HEROES[0].hero, null)
    expect(b.weapon).toBeNull()
    expect(b.maxHealth).toBe(730)
    expect(computeBuild(b, 10, []).base.weapon).toBeNull()
  })

  it('does not break on an empty hero', () => {
    expect(toHeroBase({}, null)).toMatchObject({ maxHealth: 0, healthPerLevel: 0, weapon: null })
    expect(toHeroBase(undefined, undefined).weapon).toBeNull()
  })

  it('takes the delay after a reload from the API numbers: 0.25 s for ordinary weapons', () => {
    for (const name of ['Haze', 'Abrams', 'Drifter']) expect(base(name).weapon.reloadDelay, name).toBeCloseTo(0.25, 2)
    // у оружия с очередями это малая поправка на округление, а не задержка
    expect(Math.abs(base('Seven').weapon.reloadDelay)).toBeLessThan(0.05)
  })

  it('falls back to 0.25 s when the API gives nothing to derive it from or something absurd', () => {
    const w = HEROES[0].weapon
    const without = { ...w, weapon_info: { ...w.weapon_info, shots_per_second_with_reload: undefined } }
    expect(toHeroBase(HEROES[0].hero, without).weapon.reloadDelay).toBe(CALC.RELOAD_DELAY_S)
    const absurd = { ...w, weapon_info: { ...w.weapon_info, shots_per_second_with_reload: 0.01 } }
    expect(toHeroBase(HEROES[0].hero, absurd).weapon.reloadDelay).toBe(CALC.RELOAD_DELAY_S)
  })
})

describe('computeBuild: a hero without items agrees with the numbers of the API itself', () => {
  for (const { hero, weapon } of HEROES) {
    it(`${hero.name}: damage per shot, DPS and DPS with a reload at level 1`, () => {
      const info = weapon.weapon_info
      const { base: stats } = computeBuild(toHeroBase(hero, weapon), 1, [])
      expect(stats.weapon.damagePerShot).toBeCloseTo(info.damage_per_shot, 5)
      expect(stats.weapon.dps).toBeCloseTo(info.damage_per_second, 5)
      expect(stats.weapon.dpsSustained).toBeCloseTo(info.damage_per_second_with_reload, 5)
      expect(stats.weapon.clip).toBe(info.clip_size)
      expect(stats.health).toBe(hero.starting_stats.max_health.value)
    })
  }

  it('burst DPS equals the API number for a hero of every weapon type, with the delay not derived from anything', () => {
    // независимая проверка: без вывода задержки (она подгоняется под API) совпадает «чистый» DPS
    for (const { hero, weapon } of HEROES) {
      const info = weapon.weapon_info
      expect(info.bullet_damage * info.bullets * info.shots_per_second, hero.name).toBeCloseTo(info.damage_per_second, 5)
    }
  })
})

describe('computeBuild: level scaling', () => {
  const haze = base('Haze')

  it('adds the per-level growth once per level after the first', () => {
    const r = computeBuild(haze, 21, [])
    expect(r.boons).toBe(20)
    expect(r.base.health).toBeCloseTo(730 + 33 * 20)
    expect(r.base.weapon.damagePerBullet).toBeCloseTo(5.26 + 0.143 * 20)
  })

  it('does not scale at level 1', () => {
    expect(computeBuild(haze, 1, []).base.health).toBe(730)
  })

  it('keeps the level in the game’s range and reads a string', () => {
    expect(computeBuild(haze, 0, []).level).toBe(1)
    expect(computeBuild(haze, 999, []).level).toBe(CALC.MAX_LEVEL)
    expect(computeBuild(haze, '12', []).level).toBe(12)
    expect(computeBuild(haze, 'abc', []).level).toBe(1)
    expect(computeBuild(haze, 12.6, []).level).toBe(13)
  })

  it('multiplies the damage per shot by the pellets of a shotgun', () => {
    const abrams = base('Abrams')
    const r = computeBuild(abrams, 11, [])
    expect(r.base.weapon.damagePerShot).toBeCloseTo((3.6 + 0.1 * 10) * 9)
  })
})

describe('computeBuild: items', () => {
  const haze = base('Haze')
  const build = [item('Extended Magazine'), item('Frenzy'), item('Extra Health'), item('Hollow Point'), item('Heroic Aura')]
  const result = computeBuild(haze, 21, build)

  it('adds permanent bonuses and keeps the conditional ones apart', () => {
    expect(result.bonuses.permanent).toMatchObject({ health: 125 + 160 + 210, weaponDamage: 8, fireRate: 15, clipPercent: 30 })
    expect(result.bonuses.conditional).toMatchObject({ weaponDamage: 35, fireRate: 26 })
  })

  it('health: base + levels + flat bonuses', () => {
    expect(result.permanent.health).toBeCloseTo(730 + 33 * 20 + 495)
    expect(result.peak.health).toBe(result.permanent.health) // условных бонусов к здоровью у этого набора нет
  })

  it('damage and fire rate follow the permanent percentages', () => {
    const w = result.permanent.weapon
    expect(w.damagePerBullet).toBeCloseTo((5.26 + 0.143 * 20) * 1.08)
    expect(w.shotsPerSecond).toBeCloseTo(haze.weapon.shotsPerSecond * 1.15)
    expect(w.clip).toBe(Math.round(25 * 1.3))
    expect(w.dps).toBeCloseTo(w.damagePerShot * w.shotsPerSecond)
  })

  it('"peak" adds the conditional bonuses: higher DPS, never lower', () => {
    const peak = result.peak.weapon
    expect(peak.damagePerBullet).toBeCloseTo((5.26 + 0.143 * 20) * (1 + 0.43))
    expect(peak.shotsPerSecond).toBeCloseTo(haze.weapon.shotsPerSecond * 1.41)
    expect(peak.dps).toBeGreaterThan(result.permanent.weapon.dps)
    expect(result.permanent.weapon.dps).toBeGreaterThan(result.base.weapon.dps)
  })

  it('DPS with a reload is always below the burst DPS, and rises with a bigger magazine', () => {
    for (const stats of [result.base, result.permanent, result.peak]) expect(stats.weapon.dpsSustained).toBeLessThan(stats.weapon.dps)
    const bigMag = computeBuild(haze, 21, [item('Titanic Magazine')])
    const noMag = computeBuild(haze, 21, [])
    expect(bigMag.permanent.weapon.clip).toBe(50)
    expect(bigMag.permanent.weapon.dpsSustained / bigMag.permanent.weapon.dps).toBeGreaterThan(noMag.base.weapon.dpsSustained / noMag.base.weapon.dps)
  })

  it('adds regeneration and a flat magazine bonus', () => {
    expect(computeBuild(haze, 1, [item('Healing Booster')]).permanent.regen).toBe(2 + 3)
    expect(computeBuild(haze, 1, [item('Kinetic Dash')]).peak.weapon.clip).toBe(25 + 6)
    expect(computeBuild(haze, 1, [item('Kinetic Dash')]).permanent.weapon.clip).toBe(25)
  })

  it('totals the price', () => {
    expect(result.cost).toBe(build.reduce((sum, it) => sum + it.cost, 0))
    expect(computeBuild(haze, 1, []).cost).toBe(0)
  })

  it('reports effects it cannot count', () => {
    const r = computeBuild(haze, 10, [item('Colossus'), item('Glass Cannon'), item('Extra Health')])
    expect(r.uncounted).toEqual([
      { itemId: item('Colossus').id, name: 'Colossus', stat: 'baseHealthPercent', value: 25 },
      { itemId: item('Glass Cannon').id, name: 'Glass Cannon', stat: 'maxHealthPercent', value: -13 },
    ])
  })

  it('without items every scenario equals the base', () => {
    const r = computeBuild(haze, 15, [])
    expect(r.permanent).toEqual(r.base)
    expect(r.peak).toEqual(r.base)
  })
})

describe('items list helpers', () => {
  it('filters by slot and by name', () => {
    expect(filterCalcItems(ITEMS, { slot: 'weapon' }).every((it) => it.slot === 'weapon')).toBe(true)
    expect(filterCalcItems(ITEMS, { query: ' magazine ' }).map((it) => it.name).sort()).toEqual(['Extended Magazine', 'Titanic Magazine'])
    expect(filterCalcItems(ITEMS, { slot: 'spirit', query: 'extended' })).toEqual([])
    expect(filterCalcItems(ITEMS)).toHaveLength(ITEMS.length)
  })

  it('toggles an item and stops at the inventory size', () => {
    expect(toggleItem([1], 2)).toEqual([1, 2])
    expect(toggleItem([1, 2], 1)).toEqual([2])
    const full = Array.from({ length: CALC.MAX_ITEMS }, (_, i) => i + 1)
    expect(toggleItem(full, 99)).toBe(full)
    expect(toggleItem(full, 1)).toHaveLength(CALC.MAX_ITEMS - 1)
  })

  it('picks items by id in the given order and skips what the game no longer has', () => {
    const [a, b] = ITEMS
    expect(pickItems(ITEMS, [b.id, 123456789, a.id])).toEqual([b, a])
    expect(pickItems(ITEMS, [])).toEqual([])
  })
})

describe('clampLevel', () => {
  it('is a whole number between the first and the last level', () => {
    expect([-5, 0, 1, 20, 36, 37, 1000].map(clampLevel)).toEqual([1, 1, 1, 20, 36, 36, 36])
    expect(clampLevel(null)).toBe(1)
    expect(clampLevel(undefined)).toBe(1)
  })
})

describe('address state', () => {
  it('reads a build from the address', () => {
    expect(parseCalcParams('?hero=13&lvl=24&items=111,222,333')).toEqual({ heroId: 13, level: 24, itemIds: [111, 222, 333] })
  })

  it('has defaults for an empty address', () => {
    expect(parseCalcParams('')).toEqual({ heroId: null, level: CALC.DEFAULT_LEVEL, itemIds: [] })
  })

  it('throws away anything that does not look right', () => {
    const state = parseCalcParams('?hero=abc&lvl=-3&items=1,x,2,,3.5,2,99999999999')
    expect(state).toEqual({ heroId: null, level: CALC.DEFAULT_LEVEL, itemIds: [1, 2] })
    expect(parseCalcParams('?hero=0').heroId).toBeNull()
    expect(parseCalcParams('?lvl=999').level).toBe(CALC.MAX_LEVEL)
  })

  it('takes no more items than the inventory holds', () => {
    const many = Array.from({ length: 30 }, (_, i) => i + 1).join(',')
    expect(parseCalcParams(`?items=${many}`).itemIds).toHaveLength(CALC.MAX_ITEMS)
  })

  it('writes the state back and reads it again', () => {
    const state = { heroId: 13, level: 24, itemIds: [111, 222] }
    const search = calcSearch(state)
    expect(search).toBe('hero=13&lvl=24&items=111,222')
    expect(parseCalcParams(search)).toEqual(state)
  })

  it('writes nothing until a hero is chosen, and no empty item list', () => {
    expect(calcSearch({ heroId: null, level: 20, itemIds: [] })).toBe('')
    expect(calcSearch({ heroId: 13, level: 20, itemIds: [] })).toBe('hero=13&lvl=20')
  })
})
