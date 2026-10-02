import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Клиент читает localStorage при загрузке модуля и хранит состояние (запросы в пути, пауза после 429) на уровне
// модуля, поэтому каждый тест подключает его заново, с чистым хранилищем и поддельными fetch и временем.
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Хранилище, которое умеет «кончаться»: при превышении quota (в знаках) setItem бросает QuotaExceededError. */
function makeStorage({ quota = Infinity } = {}) {
  const map = new Map()
  const size = () => [...map].reduce((total, [key, value]) => total + key.length + value.length, 0)
  return {
    map,
    size,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem(key, value) {
      const next = size() - (map.has(key) ? key.length + map.get(key).length : 0) + key.length + String(value).length
      if (next > quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      map.set(key, String(value))
    },
    removeItem: (key) => { map.delete(key) },
    key: (index) => [...map.keys()][index] ?? null,
    get length() { return map.size },
  }
}

const denied = () => { throw new DOMException('Access is denied for this document.', 'SecurityError') }
const blockedStorage = { getItem: denied, setItem: denied, removeItem: denied, key: denied, get length() { return denied() } }

const KEY = (name) => `dlhub_v3_${name}`
const stored = (data, { ts = NOW, ttl } = {}) => JSON.stringify(ttl === undefined ? { ts, data } : { ts, ttl, data })
const ok = (data) => ({ ok: true, status: 200, statusText: 'OK', headers: new Headers(), json: async () => data })
const failure = (status, headers = {}) => ({ ok: false, status, statusText: 'Failure', headers: new Headers(headers), json: async () => ({}) })

let storage
let fetchMock
let http

async function setup({ quota, storageOverride } = {}) {
  vi.resetModules()
  storage = storageOverride ?? makeStorage({ quota })
  fetchMock = vi.fn()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('fetch', fetchMock)
  http = await import('../src/api/httpClient.js')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('httpGet and the cache', () => {
  it('serves a fresh entry without touching the network', async () => {
    await setup()
    storage.setItem(KEY('a'), stored({ n: 1 }, { ts: NOW - 10 * 60_000 }))
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).resolves.toEqual({ n: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches on a miss, transforms before caching and serves the next call from the cache', async () => {
    await setup()
    fetchMock.mockResolvedValue(ok({ big: 'x'.repeat(500), keep: 7 }))
    const slim = (raw) => ({ keep: raw.keep })

    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR, transform: slim })).resolves.toEqual({ keep: 7 })
    expect(storage.getItem(KEY('a'))).not.toContain('xxxxx') // в кеш ушёл облегчённый вид
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR, transform: slim })).resolves.toEqual({ keep: 7 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('records the time to live next to the time of writing', async () => {
    await setup()
    fetchMock.mockResolvedValue(ok({ n: 1 }))
    await http.httpGet('/x', { cacheKey: 'a', ttl: 6 * HOUR })
    expect(storage.getItem(KEY('a'))).toBe(`{"ts":${NOW},"ttl":${6 * HOUR},"data":{"n":1}}`)
  })

  it('refetches an expired entry and replaces it', async () => {
    await setup()
    storage.setItem(KEY('a'), stored({ n: 1 }, { ts: NOW - 2 * HOUR }))
    fetchMock.mockResolvedValue(ok({ n: 2 }))
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).resolves.toEqual({ n: 2 })
    expect(JSON.parse(storage.getItem(KEY('a')))).toMatchObject({ ts: NOW, data: { n: 2 } })
  })

  it('treats a cached null as a miss, as it always did: an empty result is worth rechecking', async () => {
    await setup()
    storage.setItem(KEY('a'), stored(null))
    fetchMock.mockResolvedValue(ok({ n: 3 }))
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).resolves.toEqual({ n: 3 })
  })

  it('shares one request between identical parallel calls', async () => {
    await setup()
    fetchMock.mockResolvedValue(ok({ n: 1 }))
    const [a, b] = await Promise.all([http.httpGet('/x', { cacheKey: 'a' }), http.httpGet('/x', { cacheKey: 'a' })])
    expect(a).toEqual(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('asks the server to revalidate only when told to, and always asks for JSON', async () => {
    await setup()
    fetchMock.mockResolvedValue(ok({}))
    await http.httpGet('/plain', { cacheKey: 'p' })
    await http.httpGet('/fresh', { cacheKey: 'f', revalidate: true })
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Accept: 'application/json' } })
    expect(fetchMock.mock.calls[0][1].cache).toBeUndefined()
    expect(fetchMock.mock.calls[1][1].cache).toBe('no-cache')
  })

  it('does not use the storage at all when caching is off', async () => {
    await setup()
    storage.setItem(KEY('x'), stored({ old: true }, { ts: NOW - 5 * HOUR }))
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(http.httpGet('/x', { cache: false, cacheKey: 'x' })).rejects.toThrow('Failed to fetch') // запасной записи нет
    fetchMock.mockResolvedValue(ok({ n: 1 }))
    await http.httpGet('/y', { cache: false, cacheKey: 'y' })
    expect(storage.getItem(KEY('y'))).toBeNull()
  })

  it('keeps the HTTP status on errors for the callers that read it', async () => {
    await setup()
    fetchMock.mockResolvedValue(failure(404))
    await expect(http.httpGet('/missing', { cacheKey: 'm' })).rejects.toMatchObject({ status: 404 })
  })
})

describe('stale-if-error: an outdated entry is a fallback, not garbage', () => {
  const expired = () => stored({ n: 'stale' }, { ts: NOW - 3 * HOUR })

  it.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 500', () => Promise.resolve(failure(500))],
    ['a 503', () => Promise.resolve(failure(503))],
    ['a 502', () => Promise.resolve(failure(502))],
    ['a 429', () => Promise.resolve(failure(429))],
    ['a 408', () => Promise.resolve(failure(408))],
  ])('serves the old data after %s', async (_name, response) => {
    await setup()
    storage.setItem(KEY('a'), expired())
    fetchMock.mockImplementation(response)
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).resolves.toEqual({ n: 'stale' })
  })

  it.each([400, 401, 403, 404, 410, 422])('does not hide a %s behind old data: it says “there is no such thing”', async (status) => {
    await setup()
    storage.setItem(KEY('a'), expired())
    fetchMock.mockResolvedValue(failure(status))
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).rejects.toMatchObject({ status })
  })

  it('still throws when there is nothing to fall back to', async () => {
    await setup()
    fetchMock.mockResolvedValue(failure(503))
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).rejects.toMatchObject({ status: 503 })
  })

  it('does not serve data older than a week, and removes it', async () => {
    await setup()
    storage.setItem(KEY('a'), stored({ n: 'ancient' }, { ts: NOW - 8 * DAY }))
    fetchMock.mockResolvedValue(failure(503))
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).rejects.toMatchObject({ status: 503 })
    expect(storage.getItem(KEY('a'))).toBeNull()
  })

  it('serves an entry that is just inside the limit', async () => {
    await setup()
    storage.setItem(KEY('a'), stored({ n: 'old but usable' }, { ts: NOW - 7 * DAY + 60_000 }))
    fetchMock.mockResolvedValue(failure(503))
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).resolves.toEqual({ n: 'old but usable' })
  })

  it('throws the real error when the old entry is unreadable', async () => {
    await setup()
    storage.setItem(KEY('a'), `{"ts":${NOW - 3 * HOUR},"ttl":${HOUR},"data":{"broken`)
    fetchMock.mockResolvedValue(failure(503))
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).rejects.toMatchObject({ status: 503 })
  })

  it('gives every parallel caller the old data', async () => {
    await setup()
    storage.setItem(KEY('a'), expired())
    fetchMock.mockResolvedValue(failure(503))
    const results = await Promise.all([http.httpGet('/x', { cacheKey: 'a', ttl: HOUR }), http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })])
    expect(results).toEqual([{ n: 'stale' }, { n: 'stale' }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('replaces the old entry as soon as the API answers again', async () => {
    await setup()
    storage.setItem(KEY('a'), expired())
    fetchMock.mockResolvedValueOnce(failure(503)).mockResolvedValueOnce(ok({ n: 'fresh' }))
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).resolves.toEqual({ n: 'stale' })
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).resolves.toEqual({ n: 'fresh' })
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).resolves.toEqual({ n: 'fresh' }) // уже из кеша
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('timeout', () => {
  /** fetch, который не отвечает, пока его не прервут: как зависшее соединение. */
  const hanging = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
  })

  it('aborts a request that never answers and says so', async () => {
    await setup()
    fetchMock.mockImplementation(hanging)
    const result = expect(http.httpGet('/slow', { cacheKey: 's' })).rejects.toMatchObject({ name: 'TimeoutError', code: 'timeout' })
    await vi.advanceTimersByTimeAsync(http.REQUEST_TIMEOUT_MS - 1)
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await result
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('takes the limit from the call when it has its own', async () => {
    await setup()
    fetchMock.mockImplementation(hanging)
    const result = expect(http.httpGet('/slow', { cacheKey: 's', timeoutMs: 2_000 })).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(2_000)
    await result
  })

  it('also covers a body that stops halfway', async () => {
    await setup()
    fetchMock.mockImplementation((url, init) => Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    }))
    const result = expect(http.httpGet('/slow-body', { cacheKey: 'b', timeoutMs: 5_000 })).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(5_000)
    await result
  })

  it('serves the old data when the wait ran out', async () => {
    await setup()
    storage.setItem(KEY('a'), stored({ n: 'stale' }, { ts: NOW - 3 * HOUR }))
    fetchMock.mockImplementation(hanging)
    const result = http.httpGet('/slow', { cacheKey: 'a', ttl: HOUR, timeoutMs: 1_000 })
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(result).resolves.toEqual({ n: 'stale' })
  })

  it('leaves no timer behind after a normal answer or a failure', async () => {
    await setup()
    fetchMock.mockResolvedValueOnce(ok({ n: 1 })).mockResolvedValueOnce(failure(404))
    await http.httpGet('/a', { cacheKey: 'a' })
    await expect(http.httpGet('/b', { cacheKey: 'b' })).rejects.toMatchObject({ status: 404 })
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('pause after “too many requests”', () => {
  it('stops asking the API for the time it named, then tries again', async () => {
    await setup()
    fetchMock.mockResolvedValueOnce(failure(429, { 'Retry-After': '7' })).mockResolvedValue(ok({ n: 1 }))

    await expect(http.httpGet('/a', { cacheKey: 'a' })).rejects.toMatchObject({ status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // В паузе другие запросы даже не уходят: общий лимит и так исчерпан
    await vi.advanceTimersByTimeAsync(6_000)
    await expect(http.httpGet('/b', { cacheKey: 'b' })).rejects.toMatchObject({ status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_001)
    await expect(http.httpGet('/b', { cacheKey: 'b' })).resolves.toEqual({ n: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses the usual pause when the API names none', async () => {
    await setup()
    fetchMock.mockResolvedValueOnce(failure(429)).mockResolvedValue(ok({ n: 1 }))
    await expect(http.httpGet('/a', { cacheKey: 'a' })).rejects.toMatchObject({ status: 429 })
    await vi.advanceTimersByTimeAsync(http.RATE_LIMIT_PAUSE_MS - 1)
    await expect(http.httpGet('/b', { cacheKey: 'b' })).rejects.toMatchObject({ status: 429 })
    await vi.advanceTimersByTimeAsync(2)
    await expect(http.httpGet('/b', { cacheKey: 'b' })).resolves.toEqual({ n: 1 })
  })

  it('shows old data during the pause instead of an error', async () => {
    await setup()
    storage.setItem(KEY('a'), stored({ n: 'stale' }, { ts: NOW - 3 * HOUR }))
    fetchMock.mockResolvedValue(failure(429, { 'Retry-After': '60' }))
    await expect(http.httpGet('/other', { cacheKey: 'other' })).rejects.toMatchObject({ status: 429 })
    await expect(http.httpGet('/x', { cacheKey: 'a', ttl: HOUR })).resolves.toEqual({ n: 'stale' })
    expect(fetchMock).toHaveBeenCalledTimes(1) // второй запрос в сеть не уходил
  })

  it('does not pause on other failures', async () => {
    await setup()
    fetchMock.mockResolvedValueOnce(failure(503)).mockResolvedValue(ok({ n: 1 }))
    await expect(http.httpGet('/a', { cacheKey: 'a' })).rejects.toMatchObject({ status: 503 })
    await expect(http.httpGet('/b', { cacheKey: 'b' })).resolves.toEqual({ n: 1 })
  })
})

describe('pauseFromRetryAfter', () => {
  it('reads seconds and dates and keeps the pause within sensible limits', async () => {
    await setup()
    const now = NOW
    expect(http.pauseFromRetryAfter('7', now)).toBe(7_000)
    expect(http.pauseFromRetryAfter('1', now)).toBe(5_000) // слишком коротко — не меньше 5 с
    expect(http.pauseFromRetryAfter('600', now)).toBe(120_000) // слишком долго — не больше 2 минут
    expect(http.pauseFromRetryAfter(new Date(now + 20_000).toUTCString(), now)).toBe(20_000)
    expect(http.pauseFromRetryAfter(new Date(now - 60_000).toUTCString(), now)).toBe(5_000) // дата в прошлом
  })

  it('falls back to the usual pause for a missing or meaningless header', async () => {
    await setup()
    for (const header of [undefined, null, '', '   ', 'soon', '-5', '3.5']) {
      expect(http.pauseFromRetryAfter(header, NOW), String(header)).toBe(http.RATE_LIMIT_PAUSE_MS)
    }
  })
})

describe('isRecoverable', () => {
  it('says yes only when the API did not (or could not) answer', async () => {
    await setup()
    for (const error of [new TypeError('Failed to fetch'), { name: 'TimeoutError' }, { status: 408 }, { status: 429 }, { status: 500 }, { status: 502 }, { status: 503 }, { status: 504 }, null, undefined]) {
      expect(http.isRecoverable(error), JSON.stringify(error)).toBe(true)
    }
    for (const status of [400, 401, 403, 404, 405, 410, 422]) expect(http.isRecoverable({ status }), String(status)).toBe(false)
  })
})

describe('making room in a full storage', () => {
  const entryOf = (name, { ts, ttl, filler = 80 }) => [KEY(name), stored({ pad: 'x'.repeat(filler) }, { ts, ttl })]
  const sizeOf = ([key, value]) => key.length + value.length

  it('removes outdated entries first and keeps fresh ones with a long life, however old they are', async () => {
    const longLived = entryOf('match', { ts: NOW - 2 * HOUR, ttl: 7 * DAY }) // 2 часа — но срок жизни неделя
    const outdated = entryOf('stats', { ts: NOW - 3 * HOUR, ttl: HOUR })
    await setup({ quota: 10_000 })
    const incoming = JSON.stringify({ ts: NOW, ttl: HOUR, data: { pad: 'y'.repeat(80) } })
    storage = makeStorage({ quota: sizeOf(longLived) + sizeOf(outdated) + KEY('new').length + incoming.length - 1 })
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
    http = await import('../src/api/httpClient.js')
    storage.setItem(...longLived)
    storage.setItem(...outdated)
    fetchMock = vi.fn().mockResolvedValue(ok({ pad: 'y'.repeat(80) }))
    vi.stubGlobal('fetch', fetchMock)

    await http.httpGet('/new', { cacheKey: 'new', ttl: HOUR })

    expect(storage.getItem(KEY('new'))).not.toBeNull()
    expect(storage.getItem(longLived[0])).not.toBeNull()
    expect(storage.getItem(outdated[0])).toBeNull()
  })

  it('drops the oldest third when nothing is outdated yet', async () => {
    const entries = ['one', 'two', 'three'].map((name, i) => entryOf(name, { ts: NOW - (3 - i) * 60_000, ttl: DAY }))
    const incoming = JSON.stringify({ ts: NOW, ttl: DAY, data: { pad: 'y'.repeat(80) } })
    storage = makeStorage({ quota: entries.reduce((n, e) => n + sizeOf(e), 0) + KEY('new').length + incoming.length - 1 })
    vi.resetModules()
    vi.stubGlobal('localStorage', storage)
    fetchMock = vi.fn().mockResolvedValue(ok({ pad: 'y'.repeat(80) }))
    vi.stubGlobal('fetch', fetchMock)
    http = await import('../src/api/httpClient.js')
    entries.forEach((entry) => storage.setItem(...entry))

    await http.httpGet('/new', { cacheKey: 'new', ttl: DAY })

    expect(storage.getItem(KEY('new'))).not.toBeNull()
    expect(storage.getItem(entries[0][0])).toBeNull() // самая старая
    expect(storage.getItem(entries[1][0])).not.toBeNull()
    expect(storage.getItem(entries[2][0])).not.toBeNull()
  })

  it('reads entries written before the life time was recorded as hour-long ones', async () => {
    const legacy = [KEY('legacy'), stored({ pad: 'x'.repeat(80) }, { ts: NOW - 2 * HOUR })] // без ttl, старше часа
    const fresh = entryOf('fresh', { ts: NOW - 60_000, ttl: HOUR })
    const incoming = JSON.stringify({ ts: NOW, ttl: HOUR, data: { pad: 'y'.repeat(80) } })
    storage = makeStorage({ quota: sizeOf(legacy) + sizeOf(fresh) + KEY('new').length + incoming.length - 1 })
    vi.resetModules()
    vi.stubGlobal('localStorage', storage)
    fetchMock = vi.fn().mockResolvedValue(ok({ pad: 'y'.repeat(80) }))
    vi.stubGlobal('fetch', fetchMock)
    http = await import('../src/api/httpClient.js')
    storage.setItem(...legacy)
    storage.setItem(...fresh)

    await http.httpGet('/new', { cacheKey: 'new', ttl: HOUR })

    expect(storage.getItem(legacy[0])).toBeNull() // устарела по часовому сроку
    expect(storage.getItem(fresh[0])).not.toBeNull()
  })

  it('still returns the data when even a cleaned storage cannot hold it', async () => {
    await setup({ quota: 20 })
    fetchMock.mockResolvedValue(ok({ pad: 'z'.repeat(200) }))
    await expect(http.httpGet('/big', { cacheKey: 'big' })).resolves.toEqual({ pad: 'z'.repeat(200) })
    expect(storage.getItem(KEY('big'))).toBeNull()
  })
})

describe('when the storage is not available', () => {
  it('works without remembering anything', async () => {
    await setup({ storageOverride: blockedStorage })
    fetchMock.mockResolvedValue(ok({ n: 1 }))
    await expect(http.httpGet('/x', { cacheKey: 'a' })).resolves.toEqual({ n: 1 })
    await expect(http.httpGet('/x', { cacheKey: 'a' })).resolves.toEqual({ n: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not throw from clearAppCache', async () => {
    await setup({ storageOverride: blockedStorage })
    expect(() => http.clearAppCache()).not.toThrow()
  })
})

describe('housekeeping', () => {
  it('removes caches of earlier format versions at start and leaves other keys alone', async () => {
    vi.resetModules()
    storage = makeStorage()
    storage.setItem('dlhub_v2_heroes', '{"ts":1,"data":[]}')
    storage.setItem('dlhub_v1_items', '{"ts":1,"data":[]}')
    storage.setItem('dlhub_v3_current', stored({ n: 1 }))
    storage.setItem('dlhub_language', 'russian')
    storage.setItem('unrelated', 'x')
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('fetch', vi.fn())
    await import('../src/api/httpClient.js')
    expect([...storage.map.keys()].sort()).toEqual(['dlhub_language', 'dlhub_v3_current', 'unrelated'])
  })

  it('clearAppCache removes everything the site keeps (cache and settings) and nothing else', async () => {
    await setup()
    storage.setItem('dlhub_v3_a', stored(1))
    storage.setItem('dlhub_filters', '{}')
    storage.setItem('dlhub_language', 'russian')
    storage.setItem('unrelated', 'x')
    http.clearAppCache()
    expect([...storage.map.keys()]).toEqual(['unrelated'])
  })
})
