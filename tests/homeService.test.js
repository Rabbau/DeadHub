import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOME_SECTIONS, HOME_TOP_COUNT, summarizeFilters, tileNumber } from '../src/services/homeService.js'
import { SEARCH_PAGES } from '../src/services/searchService.js'
import { DEFAULT_FILTERS } from '../src/services/statsFilters.js'
import { appRoutes } from './helpers/appRoutes.js'

const SRC = path.resolve(import.meta.dirname, '../src')

describe('home sections', () => {
  const { fixed } = appRoutes()
  const tiles = HOME_SECTIONS.map((section) => section.to)

  it('lists every section once', () => {
    expect(new Set(HOME_SECTIONS.map((section) => section.id)).size).toBe(HOME_SECTIONS.length)
    expect(new Set(tiles).size).toBe(tiles.length)
  })

  it('points only to pages that exist in the app', () => {
    for (const to of tiles) expect(fixed, to).toContain(to)
  })

  it('leaves no page without a tile: a new route in App.jsx has to be reachable from the home page', () => {
    const missing = fixed.filter((route) => route !== '/' && !tiles.includes(route))
    expect(missing).toEqual([])
  })

  it('never links the home page to itself', () => {
    expect(tiles).not.toContain('/')
  })

  it('covers every link of the site menu', () => {
    const nav = fs.readFileSync(path.join(SRC, 'components/layout/Nav.jsx'), 'utf8')
    const links = [...nav.matchAll(/\{ to: '(\/[a-z]+)'/g)].map((match) => match[1])
    expect(links.length).toBeGreaterThanOrEqual(13)
    for (const to of links) expect(tiles, to).toContain(to)
  })

  it('is searchable too: every tile address is a page of the search', () => {
    // Профиль в поиске появляется, только когда он выбран (SearchDialog), поэтому в статичном списке его нет
    for (const to of tiles.filter((route) => route !== '/me')) expect(SEARCH_PAGES.map((page) => page.to), to).toContain(to)
  })

  it('numbers tiles from 01', () => {
    expect([0, 1, 8, 9, 13].map(tileNumber)).toEqual(['01', '02', '09', '10', '14'])
  })

  it('shows a short top, not the whole table', () => {
    expect(HOME_TOP_COUNT).toBeGreaterThanOrEqual(3)
    expect(HOME_TOP_COUNT).toBeLessThanOrEqual(10) // useMetaDashboard отдаёт десять
  })
})

describe('summarizeFilters', () => {
  // t, который показывает, что и с какими параметрами у него спросили
  const t = (key, params) => (params ? `${key}${JSON.stringify(params)}` : key)

  it('names the period and the rank preset', () => {
    expect(summarizeFilters(DEFAULT_FILTERS, t)).toBe('filters.days{"count":30} · filters.rank: filters.presets.all')
    expect(summarizeFilters({ period: 7, rankMin: 5, rankMax: 8 }, t)).toBe('filters.days{"count":7} · filters.rank: filters.presets.mid')
  })

  it('says «since the patch» for the patch period', () => {
    expect(summarizeFilters({ period: 'patch', since: 1790713511, rankMin: 1, rankMax: 11 }, t)).toBe('filters.sincePatch · filters.rank: filters.presets.all')
  })

  it('calls a range of its own a custom range', () => {
    expect(summarizeFilters({ period: 14, rankMin: 3, rankMax: 9 }, t)).toBe('filters.days{"count":14} · filters.rank: home.customRanks')
  })

  it('names the mode instead of ranks in Street Brawl', () => {
    expect(summarizeFilters({ ...DEFAULT_FILTERS, mode: 'street_brawl' }, t)).toBe('filters.days{"count":30} · filters.modes.street_brawl')
  })
})
