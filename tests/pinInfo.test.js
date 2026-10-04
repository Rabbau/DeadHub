import { describe, expect, it } from 'vitest'
import { LAYERS } from '../src/services/mapService.js'
import { describePin, pinClass, pinColor, pinStyle } from '../src/components/map/pinInfo.js'

const layer = (id) => LAYERS.find((l) => l.id === id)
// Перевод для проверки: ключ и параметры, чтобы видеть, что именно запросили
const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key)

describe('pinColor', () => {
  it('colours buildings and turrets by team', () => {
    expect(pinColor(layer('objectives'), { team: 0 })).toBe('var(--amber)')
    expect(pinColor(layer('objectives'), { team: 1 })).toBe('var(--sky)')
    expect(pinColor(layer('sentries'), { team: 1 })).toBe('var(--sky)')
  })

  it('makes the secret shop violet and leaves the other shops white', () => {
    expect(pinColor(layer('shops'), { kind: 'secret' })).toBe('var(--violet)')
    expect(pinColor(layer('shops'), { kind: 'lane' })).toBe(layer('shops').color)
  })

  it('takes the colour of the layer for everything else', () => {
    expect(pinColor(layer('camp_strong'), {})).toBe(layer('camp_strong').color)
    expect(pinColor(layer('objectives'), {})).toBe(layer('objectives').color) // команды нет — цвет слоя
  })
})

describe('pinStyle', () => {
  it('carries the ring colour and the icon', () => {
    const style = pinStyle(layer('camp_vault'), {})
    expect(style['--c']).toBe(layer('camp_vault').color)
    expect(style['--icon']).toMatch(/^url\("https:\/\/assets-bucket\.deadlock-api\.com\//)
    expect(style['--fit']).toMatch(/%$/)
  })

  it('picks the icon of the building by its type', () => {
    expect(pinStyle(layer('objectives'), { type: 'guardian' })['--icon']).not.toBe(pinStyle(layer('objectives'), { type: 'walker' })['--icon'])
  })
})

describe('pinClass', () => {
  it('names the layer, the building type and the kind of shop or urn', () => {
    expect(pinClass(layer('objectives'), { type: 'walker' }, false)).toBe('map-pin map-pin--objectives map-pin--walker')
    expect(pinClass(layer('shops'), { kind: 'secret' }, false)).toBe('map-pin map-pin--shops map-pin--secret')
    expect(pinClass(layer('urns'), { kind: 'pad' }, false)).toBe('map-pin map-pin--urns map-pin--pad')
    expect(pinClass(layer('camp_weak'), {}, false)).toBe('map-pin map-pin--camp_weak')
  })

  it('marks the selected marker', () => {
    expect(pinClass(layer('camp_weak'), {}, true)).toContain('is-selected')
  })
})

describe('describePin', () => {
  const timers = { weak: { first: 120, every: 85 }, vault: { first: 480, every: 300 }, crates: { first: 180, every: 180 } }

  it('describes a building: type, lane by colour and team', () => {
    const info = describePin('objectives', { type: 'walker', lane: 'left', team: 0 }, t, { left: '#F1CC30' })
    expect(info.title).toBe('map.objective.walker')
    expect(info.meta).toEqual(['map.lane.yellow', 'map.side.0'])
  })

  it('falls back to the position of the lane when its colour is unknown', () => {
    expect(describePin('objectives', { type: 'guardian', lane: 'right', team: 1 }, t, {}).meta[0]).toBe('map.lane.right')
  })

  it('adds the first spawn and the interval of a camp', () => {
    const info = describePin('camp_weak', {}, t, {}, timers)
    expect(info.meta).toEqual(['map.spawn.first {"time":"2:00"}', 'map.spawn.every {"time":"1:25"}'])
  })

  it('gives landmarks the timer of vaults', () => {
    const info = describePin('landmarks', { landmark: 'bellTower' }, t, {}, timers)
    expect(info.title).toBe('map.landmark.bellTower.name')
    expect(info.meta).toContain('map.spawn.first {"time":"8:00"}')
  })

  it('gives crates, tough crates and statues the timer of crates', () => {
    ;['crates', 'tough_crates', 'statues'].forEach((id) => {
      expect(describePin(id, {}, t, {}, timers).meta).toContain('map.spawn.first {"time":"3:00"}')
    })
  })

  it('says nothing about time for what has no timer, or while the timers are unknown', () => {
    expect(describePin('urns', { kind: 'spawn' }, t, {}, timers).meta).toEqual([])
    expect(describePin('camp_weak', {}, t, {}, null).meta).toEqual([])
    expect(describePin('camp_weak', {}, t, {}, {}).meta).toEqual([])
    expect(describePin('camp_weak', {}, t, {}, { weak: { first: null, every: null } }).meta).toEqual([])
  })

  it('shows the hint of layers that have one, and flags the new ones', () => {
    const info = describePin('vents', {}, t)
    expect(info.hint).toBe('map.layers.vents.hint')
    expect(info.isNew).toBe(true)
    expect(describePin('crates', {}, t).hint).toBeNull()
  })

  it('names shop kinds and urn kinds, leaving unknown kinds under the layer name', () => {
    expect(describePin('shops', { kind: 'secret', team: 0 }, t).title).toBe('map.shopKind.secret')
    expect(describePin('shops', { kind: 'weird' }, t).title).toBe('map.layers.shops.name')
    expect(describePin('urns', { kind: 'pad' }, t).title).toBe('map.urnKind.pad')
  })
})
