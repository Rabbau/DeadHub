import { describe, expect, it } from 'vitest'
import {
  SVG_TAGS,
  TOOLTIP_DROP_TAGS,
  TOOLTIP_TAGS,
  safeClassName,
  safeHref,
  safeImageSrc,
  safeSvgProps,
  safeTextColor,
  safeTooltipImageSrc,
} from '../src/services/sanitize.js'

describe('safeHref', () => {
  it('lets https links through and resolves relative ones against the Steam store', () => {
    expect(safeHref('https://store.steampowered.com/app/1422450')).toBe('https://store.steampowered.com/app/1422450')
    expect(safeHref('/news/app/1422450')).toBe('https://store.steampowered.com/news/app/1422450')
    expect(safeHref('  https://example.com/a b  ')).toBe('https://example.com/a%20b')
  })

  it('rejects every non-https scheme, however it is spelled', () => {
    for (const bad of [
      'javascript:alert(1)', 'JaVaScRiPt:alert(1)', '  \tjavascript:alert(1)', 'java\nscript:alert(1)', 'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'file:///etc/passwd',
      'blob:https://example.com/x', 'steam://run/1422450', 'http://steamcommunity.com/x', 'ftp://example.com/x',
    ]) {
      expect(safeHref(bad), bad).toBeNull()
    }
  })

  it('does not mistake an undecoded entity for a scheme: it is just a relative path on the store', () => {
    // В разобранном HTML сущности уже раскрыты (getAttribute вернёт javascript:…), поэтому сюда это попадает как путь
    expect(safeHref('&#106;avascript:alert(1)')).toMatch(/^https:\/\/store\.steampowered\.com\//)
  })

  it('rejects links that carry a login and password: the host can be faked with “@”', () => {
    expect(safeHref('https://steamcommunity.com@evil.example/')).toBeNull()
    expect(safeHref('https://user:pass@example.com/')).toBeNull()
    expect(safeHref('https://:pass@example.com/')).toBeNull()
  })

  it('resolves a backslash as a slash, like browsers do, so it cannot hide another host', () => {
    // WHATWG-разбор: «\@» после имени хоста — уже путь, а не логин; хост остаётся steamcommunity.com
    expect(safeHref('https://steamcommunity.com\\@evil.example/')).toBe('https://steamcommunity.com/@evil.example/')
  })

  it('goes straight to the target of a Steam linkfilter page, but only a safe one', () => {
    expect(safeHref('https://steamcommunity.com/linkfilter/?u=https%3A%2F%2Fexample.com%2Fx')).toBe('https://example.com/x')
    expect(safeHref('https://steamcommunity.com/linkfilter/?u=javascript:alert(1)')).toBeNull()
    expect(safeHref('https://steamcommunity.com/linkfilter/?u=https%3A%2F%2Fuser%3Apass%40example.com%2F')).toBeNull()
    expect(safeHref('https://steamcommunity.com/linkfilter/')).toBeNull()
    // цепочка из вложенных linkfilter не должна раскручиваться бесконечно
    const nested = 'https://steamcommunity.com/linkfilter/?u=' + encodeURIComponent('https://steamcommunity.com/linkfilter/?u=' + encodeURIComponent('https://steamcommunity.com/linkfilter/?u=' + encodeURIComponent('https://steamcommunity.com/linkfilter/?u=https://x.example')))
    expect(safeHref(nested)).toBeNull()
  })

  it('treats anything that is not a non-empty string as no link', () => {
    for (const bad of [undefined, null, '', '   ', 42, {}, ['https://example.com']]) expect(safeHref(bad)).toBeNull()
  })
})

describe('safeImageSrc (Steam news)', () => {
  it('accepts https images on Steam’s CDN only', () => {
    expect(safeImageSrc('https://clan.cloudflare.steamstatic.com/images/a.png')).toBe('https://clan.cloudflare.steamstatic.com/images/a.png')
    expect(safeImageSrc('https://steamstatic.com/a.png')).toBe('https://steamstatic.com/a.png')
  })

  it('rejects look-alike hosts, other schemes and credentials', () => {
    for (const bad of [
      'https://evilsteamstatic.com/a.png', 'https://steamstatic.com.evil.example/a.png', 'https://x.steamstatic.com@evil.example/a.png',
      'https://user:pass@cdn.steamstatic.com/a.png', 'http://cdn.steamstatic.com/a.png', 'javascript:alert(1)',
      'data:image/svg+xml,<svg onload=alert(1)>', '//cdn.steamstatic.com/a.png', '/images/a.png', '',
    ]) {
      expect(safeImageSrc(bad), bad).toBeNull()
    }
    expect(safeImageSrc(undefined)).toBeNull()
  })
})

describe('safeTooltipImageSrc (icons inside ability descriptions)', () => {
  const real = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/upgrades/property_slow_large.png'

  it('accepts the real icon addresses from the API', () => {
    expect(safeTooltipImageSrc(real)).toBe(real)
    expect(safeTooltipImageSrc(`  ${real}  `)).toBe(real)
    expect(safeTooltipImageSrc('https://assets-bucket.deadlock-api.com/assets-api-res/images/hud/modifiers/immobilize.png')).not.toBeNull()
  })

  it('rejects every other host, path and scheme (an arbitrary picture would let a third party track visitors)', () => {
    for (const bad of [
      'https://evil.example/assets-api-res/images/a.png',
      'https://assets-bucket.deadlock-api.com.evil.example/assets-api-res/images/a.png',
      'https://evil.example/https://assets-bucket.deadlock-api.com/assets-api-res/images/a.png',
      'https://deadlock-api.com/assets-api-res/images/a.png',
      'https://assets-bucket.deadlock-api.com/other/a.png',
      'https://assets-bucket.deadlock-api.com/assets-api-res/imagesX/a.png',
      'http://assets-bucket.deadlock-api.com/assets-api-res/images/a.png',
      'https://user:pass@assets-bucket.deadlock-api.com/assets-api-res/images/a.png',
      '//assets-bucket.deadlock-api.com/assets-api-res/images/a.png',
      'javascript:alert(1)', 'data:image/png;base64,AAAA', '/assets-api-res/images/a.png', '',
    ]) {
      expect(safeTooltipImageSrc(bad), bad).toBeNull()
    }
    for (const bad of [undefined, null, 5, {}]) expect(safeTooltipImageSrc(bad)).toBeNull()
  })

  it('does not let a path trick leave the images folder', () => {
    // «..» разворачивается самим разбором адреса: итоговый путь уже не под /assets-api-res/images/
    expect(safeTooltipImageSrc('https://assets-bucket.deadlock-api.com/assets-api-res/images/../../x.png')).toBeNull()
  })
})

describe('safeClassName', () => {
  it('keeps the classes the game uses, together with the attribute name after them', () => {
    expect(safeClassName('highlight')).toBe('highlight')
    expect(safeClassName('diminish')).toBe('diminish')
    expect(safeClassName('highlight_spirit')).toBe('highlight_spirit')
    expect(safeClassName('inline-attribute-label SpiritDamage')).toBe('inline-attribute-label SpiritDamage')
    expect(safeClassName('inline-attribute Slow')).toBe('inline-attribute Slow')
    expect(safeClassName('AbilityPropertyIcon prop_tech_damage')).toBe('AbilityPropertyIcon prop_tech_damage')
    expect(safeClassName('InlineAttributeIcon Pulling')).toBe('InlineAttributeIcon Pulling')
  })

  it('drops classes of the site itself: they could switch on its CSS (overlays, hidden buttons, layout)', () => {
    for (const bad of ['search-overlay', 'nav__drawer', 'btn btn-primary', 'modal', 'sr-only', 'hero-card', 'page']) {
      expect(safeClassName(bad), bad).toBeNull()
    }
    expect(safeClassName('highlight search-overlay nav__drawer')).toBe('highlight')
  })

  it('does not trust an attribute name without a known class beside it', () => {
    expect(safeClassName('Slow')).toBeNull()
    expect(safeClassName('prop_slow')).toBeNull()
  })

  it('ignores tokens that could close the attribute or add one', () => {
    expect(safeClassName('highlight" onmouseover="alert(1)')).toBe(null)
    expect(safeClassName('highlight "onmouseover=alert(1)')).toBe('highlight')
    expect(safeClassName('inline-attribute-label Spirit-Damage')).toBe('inline-attribute-label')
    expect(safeClassName('inline-attribute-label <script>')).toBe('inline-attribute-label')
  })

  it('looks at a handful of tokens at most, and only at strings', () => {
    expect(safeClassName(`${'highlight '.repeat(50)}`)).toBe('highlight highlight highlight highlight highlight highlight')
    for (const bad of [undefined, null, '', '   ', 7, ['highlight']]) expect(safeClassName(bad)).toBeNull()
  })
})

describe('safeTextColor', () => {
  it('accepts the single color declaration the data uses', () => {
    expect(safeTextColor('color: #0F9;')).toBe('#0F9')
    expect(safeTextColor('color:#FFEFD7')).toBe('#FFEFD7')
    expect(safeTextColor('color: white;')).toBe('white')
    expect(safeTextColor('COLOR : #EC9719 ;')).toBe('#EC9719')
  })

  it('drops the whole style when anything else is in it', () => {
    for (const bad of [
      'color: red; position: fixed', 'position: fixed; inset: 0', 'background: url(javascript:alert(1))', 'color: url(javascript:alert(1))',
      'color: expression(alert(1))', 'color: rgb(1, 2, 3)', 'color: #12;background:red', 'color: var(--x)', 'font-size: 9999px', 'color:',
      'color: red !important', '', ';',
    ]) {
      expect(safeTextColor(bad), bad).toBeNull()
    }
    for (const bad of [undefined, null, 5, {}]) expect(safeTextColor(bad)).toBeNull()
  })
})

describe('safeSvgProps', () => {
  it('turns the attributes of a real icon into React props', () => {
    expect(safeSvgProps({ width: '128', height: '128', viewBox: '0 0 128 128', fill: '#FFEFD7', xmlns: 'http://www.w3.org/2000/svg' }))
      .toEqual({ width: '128', height: '128', viewBox: '0 0 128 128', fill: '#FFEFD7' })
    expect(safeSvgProps({ d: 'M9.5 108.2L46.7 108V93.5C46 90 20 88 15 87Z', fill: 'white', 'fill-rule': 'evenodd', 'clip-rule': 'evenodd', 'fill-opacity': '0.5' }))
      .toEqual({ d: 'M9.5 108.2L46.7 108V93.5C46 90 20 88 15 87Z', fill: 'white', fillRule: 'evenodd', clipRule: 'evenodd', fillOpacity: '0.5' })
    expect(safeSvgProps({ width: '53', height: '40', fill: 'white', transform: 'translate(4 10)' }))
      .toEqual({ width: '53', height: '40', fill: 'white', transform: 'translate(4 10)' })
  })

  it('matches attribute names whatever their case (the HTML parser may or may not have adjusted it)', () => {
    expect(safeSvgProps({ VIEWBOX: '0 0 60 60', viewbox: '0 0 28 23' })).toEqual({ viewBox: '0 0 28 23' })
    expect(safeSvgProps({ 'Clip-Path': 'url(#a)' }, 'p-')).toEqual({ clipPath: 'url(#p-a)' })
  })

  it('never lets through events, links, styles, classes or anything it has no rule for', () => {
    const props = safeSvgProps({
      onload: 'alert(1)', onclick: 'alert(1)', onerror: 'alert(1)', onbegin: 'alert(1)', href: 'https://evil.example/', 'xlink:href': 'javascript:alert(1)',
      style: 'position:fixed', class: 'search-overlay', src: 'x', action: 'x', formaction: 'x', srcdoc: '<script>', is: 'x', 'data-x': '1', 'aria-label': 'x',
      width: '10',
    })
    expect(props).toEqual({ width: '10' })
  })

  it('checks every value: no scripts, no external references, no oversized shapes', () => {
    expect(safeSvgProps({ fill: 'url(javascript:alert(1))' })).toEqual({})
    expect(safeSvgProps({ fill: 'url(#x)' })).toEqual({})
    expect(safeSvgProps({ fill: 'red;stroke:blue' })).toEqual({})
    expect(safeSvgProps({ stroke: 'javascript:alert(1)' })).toEqual({})
    expect(safeSvgProps({ width: '100000' })).toEqual({})
    expect(safeSvgProps({ width: 'calc(100vw)' })).toEqual({})
    expect(safeSvgProps({ viewBox: '0 0 128' })).toEqual({})
    expect(safeSvgProps({ viewBox: '0 0 128 128 <script>' })).toEqual({})
    expect(safeSvgProps({ d: 'M0 0 <script>alert(1)</script>' })).toEqual({})
    expect(safeSvgProps({ d: `M0 0${'L1 1'.repeat(6000)}` })).toEqual({}) // длиннее 20 000 знаков
    expect(safeSvgProps({ transform: 'translate(1 2) foo(3)' })).toEqual({})
    expect(safeSvgProps({ transform: 'rotate(1)javascript:alert(1)' })).toEqual({})
    expect(safeSvgProps({ 'fill-rule': 'inherit' })).toEqual({})
    expect(safeSvgProps({ 'fill-opacity': '5' })).toEqual({})
    expect(safeSvgProps({ x: '1e9' })).toEqual({})
    expect(safeSvgProps({ points: '0,0 1,1 <x>' })).toEqual({})
  })

  it('allows a reference only to an element of the same description, and renames both the id and the reference', () => {
    expect(safeSvgProps({ id: 'clip0_4922_2543' }, 'tt1-')).toEqual({ id: 'tt1-clip0_4922_2543' })
    expect(safeSvgProps({ 'clip-path': 'url(#clip0_4922_2543)' }, 'tt1-')).toEqual({ clipPath: 'url(#tt1-clip0_4922_2543)' })
    for (const bad of ['url(https://evil.example/x.svg#a)', 'url(//evil.example/x.svg#a)', 'url("#a")', 'url(#a) url(#b)', 'url(#a);x', 'url(data:image/svg+xml,x)', '#a', 'none', 'url(#)']) {
      expect(safeSvgProps({ 'clip-path': bad }, 'tt1-'), bad).toEqual({})
    }
    for (const bad of ['1abc', 'a b', 'a"b', "a'b", 'a<b', '', `a${'b'.repeat(80)}`]) expect(safeSvgProps({ id: bad }, 'tt1-'), bad).toEqual({})
  })

  it('survives odd input without throwing and without touching the prototype', () => {
    expect(safeSvgProps(undefined)).toEqual({})
    expect(safeSvgProps(null)).toEqual({})
    expect(safeSvgProps({ width: 10, height: null, fill: undefined, d: {} })).toEqual({}) // не строки
    const polluted = safeSvgProps(JSON.parse('{"__proto__":"x","constructor":"y","toString":"z","hasOwnProperty":"w","width":"5"}'))
    expect(polluted).toEqual({ width: '5' })
    expect({}.polluted).toBeUndefined()
  })
})

describe('tag lists', () => {
  it('allow only the elements an ability description needs', () => {
    expect([...TOOLTIP_TAGS].sort()).toEqual(['b', 'br', 'em', 'i', 'img', 'span', 'strong', 'u'])
    expect([...SVG_TAGS.keys()].sort()).toEqual(['circle', 'clippath', 'defs', 'ellipse', 'g', 'line', 'path', 'polygon', 'polyline', 'rect', 'svg'])
    expect(SVG_TAGS.get('clippath')).toBe('clipPath') // React пишет этот элемент с заглавной P
  })

  it('never contain an element that can run code, load a page or draw forms', () => {
    const dangerous = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'a', 'link', 'meta', 'base', 'use', 'image', 'foreignobject', 'animate', 'set', 'math', 'template', 'noscript']
    for (const tag of dangerous) {
      expect(TOOLTIP_TAGS.has(tag), `${tag} в тегах HTML`).toBe(false)
      expect(SVG_TAGS.has(tag), `${tag} в тегах SVG`).toBe(false)
    }
    for (const tag of ['script', 'style', 'iframe', 'object', 'embed', 'form', 'math', 'template', 'noscript']) {
      expect(TOOLTIP_DROP_TAGS.has(tag), `${tag} выбрасывается`).toBe(true)
    }
    expect(TOOLTIP_DROP_TAGS.has('svg')).toBe(false) // иконки svg разбираются отдельно
  })
})
