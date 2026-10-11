import { describe, expect, it } from 'vitest'
import { heroStatus, isListedHero } from '../src/services/heroStatus.js'

describe('heroStatus', () => {
  it('treats a selectable hero as released', () => {
    expect(heroStatus({ player_selectable: true })).toBe('released')
    expect(heroStatus({ player_selectable: true }, 12000)).toBe('released')
  })

  it('treats a hero from the vote as upcoming until he has matches', () => {
    expect(heroStatus({ prerelease_only: true, player_selectable: false })).toBe('upcoming')
    expect(heroStatus({ prerelease_only: true, player_selectable: false }, 0)).toBe('upcoming')
  })

  it('lets real matches beat flags that have not switched yet', () => {
    expect(heroStatus({ prerelease_only: true, player_selectable: false }, 500)).toBe('released')
  })

  it('keeps a hero released although «in development» was never cleared (Busya, id 88, 9 Oct 2026)', () => {
    const baba = { player_selectable: true, prerelease_only: false, disabled: false, in_development: true }
    expect(heroStatus(baba, 252612)).toBe('released')
    expect(heroStatus(baba, 0)).toBe('released') // флаг «выбирается в игре» верен и без матчей в выборке
  })

  it('hides a placeholder that is in development and not selectable', () => {
    expect(heroStatus({ in_development: true, player_selectable: false })).toBe('hidden')
    expect(heroStatus({ in_development: true, prerelease_only: true, player_selectable: false })).toBe('hidden')
  })

  it('hides a disabled hero even when old matches are still in the window', () => {
    expect(heroStatus({ disabled: true, player_selectable: true }, 900)).toBe('hidden')
    expect(heroStatus({ disabled: true, in_development: true }, 0)).toBe('hidden')
  })

  it('hides a hero with no flags and no matches', () => {
    expect(heroStatus({})).toBe('hidden')
  })
})

describe('isListedHero', () => {
  it('lists playable and upcoming heroes', () => {
    expect(isListedHero({ player_selectable: true })).toBe(true)
    expect(isListedHero({ prerelease_only: true })).toBe(true)
  })

  it('skips disabled heroes', () => {
    expect(isListedHero({ disabled: true, player_selectable: true })).toBe(false)
  })

  it('skips a development placeholder but lists one that can already be picked', () => {
    expect(isListedHero({ in_development: true })).toBe(false)
    expect(isListedHero({ in_development: true, player_selectable: false })).toBe(false)
    expect(isListedHero({ in_development: true, player_selectable: true })).toBe(true)
  })
})
