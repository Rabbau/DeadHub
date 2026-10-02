import { describe, expect, it } from 'vitest'
import rows from './fixtures/patches.json'
import { isFreshPatch, latestPatch, patchName, slimPatches } from '../src/services/patchService.js'

const NOW = Date.UTC(2026, 9, 2, 12, 0)
const PATCH = { at: Math.floor(Date.UTC(2026, 8, 29, 20, 25, 11) / 1000) }
const steam = (over) => ({ source: 'steam', title: 'A', pub_date: '2026-01-01T00:00:00Z', ...over })

describe('slimPatches on a real /v2/patches response', () => {
  const patches = slimPatches(rows)

  it('keeps only Steam news', () => {
    expect(patches).toHaveLength(rows.filter((r) => r.source === 'steam').length)
  })

  it('uses the Steam news link as id (guid is an object, not a string)', () => {
    expect(patches.every((p) => typeof p.id === 'string' && !p.id.includes('[object'))).toBe(true)
    expect(patches.every((p) => /^https:\/\/store\.steampowered\.com\/news\/app\/\d+\/view\/\d+$/.test(p.id))).toBe(true)
    expect(new Set(patches.map((p) => p.id)).size).toBe(patches.length)
  })

  it('sorts newest first and starts with the latest patch', () => {
    expect(patches.every((p, i) => i === 0 || patches[i - 1].at >= p.at)).toBe(true)
    expect(patches[0].title).toBe('City Never Sleeps')
  })

  it('trims titles and keeps the notes html', () => {
    expect(patches.every((p) => p.title === p.title.trim())).toBe(true)
    expect(patches.every((p) => typeof p.html === 'string' && p.html.length > 0)).toBe(true)
  })
})

describe('slimPatches robustness', () => {
  it('caps the list at 12', () => {
    const many = Array.from({ length: 30 }, (_, i) => steam({ title: `T${i}`, pub_date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`, guid: { text: `g${i}` } }))
    expect(slimPatches(many)).toHaveLength(12)
  })

  it('accepts a plain-string guid and falls back to link, then title', () => {
    expect(slimPatches([steam({ guid: 'abc' })])[0].id).toBe('abc')
    expect(slimPatches([steam({ link: 'https://x/y' })])[0].id).toBe('https://x/y')
    expect(slimPatches([steam({})])[0].id).toBe('A')
  })

  it('drops duplicates, forum rows, bad dates, empty titles and garbage', () => {
    expect(slimPatches([
      steam({ title: 'A', pub_date: '2026-01-02T00:00:00Z', guid: { text: 'same' } }),
      steam({ title: 'A again', guid: { text: 'same' } }),
    ]).map((p) => p.title)).toEqual(['A'])
    expect(slimPatches([{ source: 'forum', title: 'F', pub_date: '2026-01-01T00:00:00Z', guid: { text: 'f' } }])).toEqual([])
    expect(slimPatches([steam({ pub_date: 'not a date', guid: { text: 'x' } })])).toEqual([])
    expect(slimPatches([steam({ title: '  ', guid: { text: 'x' } })])).toEqual([])
    expect(slimPatches(null)).toEqual([])
    expect(slimPatches([null, undefined, {}])).toEqual([])
  })
})

describe('patch helpers', () => {
  it('patchName drops the date of minor updates', () => {
    expect(patchName('Minor Update - 09-16-2026')).toBe('Minor Update')
    expect(patchName(' Minor Update - 09-16-2026')).toBe('Minor Update')
    expect(patchName('Matchmaking Update – 7-30-2026')).toBe('Matchmaking Update')
    expect(patchName('City Never Sleeps')).toBe('City Never Sleeps')
    expect(patchName('')).toBe('')
  })

  it('latestPatch is the first of the list', () => {
    expect(latestPatch([{ at: 5 }, { at: 2 }])).toEqual({ at: 5 })
    expect(latestPatch([])).toBeNull()
  })

  it('isFreshPatch counts 21 days', () => {
    expect(isFreshPatch(PATCH, NOW)).toBe(true)
    expect(isFreshPatch(PATCH, NOW + 40 * 86400e3)).toBe(false)
    expect(isFreshPatch(null, NOW)).toBe(false)
    expect(isFreshPatch({ at: Date.now() / 1000 - 3600 })).toBe(true)
    expect(isFreshPatch({ at: 1 })).toBe(false)
  })
})
