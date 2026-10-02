import { beforeEach, describe, expect, it, vi } from 'vitest'

// Сеть не нужна: подменяем HTTP-клиент и проверяем, как heroApi читает его ответы и ошибки
vi.mock('../src/api/httpClient.js', () => ({ httpGet: vi.fn() }))

const { httpGet } = await import('../src/api/httpClient.js')
const { fetchHeroDeltas, fetchHeroDetail, fetchWeeklyStats } = await import('../src/api/heroApi.js')

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status })
const emptyStats = { total: 0, byHero: {} }

describe('fetchHeroDetail', () => {
  beforeEach(() => {
    httpGet.mockReset()
  })

  it('reports a hero that does not exist (404) or an id that is not a number (400) as «notFound»', async () => {
    httpGet.mockImplementation(async (url) => {
      if (url.includes('/assets/heroes/')) throw httpError(404)
      return url.includes('hero-stats') ? emptyStats : []
    })
    await expect(fetchHeroDetail('9999')).rejects.toMatchObject({ message: 'notFound', status: 404 })

    httpGet.mockImplementation(async (url) => {
      if (url.includes('/assets/heroes/')) throw httpError(400)
      return url.includes('hero-stats') ? emptyStats : []
    })
    await expect(fetchHeroDetail('abc')).rejects.toMatchObject({ message: 'notFound', status: 400 })
  })

  it('does not call a network failure «not found»: the page falls back to the stats it has', async () => {
    httpGet.mockImplementation(async (url) => {
      if (url.includes('/assets/heroes/')) throw new Error('Failed to fetch')
      return url.includes('hero-stats') ? { total: 100, byHero: { 7: { matches: 100, wins: 55, kills: 0, deaths: 0, assists: 0 } } } : []
    })
    const hero = await fetchHeroDetail('7')
    expect(hero.id).toBe(7)
    expect(hero.stats.winrate).toBe(0.55)
  })
})

describe('request shapes (the free API is rate limited, so the URLs matter)', () => {
  beforeEach(() => {
    httpGet.mockReset()
    httpGet.mockResolvedValue({ weeks: [], total: [], byHero: {} })
  })

  it('weekly history is one hero-stats request with week buckets, ranks and mode of the filters', async () => {
    await fetchWeeklyStats({ period: 30, rankMin: 9, rankMax: 10 })
    await fetchWeeklyStats({ period: 30, rankMin: 9, rankMax: 10, mode: 'street_brawl' })
    const [normal, brawl] = httpGet.mock.calls.map(([url]) => new URL(url, 'http://x'))
    expect(normal.pathname).toBe('/api/v1/analytics/hero-stats')
    expect(normal.searchParams.get('bucket')).toBe('start_time_week')
    expect(normal.searchParams.get('min_average_badge')).toBe('91')
    expect(normal.searchParams.get('game_mode')).toBeNull()
    expect(brawl.searchParams.get('game_mode')).toBe('street_brawl')
    expect(brawl.searchParams.get('min_average_badge')).toBeNull() // в Street Brawl API отвечает 400 на ранги
  })

  it('comparison asks for the window between the two updates and nothing else is added', async () => {
    httpGet.mockResolvedValue(emptyStats)
    const patches = [{ at: 2000, title: 'New' }, { at: 1000, title: 'Old' }]
    const result = await fetchHeroDeltas({ period: 'patch', since: 2000, rankMin: 1, rankMax: 11 }, patches)
    expect(result.window).toMatchObject({ since: 1000, until: 2000, kind: 'patch' })
    const urls = httpGet.mock.calls.map(([url]) => new URL(url, 'http://x'))
    expect(urls).toHaveLength(2) // текущий период и прошлый — ровно два запроса
    const previous = urls.find((u) => u.searchParams.has('max_unix_timestamp'))
    expect(previous.searchParams.get('min_unix_timestamp')).toBe('1000')
    expect(previous.searchParams.get('max_unix_timestamp')).toBe('2000')
  })

  it('makes no request when there is no previous update to compare with', async () => {
    const result = await fetchHeroDeltas({ period: 'patch', since: 1000, rankMin: 1, rankMax: 11 }, [{ at: 1000, title: 'Only' }])
    expect(result).toBeNull()
    expect(httpGet).not.toHaveBeenCalled()
  })
})
