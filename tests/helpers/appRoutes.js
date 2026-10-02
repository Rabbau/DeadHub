import fs from 'node:fs'
import path from 'node:path'

const APP = path.resolve(import.meta.dirname, '../../src/App.jsx')

/**
 * Адреса страниц из <Route> в App.jsx. Главная (index и обёртка path="/") — '/', «*» (404) пропускается.
 * `fixed` — адреса без параметров (/heroes, /meta), `all` — вместе с динамическими (/hero/:id).
 * Так тесты узнают о новой странице из самого кода, а не из списка, который можно забыть обновить.
 */
export function appRoutes() {
  const source = fs.readFileSync(APP, 'utf8')
  const all = []
  for (const match of source.matchAll(/<Route (?:index|path="([^"]*)")/g)) {
    if (match[1] === '*') continue
    all.push(match[1] === undefined || match[1] === '/' ? '/' : `/${match[1]}`)
  }
  const unique = [...new Set(all)]
  return { all: unique, fixed: unique.filter((route) => !route.includes(':')) }
}
