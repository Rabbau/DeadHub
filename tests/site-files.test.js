import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const HOST = 'https://dead-hub.vercel.app'

// vercel.json (переписывания, заголовки, CSP) проверяет tests/vercel-config.test.js: ему нужен разбор конфига
// той же библиотекой, что у Vercel.

describe('fonts', () => {
  const fonts = read('src/fonts.css')
  const pkg = JSON.parse(read('package.json'))

  it('come from the site itself: every @import is a @fontsource package, and the CSS names no other server', () => {
    const imports = [...fonts.matchAll(/@import\s+'([^']+)'/g)].map((match) => match[1])
    expect(imports.length).toBeGreaterThanOrEqual(6)
    for (const source of imports) expect(source, source).toMatch(/^@fontsource\/(ibm-plex-mono|silkscreen|tiny5)\/\d{3}\.css$/)
    expect(fonts.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/https?:|\/\//)
    expect(read('src/index.css')).not.toMatch(/@import\s+(?:url\()?['"]?https?:/)
    for (const name of ['@fontsource/ibm-plex-mono', '@fontsource/silkscreen', '@fontsource/tiny5']) expect(pkg.dependencies, name).toHaveProperty([name])
  })

  it('are loaded before the site styles, with whole weights (they carry unicode-range for every script)', () => {
    const main = read('src/main.jsx')
    expect(main.indexOf("import './fonts.css'")).toBeGreaterThan(-1)
    expect(main.indexOf("import './fonts.css'")).toBeLessThan(main.indexOf("import './index.css'"))
    expect(fonts).not.toMatch(/@fontsource\/[a-z0-9-]+\/(?:latin|cyrillic|greek|vietnamese)[a-z-]*-\d{3}\.css/) // отдельные наборы знаков без unicode-range перекрыли бы друг друга
  })

  it('cover every family and weight the styles use', () => {
    const css = read('src/index.css')
    expect(css).toMatch(/--font-pixel:\s*'Silkscreen',\s*'Tiny5'/)
    expect(css).toMatch(/--font-mono:\s*'IBM Plex Mono'/)
    const weights = new Set([...css.matchAll(/font:\s*(\d{3})\s/g)].map((match) => match[1]))
    for (const weight of weights) expect(['400', '500', '600', '700'], `насыщенность ${weight}`).toContain(weight)
    for (const weight of ['400', '500', '600']) expect(fonts).toContain(`ibm-plex-mono/${weight}.css`)
    for (const weight of ['400', '700']) expect(fonts).toContain(`silkscreen/${weight}.css`)
    expect(fonts).toContain('tiny5/400.css')
  })
})

describe('crawler files', () => {
  // Личные страницы не индексируются: их нет в sitemap, а сама страница отдаёт noindex
  const PRIVATE_ROUTES = ['/me']

  it('sitemap lists the static routes of the app (dynamic ones come from the prerender step)', () => {
    const locs = [...read('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(HOST, '') || '/')
    const app = read('src/App.jsx')
    const routes = [...app.matchAll(/<Route (?:index|path="([^"]*)")/g)]
      .map((m) => (m[1] === undefined ? '/' : `/${m[1].replace(/^\//, '')}`))
      .filter((p) => !p.includes(':') && p !== '/*' && !PRIVATE_ROUTES.includes(p))
    expect([...locs].sort()).toEqual([...new Set(routes)].sort())
    expect(read('public/sitemap.xml').match(new RegExp(HOST.replace(/\./g, '\\.'), 'g'))).toHaveLength(locs.length)
  })

  it('robots.txt allows crawling, points to the sitemap and leaves /api open', () => {
    const robots = read('public/robots.txt')
    expect(robots).toMatch(/Allow: \//)
    expect(robots).toContain(`Sitemap: ${HOST}/sitemap.xml`)
    expect(robots).not.toMatch(/Disallow:\s*\/api/)
  })
})

describe('preview image', () => {
  const png = fs.readFileSync(path.join(ROOT, 'public/og-image.png'))
  const html = read('index.html')

  it('is a 1200×630 PNG small enough for crawlers', () => {
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
    expect(png.length).toBeLessThan(300 * 1024)
  })

  it('is wired into index.html with a large Twitter card', () => {
    expect(html).toContain(`og:image" content="${HOST}/og-image.png"`)
    expect(html).toContain('og:image:width" content="1200"')
    expect(html).toContain('og:image:height" content="630"')
    expect(html).toContain('twitter:card" content="summary_large_image"')
  })
})
