import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CROSSHAIR_DEFAULTS, CROSSHAIR_PRESETS, HARD, SLIDER, activePreset, codeFromSearch, hexToRgb, importInput, isCrosshairCode,
  normalizeSettings, presetSettings, rgbToHex, sameSettings, settingsParams,
} from '../src/services/crosshairService.js'

// Настоящий ответ API на «Crosshair Code Settings» для кода, который выдал «Crosshair Settings Code» (снят 2026-10-03)
const REAL_CODE = 'DL.AQHAdYkfKLUv_WANAO0GAFQLAQK4NAKGAgIOAQWik5vGAgIFZmFsc2UCDgEFxvj3.gYKAQXtn.qmBgIBMgILAQW0xNbzDAICMTbLpNHpBwIBNAIMAQXl3ZnSBAIDMC4184entgMCATH38dSgBQIBMNbB3b4MN5LCyfAJAgE0AgsBBNXlh3mduvr3DwoBBdzgptAP2bKFqQgMAQWcwf2GAQIDMjU1gYiAmQezmvLjBAoBBZmo0_cHCgEF29DgoQPsz4voBQIBMBAAr.RHsBwMDUqLGT4MLUTyOliNZy2IC0InFfwluJ7R4BkGhphk'
const REAL_SETTINGS = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'fixtures/crosshair-settings.json'), 'utf8'))

describe('CROSSHAIR_DEFAULTS', () => {
  it('has the same fields as the API answer', () => {
    expect(Object.keys(CROSSHAIR_DEFAULTS).sort()).toEqual(Object.keys(REAL_SETTINGS).sort())
  })

  it('equals what the API says about the default code', () => {
    expect({ ...CROSSHAIR_DEFAULTS }).toEqual(REAL_SETTINGS)
  })

  it('is frozen: nobody can change the defaults by accident', () => {
    expect(Object.isFrozen(CROSSHAIR_DEFAULTS)).toBe(true)
  })

  it('has a slider for every number except colors', () => {
    const numeric = Object.keys(CROSSHAIR_DEFAULTS).filter((key) => typeof CROSSHAIR_DEFAULTS[key] === 'number' && !/color/.test(key))
    expect(Object.keys(SLIDER).sort()).toEqual(numeric.sort())
    for (const [key, slider] of Object.entries(SLIDER)) {
      expect(slider.max, key).toBeGreaterThan(CROSSHAIR_DEFAULTS[key] ?? 0)
      expect(['pips', 'dot']).toContain(slider.group)
    }
  })
})

describe('normalizeSettings', () => {
  it('returns the defaults for nothing and for garbage', () => {
    for (const bad of [undefined, null, 5, 'x', []]) expect(normalizeSettings(bad), String(bad)).toEqual(CROSSHAIR_DEFAULTS)
  })

  it('keeps valid values and fills the rest with the defaults', () => {
    const result = normalizeSettings({ pip_width: 3, color_r: 10, dot_opacity: 0.25, themed: true })
    expect(result).toMatchObject({ pip_width: 3, color_r: 10, dot_opacity: 0.25, themed: true, pip_height: 16 })
  })

  it('clamps numbers to what the API accepts and rounds them', () => {
    const result = normalizeSettings({ pip_width: -4, pip_height: 9999, dot_size: 3.6, color_g: 300, outline_color_b: -1, pip_opacity: 1.7, dot_opacity: -0.2 })
    expect(result).toMatchObject({ pip_width: 0, pip_height: HARD.sizeMax, dot_size: 4, color_g: 255, outline_color_b: 0, pip_opacity: 1, dot_opacity: 0 })
  })

  it('reads numbers and booleans that came as strings (an address, an input)', () => {
    expect(normalizeSettings({ pip_width: '7', themed: 'true', pip_gap_static: 'false' })).toMatchObject({ pip_width: 7, themed: true, pip_gap_static: false })
  })

  it('falls back to the default for values that are not numbers', () => {
    expect(normalizeSettings({ pip_width: 'abc', pip_height: '', dot_size: null, color_r: NaN, pip_gap: true })).toMatchObject({ pip_width: 2, pip_height: 16, dot_size: 4, color_r: 255, pip_gap: 4 })
  })

  it('drops fields it does not know', () => {
    expect(normalizeSettings({ evil: 1, __proto__: { x: 1 } })).toEqual(CROSSHAIR_DEFAULTS)
  })

  it('rounds opacity to two decimals', () => {
    expect(normalizeSettings({ pip_opacity: 0.123456 }).pip_opacity).toBe(0.12)
  })
})

describe('settingsParams / sameSettings', () => {
  it('is empty for the default crosshair', () => {
    expect(settingsParams({})).toEqual({})
    expect(settingsParams(CROSSHAIR_DEFAULTS)).toEqual({})
  })

  it('lists only what differs, in alphabetical order, so equal crosshairs make equal requests', () => {
    const params = settingsParams({ pip_width: 3, color_r: 0, dot_size: 4 })
    expect(params).toEqual({ color_r: 0, pip_width: 3 })
    expect(Object.keys(params)).toEqual(['color_r', 'pip_width'])
    expect(JSON.stringify(settingsParams({ color_r: 0, pip_width: 3 }))).toBe(JSON.stringify(params))
  })

  it('carries booleans too', () => {
    expect(settingsParams({ themed: true })).toEqual({ themed: true })
  })

  it('compares after normalizing', () => {
    expect(sameSettings({}, CROSSHAIR_DEFAULTS)).toBe(true)
    expect(sameSettings({ pip_width: '2' }, {})).toBe(true)
    expect(sameSettings({ pip_width: 3 }, {})).toBe(false)
  })
})

describe('colors', () => {
  it('converts to hex and back', () => {
    expect(rgbToHex(255, 0, 128)).toBe('#ff0080')
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    expect(hexToRgb('#ff0080')).toEqual({ r: 255, g: 0, b: 128 })
    expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('clamps and rejects', () => {
    expect(rgbToHex(300, -5, 'x')).toBe('#ff0000')
    for (const bad of ['', 'red', '#12', '#12345', '#gggggg', null, undefined, '12ff00']) expect(hexToRgb(bad), String(bad)).toBeNull()
  })

  it('round-trips every default color', () => {
    const { r, g, b } = hexToRgb(rgbToHex(CROSSHAIR_DEFAULTS.color_r, CROSSHAIR_DEFAULTS.color_g, CROSSHAIR_DEFAULTS.color_b))
    expect([r, g, b]).toEqual([255, 255, 255])
  })
})

describe('crosshair codes', () => {
  it('recognizes a real code', () => {
    expect(isCrosshairCode(REAL_CODE)).toBe(true)
    expect(isCrosshairCode(`  ${REAL_CODE}\n`)).toBe(true)
  })

  it('rejects everything that is not a code', () => {
    for (const bad of ['', 'DL.', 'DL.short', 'XX.AQHAdYkfKLUv_WANAO0G', 'DL.<script>alert(1)</script>', `DL.${'a'.repeat(1300)}`, null, undefined, 42]) {
      expect(isCrosshairCode(bad), String(bad)).toBe(false)
    }
  })

  it('takes the code from the address only when it looks like one', () => {
    expect(codeFromSearch(`?code=${encodeURIComponent(REAL_CODE)}`)).toBe(REAL_CODE)
    expect(codeFromSearch(new URLSearchParams({ code: REAL_CODE }))).toBe(REAL_CODE)
    expect(codeFromSearch('?code=hello')).toBeNull()
    expect(codeFromSearch('')).toBeNull()
    expect(codeFromSearch('?code=DL.x&code=y')).toBeNull()
  })
})

describe('importInput', () => {
  it('takes a code', () => {
    expect(importInput(`  ${REAL_CODE} `)).toBe(REAL_CODE)
  })

  it('takes console commands (the API understands them too)', () => {
    expect(importInput('citadel_crosshair_dot_size 4; citadel_crosshair_color_r 245')).toBe('citadel_crosshair_dot_size 4; citadel_crosshair_color_r 245')
    expect(importInput('citadel_crosshair_dot_size 4\ncitadel_crosshair_pip_opacity 0.5')).not.toBeNull()
  })

  it('refuses empty, huge and arbitrary text', () => {
    for (const bad of ['', '   ', 'hello world', 'citadel_crosshair_dot_size', 'rm -rf /; citadel_crosshair_dot_size 4', 'x'.repeat(2500), null]) {
      expect(importInput(bad), String(bad).slice(0, 30)).toBeNull()
    }
  })
})

describe('presets', () => {
  it('start with the default crosshair and have unique ids', () => {
    expect(CROSSHAIR_PRESETS[0].id).toBe('default')
    expect(new Set(CROSSHAIR_PRESETS.map((p) => p.id)).size).toBe(CROSSHAIR_PRESETS.length)
    expect(sameSettings(presetSettings('default'), CROSSHAIR_DEFAULTS)).toBe(true)
  })

  it('are valid settings and differ from each other', () => {
    const seen = new Set()
    for (const preset of CROSSHAIR_PRESETS) {
      const settings = presetSettings(preset.id)
      expect(settings).toEqual(normalizeSettings(settings))
      const key = JSON.stringify(settings)
      expect(seen.has(key), preset.id).toBe(false)
      seen.add(key)
    }
  })

  it('know which preset the settings match', () => {
    expect(activePreset(presetSettings('neon'))).toBe('neon')
    expect(activePreset({})).toBe('default')
    expect(activePreset({ pip_width: 11 })).toBeNull()
  })

  it('fall back to the default for an unknown id', () => {
    expect(presetSettings('nope')).toEqual(CROSSHAIR_DEFAULTS)
  })
})
