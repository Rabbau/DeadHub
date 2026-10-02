import { describe, expect, it } from 'vitest'
import * as mv from '../src/services/mapView.js'

const S = 800 // сторона карты на экране, px

describe('clampView', () => {
  it('keeps the unzoomed map in place', () => {
    expect(mv.clampView({ scale: 1, x: 50, y: -50 }, S)).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('limits the zoom', () => {
    expect(mv.clampView({ scale: 99, x: 0, y: 0 }, S).scale).toBe(mv.MAX_ZOOM)
    expect(mv.clampView({ scale: 0.2, x: 0, y: 0 }, S).scale).toBe(mv.MIN_ZOOM)
  })

  it('does not let the map leave the frame', () => {
    expect(mv.clampView({ scale: 2, x: -5000, y: 100 }, S)).toEqual({ scale: 2, x: -800, y: 0 })
  })
})

describe('zoomAt', () => {
  it('zooms around the centre', () => {
    expect(mv.zoomAt(mv.INITIAL_VIEW, 2, 400, 400, S)).toEqual({ scale: 2, x: -400, y: -400 })
  })

  it('keeps the point under the cursor in place', () => {
    const [px, py] = [600, 200]
    const v = mv.zoomAt({ scale: 1, x: 0, y: 0 }, 3, px, py, S)
    expect((px - v.x) / (S * v.scale)).toBeCloseTo(px / S, 6)
    expect((py - v.y) / (S * v.scale)).toBeCloseTo(py / S, 6)
  })

  it('resets the pan when zooming out to 1×, ignores zooming past the maximum', () => {
    expect(mv.zoomAt({ scale: 2, x: -300, y: -100 }, 0.1, 400, 400, S)).toEqual({ scale: 1, x: 0, y: 0 })
    expect(mv.zoomAt({ scale: mv.MAX_ZOOM, x: -100, y: -100 }, 2, 100, 100, S).scale).toBe(mv.MAX_ZOOM)
  })
})

describe('panBy and centerOn', () => {
  it('clamps panning and does nothing at 1×', () => {
    expect(mv.panBy({ scale: 2, x: -100, y: -100 }, -9999, 9999, S)).toEqual({ scale: 2, x: -800, y: 0 })
    expect(mv.panBy({ scale: 1, x: 0, y: 0 }, 50, 50, S)).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('centres on a point, clamped at the corners', () => {
    expect(mv.centerOn(0.5, 0.5, 4, S)).toEqual({ scale: 4, x: -1200, y: -1200 })
    expect(mv.centerOn(0, 0, 4, S)).toEqual({ scale: 4, x: 0, y: 0 })
  })
})
