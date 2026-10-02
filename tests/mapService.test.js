import { describe, expect, it } from 'vitest'
import raw from './fixtures/map.json'
import * as ms from '../src/services/mapService.js'

const near = (got, want, eps = 1e-6) => expect(Math.abs(got - want)).toBeLessThanOrEqual(eps)
const search = (s) => new URLSearchParams(s)

describe('slimMap on a real /v1/map response', () => {
  const map = ms.slimMap(raw)
  const L = map.layers

  it('reads the radius and the three base images', () => {
    expect(map.radius).toBe(10752)
    expect(map.images.base).toMatch(/minimap_midtown_mid\.png$/)
    expect(map.images.tunnelsMid).toMatch(/mid_tunnels/)
    expect(map.images.tunnelsRat).toMatch(/rat_tunnels/)
  })

  it('fills every point layer', () => {
    const pointLayers = ms.LAYERS.filter((l) => l.kind !== 'line' && l.kind !== 'image' && l.kind !== 'heat')
    expect(pointLayers.every((l) => Array.isArray(L[l.id]))).toBe(true)
  })

  it('has the entities of the City Never Sleeps map', () => {
    const count = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.length]))
    expect(count).toMatchObject({
      crates: 423, tough_crates: 73, statues: 166, bells: 3, snacks: 36, vents: 47, veils: 30,
      ropes: 17, bounce_pads: 17, teleporters: 4, urns: 8, rifts: 2, sentries: 8, shops: 9, objectives: 14,
    })
    expect([L.camp_weak.length, L.camp_medium.length, L.camp_strong.length, L.camp_vault.length, L.landmarks.length]).toEqual([4, 25, 11, 8, 3])
  })

  it('splits urns and shops by kind', () => {
    expect([L.urns.filter((u) => u.kind === 'spawn').length, L.urns.filter((u) => u.kind === 'pad').length]).toEqual([6, 2])
    expect(L.shops.map((s) => s.kind).sort()).toEqual(['base', 'lane', 'lane', 'lane', 'lane', 'lane', 'lane', 'secret', 'secret'])
  })

  it('keeps every point inside the map', () => {
    const points = Object.values(L).flat()
    expect(points.every((p) => p.x >= -0.001 && p.x <= 1.001 && p.y >= -0.001 && p.y <= 1.001)).toBe(true)
    expect([...L.bounce_pads, ...L.teleporters].every((p) => p.tx > 0 && p.tx < 1 && p.ty > 0 && p.ty < 1)).toBe(true)
  })

  it('places the objectives symmetrically around the centre', () => {
    const mean = (k) => L.objectives.reduce((s, o) => s + o[k], 0) / L.objectives.length
    near(mean('x'), 0.5, 1e-3)
    near(mean('y'), 0.5, 1e-3)
    const byId = Object.fromEntries(L.objectives.map((o) => [o.id, o]))
    near(byId.team0_titan.x + byId.team1_titan.x, 1, 5e-3)
    near(byId.team0_titan.y + byId.team1_titan.y, 1, 5e-3)
    near(byId.team0_titan.x, 0.44, 0.01)
    expect(byId.team0_tier1_1.x < byId.team0_tier1_3.x && byId.team0_tier1_3.x < byId.team0_tier1_4.x).toBe(true)
  })

  it('knows types, lanes and guardians', () => {
    expect([...new Set(L.objectives.map((o) => o.type))].sort()).toEqual(['guardian', 'patron', 'walker'])
    expect([...new Set(L.objectives.map((o) => o.lane))].filter(Boolean).sort()).toEqual(['center', 'left', 'right'])
    expect(L.objectives.filter((o) => !o.lane).every((o) => o.type === 'patron')).toBe(true)
    expect([0, 1].map((t) => L.objectives.filter((o) => o.team === t && o.type === 'guardian').length)).toEqual([3, 3])
  })

  it('turns zipline control points into smooth SVG paths', () => {
    expect(map.ziplines).toHaveLength(3)
    expect(map.ziplines.map((z) => z.lane).sort()).toEqual(['center', 'left', 'right'])
    expect(map.ziplines.every((z) => /^M[\d. -]+(C[\d. -]+)+$/.test(z.d))).toBe(true)
    expect(map.ziplines.map((z) => (z.d.match(/C/g) || []).length)).toEqual([36, 45, 45])
    expect(ms.laneColors(map)).toEqual({ center: '#29b1cc', right: '#59b247', left: '#F1CC30' })
    expect([ms.laneColorName('#F1CC30'), ms.laneColorName('#29b1cc'), ms.laneColorName('#59B247'), ms.laneColorName('#000')]).toEqual(['yellow', 'blue', 'green', null])
  })

  it('has spline handles that are not longer than 1.5 segments (no loops)', () => {
    for (const z of raw.zipline_paths) {
      const N = z.P0_points
      let worst = 0
      for (let i = 0; i < N.length - 1; i++) {
        const seg = Math.hypot(N[i + 1][0] - N[i][0], N[i + 1][1] - N[i][1])
        const h1 = Math.hypot(z.P2_points[i][0], z.P2_points[i][1])
        const h2 = Math.hypot(z.P1_points[i + 1][0], z.P1_points[i + 1][1])
        worst = Math.max(worst, Math.max(h1, h2) / Math.max(seg, 1))
      }
      expect(worst).toBeLessThan(1.5)
    }
  })

  it('names the landmarks, vaults hold none', () => {
    expect(L.landmarks.map((c) => c.landmark).sort()).toEqual(['bellTower', 'sunkenPlaza', 'sunkenPlaza'])
    expect(L.camp_vault.some((c) => ms.landmarkOf(c))).toBe(false)
    expect(ms.landmarkOf({ id: 'dock_camp' })).toBeNull()
  })
})

describe('slimMap robustness', () => {
  it('survives an empty or broken response', () => {
    const empty = ms.slimMap({})
    expect(empty.radius).toBe(10752)
    expect(Object.values(empty.layers).every((a) => Array.isArray(a) && a.length === 0)).toBe(true)
    expect(empty.ziplines).toEqual([])
    expect(ms.slimMap(null).layers.crates).toHaveLength(0)
  })

  it('skips garbage entity rows and falls back to world coordinates', () => {
    expect(ms.slimMap({ entities: { crates: [null, {}, { position: [0, 0] }, { left_relative: 0.2, top_relative: 0.3 }] } }).layers.crates).toHaveLength(2)
    expect(ms.slimMap({ radius: 100, entities: { crates: [{ position: [0, 0] }, { position: [-100, 100] }] } }).layers.crates)
      .toEqual([{ x: 0.5, y: 0.5 }, { x: 0, y: 0 }])
  })
})

describe('layers in the address bar', () => {
  const preset = (id) => ms.PRESETS.find((p) => p.id === id)

  it('defaults to the overview and understands presets', () => {
    expect(ms.layersFromSearch(search(''))).toEqual(ms.normalizeLayers(preset('overview').layers))
    expect(ms.layersFromSearch(search('preset=new'))).toEqual(ms.normalizeLayers(preset('new').layers))
    expect(ms.layersFromSearch(search('preset=nope'))).toEqual(ms.layersFromSearch(search('')))
  })

  it('parses a layer list: canonical order, junk and duplicates dropped', () => {
    expect(ms.layersFromSearch(search('layers=ziplines,zzz,objectives,ziplines'))).toEqual(['objectives', 'ziplines'])
    expect(ms.layersFromSearch(search('layers='))).toEqual([])
    expect(ms.layersFromSearch(search('preset=new&layers=crates'))).toEqual(['crates'])
  })

  it('writes the shortest address', () => {
    expect(ms.searchForLayers(ms.layersFromSearch(search('')))).toEqual({})
    expect(ms.searchForLayers(preset('farm').layers)).toEqual({ preset: 'farm' })
    expect(ms.searchForLayers(['crates', 'objectives'])).toEqual({ layers: 'objectives,crates' })
    expect(ms.searchForLayers([])).toEqual({ preset: 'clear' })
  })

  it('detects the active preset', () => {
    expect(ms.activePreset(['landmarks', 'bells', 'statues', 'tough_crates', 'snacks', 'vents'])).toBe('new')
    expect(ms.activePreset(['crates'])).toBeNull()
  })

  it('has consistent layer and preset tables', () => {
    expect(ms.PRESETS.every((p) => p.layers.every((id) => ms.LAYER_IDS.includes(id)))).toBe(true)
    expect(new Set(ms.LAYER_IDS).size).toBe(ms.LAYER_IDS.length)
    expect(ms.LAYERS.every((l) => ms.LAYER_GROUPS.includes(l.group))).toBe(true)
  })

  it.each(ms.PRESETS.map((p) => p.id))('round-trips preset %s', (id) => {
    const back = ms.layersFromSearch(new URLSearchParams(ms.searchForLayers(preset(id).layers)))
    expect(back).toEqual(ms.normalizeLayers(preset(id).layers))
  })
})

describe('heat map', () => {
  const SIZE = 168
  // Детерминированный набор строк: клетки по всему полю (часть — за краем растра)
  const rows = (() => {
    let seed = 12345
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
    return Array.from({ length: 600 }, () => ({
      position_x: Math.floor(rnd() * 22000) - 11000,
      position_y: Math.floor(rnd() * 22000) - 11000,
      killer_team: rnd() < 0.5 ? 0 : 1,
      deaths: 1 + Math.floor(rnd() * 20),
      kills: 1 + Math.floor(rnd() * 20),
    }))
  })()
  const inRange = (r) => {
    const c = Math.floor((r.position_x + 10752) / 128)
    const l = Math.floor((10752 - r.position_y) / 128) - 1
    return c >= 0 && c < SIZE && l >= 0 && l < SIZE
  }

  it('sums only the cells that lie inside the raster', () => {
    const heat = ms.slimHeat(rows)
    expect(heat.size).toBe(SIZE)
    expect(heat.cells.length % 4).toBe(0)
    expect(heat.cells.every((v, i) => (i % 4 > 1) || (v >= 0 && v < SIZE))).toBe(true)
    const kept = rows.filter(inRange)
    expect([heat.deaths, heat.kills]).toEqual([kept.reduce((a, r) => a + r.deaths, 0), kept.reduce((a, r) => a + r.kills, 0)])
    expect(heat.cells.filter((_, i) => i % 4 === 2).reduce((a, b) => a + b, 0)).toBe(heat.deaths)
  })

  it('places corner cells and merges the two teams', () => {
    expect(ms.slimHeat([{ position_x: -10752, position_y: 10624, killer_team: 0, deaths: 5, kills: 7 }]).cells).toEqual([0, 0, 5, 7])
    expect(ms.slimHeat([{ position_x: 10624, position_y: -10752, killer_team: 1, deaths: 3, kills: 1 }]).cells).toEqual([167, 167, 3, 1])
    expect(ms.slimHeat([
      { position_x: 0, position_y: 0, killer_team: 0, deaths: 5, kills: 6 },
      { position_x: 0, position_y: 0, killer_team: 1, deaths: 4, kills: 2 },
    ]).cells).toEqual([84, 83, 9, 8])
    expect(ms.slimHeat([{ position_x: 0, position_y: 11008, deaths: 9, kills: 9 }]).cells).toEqual([])
  })

  it('survives empty and broken rows', () => {
    const empty = { size: SIZE, cells: [], deaths: 0, kills: 0 }
    expect(ms.slimHeat([])).toEqual(empty)
    expect(ms.slimHeat([null, {}, { position_x: 'a', position_y: 0 }])).toEqual(empty)
  })

  it('scales intensity with a square root and clamps it', () => {
    near(ms.heatLevel(0, 100), 0)
    near(ms.heatLevel(100, 100), 1)
    near(ms.heatLevel(500, 100), 1)
    near(ms.heatLevel(25, 100), 0.5)
  })

  it('has a transparent low end, a red top and monotonic alpha', () => {
    expect(ms.heatColor(0)[3]).toBe(0)
    expect(ms.heatColor(1)).toEqual([255, 75, 120, 225])
    const alphas = [0, 0.1, 0.3, 0.6, 0.9, 1].map((v) => ms.heatColor(v)[3])
    expect(alphas.every((a, i) => i === 0 || a >= alphas[i - 1])).toBe(true)
  })

  it('computes a positive cap for the colour scale and knows the match phases', () => {
    const heat = ms.slimHeat(rows)
    expect(ms.heatMax(heat, 'deaths')).toBeGreaterThan(1)
    expect(ms.heatMax(heat, 'kills')).toBeGreaterThan(1)
    expect(Object.keys(ms.HEAT_PHASES)).toEqual(['all', 'early', 'mid', 'late'])
  })
})
