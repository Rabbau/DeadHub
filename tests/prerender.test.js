import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildSitemap,
  clip,
  escapeHtml,
  heroPages,
  itemPages,
  renderNotFound,
  renderPage,
  staticPathsFrom,
  stripHtml,
} from '../scripts/prerender-lib.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
const sitemap = fs.readFileSync(path.join(ROOT, 'public/sitemap.xml'), 'utf8')

const hero = (over) => ({ id: 1, name: 'Abrams', hero_type: 'brawler', player_selectable: true, description: 'A <b>tough</b> fighter.', ...over })
const item = (over) => ({ id: 10, name: 'Extra Spirit', type: 'upgrade', cost: 800, shop_image: 'x.png', shopable: true, disabled: false, item_slot_type: 'spirit', description: { desc: 'Gives <span>+10</span> spirit.' }, ...over })

describe('text helpers', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('Mo & Krill <b>"x"</b>')).toBe('Mo &amp; Krill &lt;b&gt;&quot;x&quot;&lt;/b&gt;')
    expect(escapeHtml(null)).toBe('')
  })

  it('strips tags, decodes entities and collapses whitespace', () => {
    expect(stripHtml('Gives <span class="x">+10</span><br/>spirit &amp; more&nbsp;now')).toBe('Gives +10 spirit & more now')
    expect(stripHtml(undefined)).toBe('')
  })

  it('clips on a word boundary with an ellipsis', () => {
    expect(clip('short text', 50)).toBe('short text')
    const clipped = clip('alpha beta gamma delta epsilon', 14)
    expect(clipped.endsWith('…')).toBe(true)
    expect(clipped.length).toBeLessThanOrEqual(15)
    expect(clipped).not.toMatch(/\s…$/)
  })
})

describe('heroPages', () => {
  it('describes a hero with the same strings as the client', () => {
    const [page] = heroPages([hero()])
    expect(page).toMatchObject({
      path: '/hero/1',
      title: 'Abrams — hero stats, builds and matchups',
      heading: 'Abrams',
      text: 'Brawler — A tough fighter.',
    })
    expect(page.description).toContain('Abrams')
  })

  it('uses the «coming soon» texts for heroes that are not in the game yet', () => {
    const [page] = heroPages([hero({ id: 2, name: 'Baba', player_selectable: false, prerelease_only: true })])
    expect(page.path).toBe('/hero/2')
    expect(page.title).not.toBe('Baba — hero stats, builds and matchups')
    expect(page.description).toContain('Baba')
  })

  it('skips disabled, in-development and unselectable heroes, nameless rows and garbage', () => {
    const pages = heroPages([
      hero({ id: 3, disabled: true }),
      hero({ id: 4, in_development: true }),
      hero({ id: 5, player_selectable: false }),
      hero({ id: 6, name: '' }),
      null,
      hero({ id: 7 }),
    ])
    expect(pages.map((p) => p.path)).toEqual(['/hero/7'])
    expect(heroPages(null)).toEqual([])
  })

  it('accepts the lore as an object and sorts ids numerically', () => {
    const pages = heroPages([hero({ id: 12, description: { lore: 'Old lore' } }), hero({ id: 2, name: 'B' })])
    expect(pages.map((p) => p.path)).toEqual(['/hero/2', '/hero/12'])
    expect(pages[1].text).toBe('Brawler — Old lore')
  })

  it('takes only numeric ids: the id becomes a file path (dist/hero/<id>.html) and must not leave dist/', () => {
    const pages = heroPages([
      hero({ id: '../../etc/passwd' }), hero({ id: '12/../../x' }), hero({ id: '1 2' }), hero({ id: -1 }), hero({ id: 1.5 }),
      hero({ id: '' }), hero({ id: '1234567890123' }), hero({ id: undefined, hero_id: '../x' }), hero({ id: '7' }), hero({ id: undefined, hero_id: 8 }),
    ])
    expect(pages.map((p) => p.path)).toEqual(['/hero/7', '/hero/8'])
  })
})

describe('itemPages', () => {
  it('keeps only upgrades that are sold in the shop', () => {
    const pages = itemPages([
      item(),
      item({ id: 11, type: 'ability' }),
      item({ id: 12, disabled: true }),
      item({ id: 13, shopable: false }),
      item({ id: 14, name: 'upgrade_internal' }),
      item({ id: 15, shop_image: '' }),
    ])
    expect(pages.map((p) => p.path)).toEqual(['/items/10'])
    expect(pages[0]).toMatchObject({ title: 'Extra Spirit — item stats', heading: 'Extra Spirit', text: 'Spirit — 800 souls — Gives +10 spirit.' })
  })

  it('takes only numeric ids, like heroes', () => {
    const pages = itemPages([item({ id: '../../x' }), item({ id: '10/../11' }), item({ id: -3 }), item({ id: null }), item({ id: 21 }), item({ id: '22' })])
    expect(pages.map((p) => p.path)).toEqual(['/items/21', '/items/22'])
  })
})

describe('renderNotFound', () => {
  const html = renderNotFound(template)

  it('is the app shell with its own title, a ban on indexing and a text for readers without JavaScript', () => {
    expect(html).toContain('<title>Page not found — Dead Hub</title>')
    expect(html).toContain('<meta name="robots" content="noindex" />')
    expect(html).toMatch(/<noscript>[\s\S]*<h1>Page not found<\/h1>[\s\S]*<a href="\/">Dead Hub<\/a>[\s\S]*<\/noscript>\s*<div id="root">/)
    expect(html).toContain('<script type="module" src="/src/main.jsx"></script>')
    expect(html).toContain('<div id="root"></div>')
  })

  it('does not claim a canonical address: an unknown address has none', () => {
    expect(html).not.toContain('rel="canonical"')
    expect(html).toContain('<meta name="description" content="This page does not exist." />')
    expect(html).toContain('<meta property="og:title" content="Page not found — Dead Hub" />')
  })

  it('refuses a template that lost a tag, like the other pages do', () => {
    expect(() => renderNotFound(template.replace(/<title>[^<]*<\/title>/, ''))).toThrow(/title/)
    expect(() => renderNotFound(template.replace(/<meta name="description"[^>]*>/, ''))).toThrow(/description/)
    expect(() => renderNotFound(template.replace('<div id="root"></div>', ''))).toThrow(/root/)
    expect(() => renderNotFound(template.replace('</head>', ''))).toThrow(/head/)
  })
})

describe('renderPage', () => {
  const page = { path: '/hero/1', title: 'Abrams — hero stats, builds and matchups', description: 'Deadlock hero Abrams: "stats" & more.', heading: 'Abrams', text: 'Brawler — fighter' }
  const html = renderPage(template, page)

  it('gives the page its own title, description and preview tags', () => {
    expect(html).toContain('<title>Abrams — hero stats, builds and matchups — Dead Hub</title>')
    expect(html).toContain('<meta name="description" content="Deadlock hero Abrams: &quot;stats&quot; &amp; more." />')
    expect(html).toContain('<meta property="og:title" content="Abrams — hero stats, builds and matchups — Dead Hub" />')
    expect(html).toContain('<meta property="og:url" content="https://dead-hub.vercel.app/hero/1" />')
    expect(html).toContain('<meta name="twitter:title" content="Abrams — hero stats, builds and matchups — Dead Hub" />')
    expect(html).toContain('<link rel="canonical" href="https://dead-hub.vercel.app/hero/1" />')
  })

  it('keeps the preview image and the app bootstrap untouched', () => {
    expect(html).toContain('og:image" content="https://dead-hub.vercel.app/og-image.png"')
    expect(html).toContain('<script type="module" src="/src/main.jsx"></script>')
    expect(html).toContain('<div id="root"></div>')
  })

  it('adds a text for readers without JavaScript before the root', () => {
    expect(html).toMatch(/<noscript>[\s\S]*<h1>Abrams<\/h1>[\s\S]*<p>Brawler — fighter<\/p>[\s\S]*<\/noscript>\s*<div id="root">/)
  })

  it('escapes names so a hero called <script> cannot inject markup', () => {
    const evil = renderPage(template, { ...page, heading: '<script>alert(1)</script>', title: '<b>x</b>' })
    expect(evil).not.toContain('<script>alert(1)</script>')
    expect(evil).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('refuses a template that lost a tag instead of silently shipping wrong previews', () => {
    expect(() => renderPage(template.replace(/<meta property="og:title"[^>]*>/, ''), page)).toThrow(/og:title/)
    expect(() => renderPage(template.replace('<div id="root"></div>', ''), page)).toThrow(/root/)
    expect(() => renderPage(template.replace('</head>', ''), page)).toThrow(/head/)
  })
})

describe('sitemap', () => {
  it('reads the static paths of the existing sitemap', () => {
    const paths = staticPathsFrom(sitemap)
    expect(paths[0]).toBe('/')
    expect(paths).toContain('/meta')
    expect(paths.every((p) => p.startsWith('/'))).toBe(true)
    expect(staticPathsFrom(undefined)).toEqual([])
  })

  it('adds the prerendered pages without duplicates', () => {
    const xml = buildSitemap(['/', '/meta'], ['/hero/1', '/hero/1', '/items/10'])
    expect(xml).toContain('<loc>https://dead-hub.vercel.app/</loc>')
    expect(xml).toContain('<loc>https://dead-hub.vercel.app/hero/1</loc>')
    expect(xml.match(/\/hero\/1</g)).toHaveLength(1)
    expect(xml.startsWith('<?xml')).toBe(true)
    // и читается обратно теми же функциями
    expect(staticPathsFrom(xml)).toEqual(['/', '/meta', '/hero/1', '/items/10'])
  })
})
