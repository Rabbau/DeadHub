import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CURRENT_UPDATE } from '../src/data/updates.js'
import {
  HOME_SECTIONS, HOME_TIER_HEROES, HOME_TOP_COUNT, bannerArt, summarizeFilters, tierPreview, tileNumber, updateDate,
} from '../src/services/homeService.js'
import { SEARCH_PAGES } from '../src/services/searchService.js'
import { DEFAULT_FILTERS } from '../src/services/statsFilters.js'
import { buildTierList } from '../src/services/tierService.js'
import { appRoutes } from './helpers/appRoutes.js'

const SRC = path.resolve(import.meta.dirname, '../src')
const PUBLIC = path.resolve(import.meta.dirname, '../public')

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

describe('home tiles', () => {
  const source = fs.readFileSync(path.join(SRC, 'components/home/HomeTiles.jsx'), 'utf8')
  const ids = HOME_SECTIONS.map((section) => section.id)

  it('only name sections that exist, so a removed section cannot break the page', () => {
    const named = [
      ...[...source.matchAll(/\bid="([a-z]+)"/g)].map((match) => match[1]),
      ...[...source.matchAll(/\bSECTION\.([a-z]+)\b/g)].map((match) => match[1]),
      ...[...source.matchAll(/QUICK_SECTIONS = \[([^\]]+)\]/g)].flatMap((match) => [...match[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])),
    ]
    expect(named.length).toBeGreaterThanOrEqual(10)
    for (const id of named) expect(ids, id).toContain(id)
  })

  it('give every tile a place in the grid', () => {
    const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8')
    const areas = css.match(/\.home-tiles \{[^}]*grid-template-areas:([^;]+);/)?.[1] ?? ''
    for (const tile of [...source.matchAll(/\bid="([a-z]+)"/g)].map((match) => match[1]).concat('search', 'update', 'hero', 'map')) {
      expect(areas, tile).toContain(tile === 'heroes' ? 'hero' : tile)
      expect(css, tile).toMatch(new RegExp(`\\.t-${tile === 'heroes' ? 'heroes' : tile}\\b[^{]*\\{[^}]*grid-area`))
    }
  })
})

describe('tierPreview', () => {
  const hero = (id, winrate, games = 1000) => ({ id, name: `Hero ${id}`, released: true, stats: { winrate, pickrate: 3, games_played: games } })
  const heroes = Array.from({ length: 30 }, (_, i) => hero(i + 1, 0.55 - i * 0.003))

  it('takes the first heroes of every tier, S to D', () => {
    const rows = tierPreview(buildTierList(heroes).tiers)
    expect(rows.map((row) => row.tier)).toEqual(['S', 'A', 'B', 'C', 'D'])
    for (const row of rows) expect(row.heroes.length).toBeLessThanOrEqual(HOME_TIER_HEROES)
    expect(rows[0].heroes[0].id).toBe(1) // самый сильный герой — первый в S
  })

  it('returns plain heroes, not tier entries', () => {
    const [first] = tierPreview(buildTierList(heroes).tiers)[0].heroes
    expect(first).toHaveProperty('stats')
    expect(first).not.toHaveProperty('tier')
  })

  it('respects the requested size and skips empty tiers', () => {
    expect(tierPreview(buildTierList(heroes).tiers, 2)[0].heroes).toHaveLength(2)
    expect(tierPreview({ S: [], A: [{ hero: heroes[0] }] })).toEqual([{ tier: 'A', heroes: [heroes[0]] }])
  })

  it('copes with no data at all', () => {
    expect(tierPreview(buildTierList([]).tiers)).toEqual([])
    expect(tierPreview(undefined)).toEqual([])
  })
})

describe('update banner', () => {
  it('shows the art of the update while it is fresh and hides it afterwards', () => {
    expect(bannerArt(CURRENT_UPDATE, Date.UTC(2026, 9, 3))).toBe(CURRENT_UPDATE.art)
    expect(bannerArt(CURRENT_UPDATE, Date.UTC(2027, 0, 5))).toBeNull()
  })

  it('has no banner for an update without art', () => {
    const { art: _art, ...plain } = CURRENT_UPDATE
    expect(bannerArt(plain, Date.UTC(2026, 9, 3))).toBeNull()
  })

  it('points to pictures that are shipped with the site', () => {
    for (const file of Object.values(CURRENT_UPDATE.art)) expect(fs.existsSync(path.join(PUBLIC, file)), file).toBe(true)
  })

  it('dates the update at noon UTC of its day', () => {
    expect(new Date(updateDate() * 1000).toISOString()).toBe('2026-09-29T12:00:00.000Z')
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
