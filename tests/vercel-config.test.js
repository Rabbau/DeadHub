// vercel.json решает, какие адреса /api уходят в Deadlock API, какие страницы сайта существуют и какие заголовки
// получает каждый ответ. Ошибка здесь ломает прод целиком (страницы отвечают 404, данные не грузятся), а проверить
// её без деплоя нечем — поэтому конфиг прогоняется через ту же библиотеку маршрутов, что использует сама Vercel
// (@vercel/routing-utils), а адреса, которые реально использует код сайта, берутся из его исходников.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getTransformedRoutes } from '@vercel/routing-utils'
import { slimRanks } from '../src/api/ranksApi.js'
import ranksResponse from './fixtures/ranks.json'

const ROOT = path.resolve(import.meta.dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const config = JSON.parse(read('vercel.json'))
const UPSTREAM = 'https://api.deadlock-api.com'

const transformed = getTransformedRoutes(config)
const routes = transformed.routes ?? []

// Что лежит в dist/ после сборки (для проверки «сначала файлы, потом переписывание»)
const FILES = new Set([
  '/index.html', '/404.html', '/favicon.ico', '/favicon.svg', '/robots.txt', '/sitemap.xml', '/og-image.png',
  '/art/city.webp', '/art/title.webp',
  '/assets/index-abc123.js', '/assets/index-abc123.css', '/assets/jost-latin-400-normal-abc123.woff2',
  '/hero/25.html', '/hero/25/index.html', '/items/1.html', '/items/1/index.html',
])
const FUNCTIONS = new Set(['/api/ping'])

const substitute = (text, match) => String(text).replace(/\$(\d+)/g, (_, index) => match[Number(index)] ?? '')

function findFile(pathname) {
  const candidates = pathname === '/' ? ['/index.html'] : [pathname, `${pathname}.html`, `${pathname}/index.html`]
  const file = candidates.find((candidate) => FILES.has(candidate))
  if (file) return { kind: 'static', path: file }
  return FUNCTIONS.has(pathname) ? { kind: 'function', path: pathname } : null
}

/**
 * Что сделает Vercel с запросом: маршруты идут по порядку; заголовки накапливаются (у них continue), потом файлы
 * сборки, потом переписывания; если ничего не подошло — 404. headers: имя (в нижнем регистре) → все выставленные значения.
 */
function resolve(pathname) {
  const headers = {}
  for (const route of routes) {
    if (route.handle === 'filesystem') {
      const file = findFile(pathname)
      if (file) return { kind: file.kind, file: file.path, headers }
      continue
    }
    const match = new RegExp(route.src).exec(pathname)
    if (!match) continue
    if (route.status >= 300 && route.status < 400) return { kind: 'redirect', status: route.status, location: substitute(route.headers.Location, match), headers }
    for (const [name, value] of Object.entries(route.headers ?? {})) (headers[name.toLowerCase()] ??= []).push(substitute(value, match))
    if (route.continue) continue
    if (route.dest) {
      const dest = substitute(route.dest, match)
      if (/^https?:\/\//.test(dest)) return { kind: 'proxy', url: dest, headers }
      const file = findFile(dest)
      if (file) return { kind: 'rewrite', file: file.path, headers }
    }
  }
  return { kind: 'notFound', headers }
}

const last = (values) => values?.[values.length - 1]

describe('vercel.json as Vercel reads it', () => {
  it('is accepted by Vercel’s own validator, without warnings', () => {
    expect(transformed.error ?? null).toBeNull()
    expect(transformed.warnings ?? []).toEqual([])
    expect(routes.length).toBeGreaterThan(10)
  })

  it('serves prerendered pages (hero/<id>.html) at the clean address /hero/<id>', () => {
    expect(config.cleanUrls).toBe(true)
    expect(resolve('/hero/25')).toMatchObject({ kind: 'static', file: '/hero/25.html' })
    expect(resolve('/hero/25.html')).toMatchObject({ kind: 'redirect', status: 308, location: '/hero/25' })
    expect(resolve('/index.html')).toMatchObject({ kind: 'redirect', location: '/' })
    expect(resolve('/')).toMatchObject({ kind: 'static', file: '/index.html' })
  })
})

describe('the /api allowlist', () => {
  /** Адреса, которые код сайта строит для запросов к API: шаблоны из src/api/*.js без строки запроса. */
  function apiTemplates() {
    const found = []
    for (const file of fs.readdirSync(path.join(ROOT, 'src/api')).filter((name) => name.endsWith('.js'))) {
      const text = read(`src/api/${file}`)
      for (const match of text.matchAll(/`\$\{(?:API_BASE|ANALYTICS_API_BASE|ASSETS_API_BASE)\}(\/[^`]*)`/g)) found.push({ file, template: match[1] })
    }
    return found
  }

  /** Часть шаблона до строки запроса («?» вне ${…}). */
  function pathPart(template) {
    let depth = 0
    for (let i = 0; i < template.length; i++) {
      if (template[i] === '$' && template[i + 1] === '{') { depth += 1; i += 1 } else if (template[i] === '}' && depth > 0) depth -= 1
      else if (template[i] === '?' && depth === 0) return template.slice(0, i)
    }
    return template
  }

  // Значения переменных, которые встречаются в ПУТИ запросов. Появилась новая — добавьте пример сюда.
  const SAMPLES = {
    id: ['25'],
    accountId: ['1042703572'],
    matchId: ['109064028'],
    weaponClass: ['weapon_citadel_pistol'],
    class_name: ['citadel_ability_example_1'],
    path: ['Europe', 'Europe/6'],
  }

  function expand(template) {
    let results = [template]
    for (const name of new Set([...template.matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1]))) {
      const values = SAMPLES[name]
      if (!values) throw new Error(`В пути запроса ${template} появилась переменная \${${name}}: добавьте для неё пример в SAMPLES теста`)
      results = results.flatMap((result) => values.map((value) => result.split(`\${${name}}`).join(value)))
    }
    return results
  }

  const used = apiTemplates().flatMap(({ file, template }) => expand(pathPart(template)).map((api) => ({ file, api })))

  it('finds the endpoints the site really uses (the extraction itself must not rot)', () => {
    expect(used.length).toBeGreaterThanOrEqual(30)
    const paths = used.map((entry) => entry.api)
    for (const expected of [
      '/v1/assets/heroes', '/v1/assets/heroes/25', '/v1/assets/items', '/v1/assets/items/by-hero-id/25', '/v1/assets/ranks', '/v1/assets/map', '/v1/assets/misc-entities',
      '/v1/analytics/hero-stats', '/v1/analytics/item-stats', '/v1/analytics/kill-death-stats', '/v1/players/steam', '/v1/players/steam-search',
      '/v1/players/1042703572/match-history', '/v1/players/rank/distribution', '/v1/matches/109064028/metadata', '/v1/leaderboard/Europe/6', '/v2/patches',
      '/v1/players/1042703572/mate-stats', '/v1/players/1042703572/enemy-stats', '/v1/matches/active', '/v1/matches/live/urls',
      '/v1/crosshair/settings/code', '/v1/crosshair/settings/image', '/v1/crosshair/code/settings', '/v1/analytics/player-performance-curve',
    ]) {
      expect(paths, expected).toContain(expected)
    }
  })

  it.each([...new Set(used.map((entry) => entry.api))])('lets %s through to the Deadlock API unchanged', (api) => {
    expect(resolve(`/api${api}`)).toMatchObject({ kind: 'proxy', url: `${UPSTREAM}${api}` })
  })

  it('passes every endpoint of the site to the API, and nothing the site does not use', () => {
    const rewrites = config.rewrites.filter((rewrite) => rewrite.source.startsWith('/api/'))
    expect(rewrites.length).toBeGreaterThan(0)
    for (const rewrite of rewrites) expect(rewrite.destination).toBe(`${UPSTREAM}/$1`)
  })

  it.each([
    '/api', '/api/', '/api/proxy', '/api/anything', '/api/v1', '/api/v1/', '/api/v3/patches', '/api/v2/info', '/api/v1/info',
    '/api/v1/sql', '/api/v1/commands', '/api/v1/matches/active/raw', '/api/v1/matches/active/extra', '/api/v1/matches/live', '/api/v1/matches/live/urls/extra',
    '/api/v1/matches/demo/live/query', '/api/v1/matches/search', '/api/v1/matches/109064028',
    '/api/v1/crosshair', '/api/v1/crosshair/settings', '/api/v1/crosshair/code', '/api/v1/crosshair/code/image', '/api/v1/crosshair/settings/code/extra',
    '/api/v1/players/1042703572/mmr-history', '/api/v1/players/1042703572/mate-stats/extra', '/api/v1/players/abc/enemy-stats',
    '/api/v1/matches/109064028/metadata/extra', '/api/v1/matches/abc/metadata', '/api/v1/players/1042703572/card',
    '/api/v1/players/1042703572', '/api/v1/players/abc/rank', '/api/v1/players/1042703572/rank/extra',
    '/api/v1/analytics', '/api/v1/analytics/hero-stats/extra', '/api/v1/analytics/player-scoreboard', '/api/v1/analytics/player-performance-curve/extra', '/api/v1/analytics/player-stats/metrics', '/api/v1/analytics/sql',
    '/api/v1/assets/heroes/abc', '/api/v1/assets/heroes/25/extra', '/api/v1/assets/items/a-b', '/api/v1/assets/items/a/b', '/api/v1/assets/sounds',
    '/api/v1/leaderboard', '/api/v1/leaderboard/Mars', '/api/v1/leaderboard/Europe/abc', '/api/v1/leaderboard/Europe/6/7',
    '/api/v1/leaderboard/europe', '/api/v2/patches/extra', '/api/v1/patches', '/api//v1/assets/heroes', '/api/v1//assets/heroes',
    '/api/v1/assets/heroes%2F..%2Fsql', '/api/v1/assets/items/%2e%2e', '/api/V1/assets/heroes', '/apis/v1/assets/heroes',
  ])('does not forward %s: it is not an endpoint of the site', (pathname) => {
    expect(resolve(pathname).kind, pathname).not.toBe('proxy')
    expect(resolve(pathname).kind, pathname).toBe('notFound')
  })

  it('keeps the static function next to it: /api/ping answers, it is not proxied', () => {
    expect(resolve('/api/ping')).toMatchObject({ kind: 'function' })
  })

  it('cannot be tricked into another upstream path: every captured path starts with /v1/ or /v2/ and has no dots', () => {
    for (const { api } of used) {
      const result = resolve(`/api${api}`)
      expect(new URL(result.url).pathname).toMatch(/^\/v[12]\/[A-Za-z0-9_/-]+$/)
      expect(result.url.startsWith(`${UPSTREAM}/v`)).toBe(true)
    }
  })
})

describe('the pages of the site', () => {
  /** Маршруты из App.jsx → примеры адресов. */
  function appPaths() {
    const app = read('src/App.jsx')
    const paths = []
    for (const match of app.matchAll(/<Route (?:index|path="([^"]*)")/g)) {
      if (match[1] === '*') continue
      // index и корневой маршрут-обёртка (path="/") — это главная страница
      paths.push(match[1] === undefined || match[1] === '/' ? '/' : `/${match[1].replace(/:[A-Za-z]+/g, '123')}`)
    }
    return [...new Set(paths)]
  }

  const pages = appPaths()

  it('knows the routes of the app (the extraction must not rot)', () => {
    expect(pages.length).toBeGreaterThanOrEqual(24)
    for (const expected of ['/', '/heroes', '/meta', '/items', '/items/123', '/hero/123', '/player/123', '/match/123', '/draft', '/map', '/me', '/live', '/crosshair', '/calculator', '/versus', '/favorites']) expect(pages).toContain(expected)
  })

  it.each(pages)('opens %s with the app (a new route in App.jsx must be added to vercel.json too)', (pathname) => {
    const result = resolve(pathname)
    expect(['static', 'rewrite'], `${pathname} → ${result.kind}`).toContain(result.kind)
    expect(result.file).toBe('/index.html')
  })

  it('also opens them with a trailing slash', () => {
    for (const pathname of ['/heroes/', '/meta/', '/matchups/', '/items/', '/hero/123/', '/match/109064028/', '/player/1042703572/', '/live/', '/crosshair/', '/calculator/', '/versus/', '/favorites/']) {
      expect(resolve(pathname), pathname).toMatchObject({ kind: 'rewrite', file: '/index.html' })
    }
  })

  it('answers an address that is not a page with a real 404 instead of the app', () => {
    for (const pathname of [
      '/nonexistent', '/nonexistent/page', '/heroes/extra', '/Heroes', '/hero', '/hero/', '/hero/abc', '/hero/12/34', '/hero/-1', '/items/abc', '/items/12/extra', '/meta/extra',
      '/player', '/player/abc', '/match', '/match/abc', '/wp-admin', '/wp-login.php', '/.env', '/.git/config', '/admin', '/api/v1', '/404x',
      '/live/extra', '/crosshair/extra', '/calculator/x', '/versus/1', '/favorites/x', '/Live', '/Crosshair',
      '/Meta', '/hero/1234567890123', '/static/x.js', '/assets', '/assets/missing.js',
    ]) {
      expect(resolve(pathname).kind, pathname).toBe('notFound')
    }
    // «Чистые адреса» Vercel: /index — это та же главная, а не отдельная страница
    expect(resolve('/index')).toMatchObject({ kind: 'redirect', location: '/' })
  })

  it('serves a file that exists before it considers a rewrite: a prerendered hero is the file, a new one the app', () => {
    expect(resolve('/hero/25')).toMatchObject({ kind: 'static', file: '/hero/25.html' })
    expect(resolve('/hero/26')).toMatchObject({ kind: 'rewrite', file: '/index.html' })
    expect(resolve('/items/1')).toMatchObject({ kind: 'static', file: '/items/1.html' })
    expect(resolve('/items/2')).toMatchObject({ kind: 'rewrite', file: '/index.html' })
  })

  it('leaves the static files alone', () => {
    for (const file of ['/favicon.ico', '/robots.txt', '/sitemap.xml', '/og-image.png', '/assets/index-abc123.js', '/404.html']) {
      expect(resolve(file), file).toMatchObject({ kind: file === '/404.html' ? 'redirect' : 'static' })
    }
  })
})

describe('headers', () => {
  const SECURITY = [
    'content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy',
  ]
  const everywhere = ['/', '/heroes', '/meta', '/hero/25', '/hero/26', '/match/109064028', '/live', '/crosshair', '/assets/index-abc123.js', '/favicon.ico', '/api/v1/assets/heroes', '/api/v1/matches/109064028/metadata', '/api/v1/crosshair/settings/image', '/api/ping', '/definitely-missing', '/api/v1/sql']

  it.each(everywhere)('puts the security headers on %s, once each', (pathname) => {
    const { headers } = resolve(pathname)
    for (const name of SECURITY) expect(headers[name], `${name} на ${pathname}`).toHaveLength(1)
    expect(last(headers['x-content-type-options'])).toBe('nosniff')
    expect(last(headers['x-frame-options'])).toBe('DENY')
    expect(last(headers['referrer-policy'])).toBe('strict-origin-when-cross-origin')
    expect(last(headers['cross-origin-opener-policy'])).toBe('same-origin')
    expect(last(headers['permissions-policy'])).toMatch(/camera=\(\)/)
  })

  describe('Content-Security-Policy', () => {
    const value = last(resolve('/').headers['content-security-policy'])
    const policy = Object.fromEntries(
      value.split(';').map((part) => part.trim()).filter(Boolean).map((directive) => {
        const [name, ...sources] = directive.split(/\s+/)
        return [name, sources]
      }),
    )

    it('allows scripts, styles, frames and plugins from nowhere but the site itself', () => {
      expect(policy['default-src']).toEqual(["'self'"])
      expect(policy['script-src']).toEqual(["'self'"])
      expect(policy['style-src']).toEqual(["'self'"])
      // Атрибуты style (не элементы <style> и не таблицы стилей) разрешены: браузер сообщает о нарушении всякий раз, когда разбирает
      // HTML с style="color: …" — а так разбираются описания способностей, — хотя разбор идёт в отдельном документе, где ничего не рисуется.
      // Цвет затем ставится через CSSOM (React), а скрипты по-прежнему только свои
      expect(policy['style-src-attr']).toEqual(["'unsafe-inline'"])
      expect(policy['connect-src']).toEqual(["'self'"])
      expect(policy['object-src']).toEqual(["'none'"])
      expect(policy['frame-ancestors']).toEqual(["'none'"])
      expect(policy['base-uri']).toEqual(["'self'"])
      expect(policy['form-action']).toEqual(["'self'"])
      expect(policy).toHaveProperty('upgrade-insecure-requests')
    })

    it('has nothing that switches the protection off', () => {
      expect(value).not.toMatch(/unsafe-eval|unsafe-hashes|wasm-unsafe-eval|strict-dynamic/)
      // «unsafe-inline» — только у атрибутов style, ни у скриптов, ни у таблиц стилей, ни у значения по умолчанию
      for (const [name, sources] of Object.entries(policy)) {
        if (name !== 'style-src-attr') expect(sources, name).not.toContain("'unsafe-inline'")
      }
      for (const [name, sources] of Object.entries(policy)) {
        expect(sources, name).not.toContain('*')
        expect(sources, name).not.toContain('https:')
        expect(sources, name).not.toContain('http:')
        expect(sources.some((source) => source.startsWith('http://')), name).toBe(false)
      }
    })

    it('lets pictures come only from the site, data: URIs, the API (its storage and its rank badges) and Steam’s CDN', () => {
      expect(policy['img-src']).toEqual(["'self'", 'data:', 'https://assets-bucket.deadlock-api.com', 'https://api.deadlock-api.com', 'https://*.steamstatic.com'])
      expect(policy['font-src']).toEqual(["'self'"]) // шрифты — файлы сайта, не вшитые в CSS (vite.config.js)
    })

    const hostAllowed = (host, sources) => sources.some((source) => {
      const match = /^https:\/\/(\*\.)?([a-z0-9.-]+)$/.exec(source)
      if (!match) return false
      return match[1] ? host.endsWith(`.${match[2]}`) : host === match[2]
    })

    it('covers the pictures that come from the API’s data, not only those named in the code: the rank badges', () => {
      // Значки подрангов API отдаёт адресом api.deadlock-api.com/v1/assets/ranks/<ранг>/<подранг>/image, а не из
      // хранилища ассетов; в коде этого адреса нет, и без этой проверки CSP молча сломал бы значки рангов
      const urls = slimRanks(ranksResponse).flatMap((rank) => [rank.large, ...Object.values(rank.sub)])
      expect(urls.filter(Boolean).length).toBeGreaterThanOrEqual(14)
      for (const url of urls.filter(Boolean)) {
        expect(url, url).toMatch(/^https:\/\//)
        expect(hostAllowed(new URL(url).host, policy['img-src']), url).toBe(true)
      }
    })

    it('covers every image host the site can show', () => {
      // Хосты из исходников: либо картинки (их разрешает CSP), либо только ссылки/строки, которые страница не загружает
      const LINK_ONLY = new Set(['deadlock-api.com', 'www.playdeadlock.com', 'store.steampowered.com', 'steamcommunity.com', 'dead-hub.vercel.app', 'www.w3.org'])
      const sourceFiles = []
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (/\.jsx?$/.test(entry.name)) sourceFiles.push(full)
        }
      }
      walk(path.join(ROOT, 'src'))
      const hosts = new Set()
      for (const file of sourceFiles) for (const match of fs.readFileSync(file, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) hosts.add(match[1].toLowerCase())
      const uncovered = [...hosts].filter((host) => !LINK_ONLY.has(host) && !hostAllowed(host, policy['img-src']))
      expect(uncovered, 'новый внешний адрес в коде: разрешите его в CSP (если это картинка) или добавьте в LINK_ONLY (если это только ссылка)').toEqual([])
    })

    it('matches the pages: no external or inline scripts and styles, no third-party fonts', () => {
      const html = read('index.html')
      expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/i) // инлайновых скриптов нет
      expect(html).not.toMatch(/<style/i)
      expect(html).not.toMatch(/\s(?:on[a-z]+|style)\s*=/i)
      for (const tag of html.matchAll(/<(?:script|link|img|iframe)\b[^>]*>/gi)) {
        const url = /(?:src|href)="([^"]+)"/i.exec(tag[0])?.[1]
        if (url) expect(url, tag[0]).not.toMatch(/^(?:https?:)?\/\//)
      }
      expect(html).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/)
    })
  })

  describe('CORS of the API', () => {
    // Сайт ходит в /api со своего адреса, CORS ему не нужен. Апстрим отдаёт «*», и без этого правила любой чужой сайт
    // мог бы читать наш /api из браузера своих посетителей — то есть пользоваться нами как бесплатным прокси
    const SITE = 'https://dead-hub.vercel.app'

    it.each(['/api/v1/assets/heroes', '/api/v1/matches/109064028/metadata', '/api/v2/patches', '/api/v1/leaderboard/Europe/6'])('allows only the site itself to read %s from a browser', (pathname) => {
      const values = resolve(pathname).headers['access-control-allow-origin']
      expect(values, pathname).toHaveLength(1)
      expect(values[0]).toBe(SITE)
    })

    it('is the site’s real address (the one in the canonical and og:url tags)', () => {
      expect(read('src/services/siteMeta.js')).toContain(`'${SITE}'`)
    })

    it('does not touch pages and files', () => {
      for (const pathname of ['/', '/hero/25', '/assets/index-abc123.js']) expect(resolve(pathname).headers['access-control-allow-origin'], pathname).toBeUndefined()
    })
  })

  describe('Cache-Control of the API', () => {
    const allowed = apiPaths()

    function apiPaths() {
      return [
        '/api/v1/assets/heroes', '/api/v1/assets/items', '/api/v1/analytics/hero-stats', '/api/v1/players/steam', '/api/v1/players/1042703572/match-history',
        '/api/v1/players/1042703572/mate-stats', '/api/v1/players/1042703572/enemy-stats', '/api/v1/analytics/player-performance-curve',
        '/api/v1/leaderboard/Europe', '/api/v1/leaderboard/Europe/6', '/api/v2/patches', '/api/v1/matches/109064028/metadata',
        '/api/v1/matches/active', '/api/v1/matches/live/urls', '/api/v1/crosshair/settings/code', '/api/v1/crosshair/settings/image', '/api/v1/crosshair/code/settings',
      ]
    }

    // Что отвечает на остальное — отдельным правилам: матч неизменен, «сейчас» живёт минуту, прицел зависит только от запроса
    const LIVE = ['/api/v1/matches/active', '/api/v1/matches/live/urls']
    const CROSSHAIR = ['/api/v1/crosshair/settings/code', '/api/v1/crosshair/settings/image', '/api/v1/crosshair/code/settings']

    it.each(allowed)('sets exactly one rule for %s (so that no rule can override another)', (pathname) => {
      expect(resolve(pathname).headers['cache-control'], pathname).toHaveLength(1)
    })

    it('keeps a match for a week on the edge: its result never changes', () => {
      const value = last(resolve('/api/v1/matches/109064028/metadata').headers['cache-control'])
      expect(value).toMatch(/s-maxage=604800/)
      expect(value).toMatch(/^public,/)
      // В браузере — недолго: в этом заголовке придёт и ответ-ошибка, а её нельзя запоминать надолго
      expect(Number(/max-age=(\d+)/.exec(value)[1])).toBeLessThanOrEqual(3600)
    })

    it('keeps every other answer for ten minutes, as before', () => {
      for (const pathname of allowed.filter((p) => !p.includes('/matches/') && !CROSSHAIR.includes(p))) {
        expect(last(resolve(pathname).headers['cache-control']), pathname).toBe('public, max-age=300, s-maxage=600, stale-while-revalidate=3600')
      }
    })

    it('keeps the live matches for a minute only: they change all the time and the API itself refreshes them every two', () => {
      for (const pathname of LIVE) {
        const value = last(resolve(pathname).headers['cache-control'])
        expect(value, pathname).toBe('public, max-age=60, s-maxage=60, stale-while-revalidate=60')
        expect(Number(/s-maxage=(\d+)/.exec(value)[1])).toBeLessThanOrEqual(120)
      }
    })

    it('keeps a crosshair for a day on the edge: the answer depends only on the request', () => {
      for (const pathname of CROSSHAIR) {
        const value = last(resolve(pathname).headers['cache-control'])
        expect(value, pathname).toMatch(/s-maxage=86400/)
        expect(value).toMatch(/^public,/)
        // В браузере — недолго: в этом заголовке придёт и ответ-ошибка (400 на неверный код), а её нельзя запоминать надолго
        expect(Number(/max-age=(\d+)/.exec(value)[1])).toBeLessThanOrEqual(3600)
      }
    })

    it('does not touch the cache headers of pages and files', () => {
      for (const pathname of ['/', '/meta', '/hero/25', '/assets/index-abc123.js', '/api/ping', '/favicon.ico']) {
        expect(resolve(pathname).headers['cache-control'], pathname).toBeUndefined()
      }
    })
  })

  describe('Cache-Control of the art', () => {
    // Картинки из public/art лежат без хеша в имени, поэтому кеш у них короткий: сутки свежим и неделя «устаревшим»
    // (браузер показывает старую копию и обновляет её в фоне). Замена картинки доходит до посетителей не позже чем за сутки.
    it.each(['/art/city.webp', '/art/title.webp'])('keeps %s for a day, as a file (not as the app)', (pathname) => {
      const result = resolve(pathname)
      expect(result).toMatchObject({ kind: 'static', file: pathname })
      expect(result.headers['cache-control']).toEqual(['public, max-age=86400, stale-while-revalidate=604800'])
    })

    it('does not leak into the pages next to it', () => {
      expect(resolve('/artist').headers['cache-control']).toBeUndefined()
    })
  })
})
