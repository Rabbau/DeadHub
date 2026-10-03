import { afterEach, describe, expect, it, vi } from 'vitest'
import { PREVIEW_SCALE, crosshairImageUrl, decodeCrosshairCode, fetchCrosshairCode } from '../src/api/crosshairApi.js'
import { CROSSHAIR_DEFAULTS } from '../src/services/crosshairService.js'

/** Подменяет fetch: запоминает адреса и отвечает заданным телом. */
function stubFetch(body, { status = 200 } = {}) {
  const calls = []
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    calls.push(String(url))
    return { ok: status >= 200 && status < 300, status, statusText: 'x', headers: { get: () => null }, json: async () => body }
  }))
  return calls
}

afterEach(() => { vi.unstubAllGlobals() })

describe('crosshairImageUrl', () => {
  it('asks for the default crosshair with only the screen height and the scale', () => {
    expect(crosshairImageUrl(CROSSHAIR_DEFAULTS)).toBe(`/api/v1/crosshair/settings/image?screen_height=1080&scale=${PREVIEW_SCALE}`)
    expect(crosshairImageUrl({})).toBe(crosshairImageUrl(CROSSHAIR_DEFAULTS))
  })

  it('adds only what differs from the defaults, in a stable order', () => {
    const url = crosshairImageUrl({ pip_width: 3, color_r: 0, dot_size: 4 })
    expect(url).toBe(`/api/v1/crosshair/settings/image?color_r=0&pip_width=3&screen_height=1080&scale=${PREVIEW_SCALE}`)
    expect(crosshairImageUrl({ color_r: 0, pip_width: 3 })).toBe(url)
  })

  it('takes the screen height and the scale', () => {
    expect(crosshairImageUrl({}, { screenHeight: 2160, scale: 4 })).toBe('/api/v1/crosshair/settings/image?screen_height=2160&scale=4')
  })

  it('cleans the settings before they reach the address', () => {
    // «лишнее» поле и значение вне пределов не попадают в запрос как есть
    const url = crosshairImageUrl({ evil: '1&x=2', pip_width: 9999, themed: 'true' })
    expect(url).not.toContain('evil')
    expect(url).toContain('pip_width=255')
    expect(url).toContain('themed=true')
  })
})

describe('fetchCrosshairCode', () => {
  it('returns the code for the default crosshair and keeps the "?" the API answers', async () => {
    const calls = stubFetch({ code: 'DL.AQHAdYkf' })
    await expect(fetchCrosshairCode({})).resolves.toBe('DL.AQHAdYkf')
    expect(calls).toEqual(['/api/v1/crosshair/settings/code?'])
  })

  it('sends only the changed settings', async () => {
    const calls = stubFetch({ code: 'DL.x' })
    await fetchCrosshairCode({ dot_size: 7, color_g: 20 })
    expect(calls).toEqual(['/api/v1/crosshair/settings/code?color_g=20&dot_size=7'])
  })

  it('fails when the answer has no code', async () => {
    stubFetch({})
    await expect(fetchCrosshairCode({ dot_size: 8 })).rejects.toThrow('crosshair code missing')
    stubFetch({ code: '' })
    await expect(fetchCrosshairCode({ dot_size: 9 })).rejects.toThrow()
  })
})

describe('decodeCrosshairCode', () => {
  it('encodes the code into the address and cleans the settings in the answer', async () => {
    const calls = stubFetch({ ...CROSSHAIR_DEFAULTS, dot_size: 7, color_r: 999, unknown: 1 })
    const settings = await decodeCrosshairCode('DL.a+b/c d')
    expect(calls).toEqual(['/api/v1/crosshair/code/settings?code=DL.a%2Bb%2Fc+d'])
    expect(settings).toMatchObject({ dot_size: 7, color_r: 255 })
    expect(settings).not.toHaveProperty('unknown')
  })

  it('passes the error status of the API on (a bad code is a 400)', async () => {
    stubFetch({ error: 'x' }, { status: 400 })
    await expect(decodeCrosshairCode('DL.nonsense')).rejects.toMatchObject({ status: 400 })
  })
})
