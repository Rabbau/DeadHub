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
    for (const source of imports) expect(source, source).toMatch(/^@fontsource\/(alegreya|oswald|jost)\/\d{3}\.css$/)
    expect(fonts.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/https?:|\/\//)
    expect(read('src/index.css')).not.toMatch(/@import\s+(?:url\()?['"]?https?:/)
    for (const name of ['@fontsource/alegreya', '@fontsource/oswald', '@fontsource/jost']) expect(pkg.dependencies, name).toHaveProperty([name])
  })

  it('are loaded before the site styles, with whole weights (they carry unicode-range for every script)', () => {
    const main = read('src/main.jsx')
    expect(main.indexOf("import './fonts.css'")).toBeGreaterThan(-1)
    expect(main.indexOf("import './fonts.css'")).toBeLessThan(main.indexOf("import './index.css'"))
    expect(fonts).not.toMatch(/@fontsource\/[a-z0-9-]+\/(?:latin|cyrillic|greek|vietnamese)[a-z-]*-\d{3}\.css/) // отдельные наборы знаков без unicode-range перекрыли бы друг друга
  })

  it('cover every family and weight the styles use', () => {
    const css = read('src/index.css')
    expect(css).toMatch(/--font-display:\s*'Alegreya'/)
    expect(css).toMatch(/--font-caps:\s*'Oswald'/)
    expect(css).toMatch(/--font-ui:\s*'Jost'/)
    expect(css).toMatch(/--font-num:\s*'Oswald'/)
    // Какие начертания подключены у каждой переменной (числа — тот же Oswald, что и подписи)
    const loaded = { display: ['900'], caps: ['500', '600', '700'], num: ['500', '600', '700'], ui: ['400', '500', '600', '700'] }
    for (const [pack, weights] of Object.entries({ alegreya: loaded.display, oswald: loaded.caps, jost: loaded.ui })) {
      for (const weight of weights) expect(fonts, `${pack} ${weight}`).toContain(`${pack}/${weight}.css`)
    }
    // Правило без насыщенности (font: 14px var(--font-caps)) — это 400, поэтому проверяется и оно
    const declarations = [...css.matchAll(/font:\s*(?:(\d{3})\s+)?[^;]*?var\(--font-(display|caps|num|ui)\)/g)]
    expect(declarations.length).toBeGreaterThan(100)
    for (const [text, weight = '400', family] of declarations) expect(loaded[family], `${family} ${weight}: ${text}`).toContain(weight)
    // Прежние пиксельные шрифты больше не используются
    expect(css).not.toMatch(/--font-pixel|--font-mono|Silkscreen|Tiny5|IBM Plex/)
  })
})

describe('art', () => {
  const dir = path.join(ROOT, 'public/art')
  const files = fs.readdirSync(dir)
  const walk = (folder) => fs.readdirSync(path.join(ROOT, folder), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${folder}/${entry.name}`
    if (entry.isDirectory()) return walk(relative)
    return /\.(css|jsx?)$/.test(entry.name) ? [relative] : []
  })

  it('every picture the code asks for exists in public/art', () => {
    const referenced = new Set()
    for (const file of walk('src')) for (const [, name] of read(file).matchAll(/\/art\/([\w-]+\.\w+)/g)) referenced.add(name)
    expect(referenced.size).toBeGreaterThan(0)
    for (const name of referenced) expect(files, name).toContain(name)
  })

  it('has no picture that nothing asks for', () => {
    const referenced = new Set()
    for (const file of walk('src')) for (const [, name] of read(file).matchAll(/\/art\/([\w-]+\.\w+)/g)) referenced.add(name)
    expect(files.filter((name) => !referenced.has(name))).toEqual([])
  })

  it('stays light: only WebP, every file under 120 KB, the folder under 900 KB', () => {
    let total = 0
    for (const name of files) {
      expect(name, name).toMatch(/\.webp$/)
      const { size } = fs.statSync(path.join(dir, name))
      expect(size, name).toBeLessThan(120 * 1024)
      total += size
    }
    expect(total).toBeLessThan(900 * 1024)
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
