import { describe, expect, it } from 'vitest'
import { canonicalUrl, formatTitle, languageCode, ogLocale } from '../src/services/siteMeta.js'
import { humanizeKey, splitAbilityProps } from '../src/services/abilityService.js'

describe('siteMeta', () => {
  it('formats titles', () => {
    expect(formatTitle('Interactive map')).toBe('Interactive map — Dead Hub')
    expect(formatTitle('  Map  ')).toBe('Map — Dead Hub')
    expect(formatTitle('')).toBe('Dead Hub — Deadlock hero stats & builds')
    expect(formatTitle(undefined)).toBe('Dead Hub — Deadlock hero stats & builds')
  })

  it('builds canonical URLs without query, hash and trailing slash', () => {
    expect(canonicalUrl('/')).toBe('https://dead-hub.vercel.app/')
    expect(canonicalUrl('')).toBe('https://dead-hub.vercel.app/')
    expect(canonicalUrl('/map')).toBe('https://dead-hub.vercel.app/map')
    expect(canonicalUrl('/map/')).toBe('https://dead-hub.vercel.app/map')
    expect(canonicalUrl('/map?preset=new')).toBe('https://dead-hub.vercel.app/map')
    expect(canonicalUrl('/hero/67#abilities')).toBe('https://dead-hub.vercel.app/hero/67')
    expect(canonicalUrl('map')).toBe('https://dead-hub.vercel.app/map')
  })

  it('maps site languages to <html lang> and og:locale', () => {
    expect([languageCode('russian'), languageCode('english'), languageCode('xx')]).toEqual(['ru', 'en', 'en'])
    expect([ogLocale('russian'), ogLocale('english')]).toEqual(['ru_RU', 'en_US'])
  })
})

describe('abilityService', () => {
  it('humanizes raw property keys', () => {
    expect(humanizeKey('DragonSearchRadius')).toBe('Dragon search radius')
    expect(humanizeKey('BonusTargetsBarrierPercentage')).toBe('Bonus targets barrier percentage')
    expect(humanizeKey('dragon_travel_range')).toBe('Dragon travel range')
    expect(humanizeKey('Damage')).toBe('Damage')
    expect(humanizeKey('AOEMagic')).toBe('Aoe magic')
    expect([humanizeKey(''), humanizeKey(null)]).toEqual(['', ''])
  })

  it('splits properties into main and extra, keeping the order', () => {
    const entries = [['Damage', { value: 1 }], ['StartupDelay', { value: 2 }], ['Radius', { value: 3 }], ['DragonSearchRadius', { value: 4 }]]
    const split = splitAbilityProps(entries, (k) => ['Damage', 'Radius'].includes(k))
    expect(split.main.map(([k]) => k)).toEqual(['Damage', 'Radius'])
    expect(split.extra.map(([k]) => k)).toEqual(['StartupDelay', 'DragonSearchRadius'])
    expect(splitAbilityProps([], () => true)).toEqual({ main: [], extra: [] })
    expect(splitAbilityProps(entries, () => false).main).toEqual([])
  })
})
