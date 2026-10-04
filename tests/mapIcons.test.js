import { describe, expect, it } from 'vitest'
import { LAYERS } from '../src/services/mapService.js'
import { allIcons, iconOf, iconStyle } from '../src/services/mapIcons.js'

const BUCKET = 'https://assets-bucket.deadlock-api.com/assets-api-res/icons/'
const withIcon = LAYERS.filter((layer) => layer.kind === 'pin' || layer.kind === 'dot')

describe('iconOf', () => {
  it('has an icon for every marker layer', () => {
    const missing = withIcon.filter((layer) => !iconOf(layer.id, { type: 'walker', kind: 'spawn' })).map((layer) => layer.id)
    expect(missing).toEqual([])
  })

  it('has no icon for lines, images and the heat map', () => {
    LAYERS.filter((layer) => ['line', 'image', 'heat'].includes(layer.kind)).forEach((layer) => {
      expect(iconOf(layer.id, {})).toBeNull()
    })
  })

  it('picks the objective icon by the type of the building', () => {
    const guardian = iconOf('objectives', { type: 'guardian' })
    const walker = iconOf('objectives', { type: 'walker' })
    const patron = iconOf('objectives', { type: 'patron' })
    expect(new Set([guardian.src, walker.src, patron.src]).size).toBe(3)
    expect(iconOf('objectives', { type: 'unknown' })).toBeNull()
  })

  it('tells an urn spawn from a drop-off pad, and falls back to the spawn icon', () => {
    expect(iconOf('urns', { kind: 'spawn' }).src).not.toBe(iconOf('urns', { kind: 'pad' }).src)
    expect(iconOf('urns', {}).src).toBe(iconOf('urns', { kind: 'spawn' }).src)
  })

  it('gives every camp tier its own game icon', () => {
    const tiers = ['camp_weak', 'camp_medium', 'camp_strong', 'camp_vault'].map((id) => iconOf(id).src)
    expect(new Set(tiers).size).toBe(4)
    tiers.forEach((src) => expect(src).toMatch(/neutral_(small|medium|large|vault)_psd\.png$/))
  })

  it('knows a layer without being given an item (dots on the canvas)', () => {
    expect(iconOf('crates')).toEqual(iconOf('crates', {}))
  })
})

describe('icons', () => {
  const icons = allIcons()

  it('are either the game icons of the image storage or inlined SVG, nothing else (the CSP lets only these through)', () => {
    icons.forEach((icon) => {
      expect(icon.src.startsWith(BUCKET) || icon.src.startsWith('data:image/svg+xml,'), icon.src.slice(0, 80)).toBe(true)
    })
  })

  it('point at pictures, not at pages', () => {
    icons.filter((icon) => icon.src.startsWith(BUCKET)).forEach((icon) => expect(icon.src).toMatch(/\.(png|svg|webp)$/))
  })

  it('give inlined SVG an explicit size: a canvas draws SVG without one at a default size', () => {
    icons.filter((icon) => icon.src.startsWith('data:')).forEach((icon) => {
      const svg = decodeURIComponent(icon.src.slice('data:image/svg+xml,'.length))
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(svg).toMatch(/width="24" height="24"/)
      expect(svg).toContain('viewBox="0 0 24 24"')
    })
  })

  it('fit into the round marker at a sensible size', () => {
    icons.forEach((icon) => {
      expect(icon.fit).toBeGreaterThanOrEqual(60)
      expect(icon.fit).toBeLessThanOrEqual(180)
    })
  })

  it('are listed once each', () => {
    expect(new Set(icons.map((icon) => icon.src)).size).toBe(icons.length)
    expect(icons.length).toBeGreaterThan(15)
  })
})

describe('iconStyle', () => {
  it('turns an icon into the CSS variables of a marker', () => {
    const style = iconStyle({ src: 'https://example.com/a.png', fit: 120 })
    expect(style).toEqual({ '--icon': 'url("https://example.com/a.png")', '--fit': '120%' })
  })

  it('has nothing to say about a layer without an icon', () => {
    expect(iconStyle(null)).toEqual({})
  })
})
