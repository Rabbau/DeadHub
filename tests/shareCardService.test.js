import { describe, expect, it } from 'vitest'
import { CARD, buildShareModel, cardFileName, fitText } from '../src/services/shareCardService.js'

const t = (key, params = {}) => `${key}${Object.keys(params).length ? JSON.stringify(params) : ''}`

describe('cardFileName', () => {
  it('makes a safe file name from the nickname and the id', () => {
    expect(cardFileName('Real_wiffy', 898786482)).toBe('dead-hub-real-wiffy-898786482.png')
    expect(cardFileName('  Mo & Krill!! ', 5)).toBe('dead-hub-mo-krill-5.png')
  })

  it('uses only the id when the nickname has nothing usable in it', () => {
    expect(cardFileName('Привет', 7)).toBe('dead-hub-7.png')
    expect(cardFileName('日本語', 7)).toBe('dead-hub-7.png')
    expect(cardFileName('', 7)).toBe('dead-hub-7.png')
    expect(cardFileName(null, 7)).toBe('dead-hub-7.png')
  })

  it('never lets a path or a dot into the name', () => {
    for (const evil of ['../../etc/passwd', 'a/b\\c', 'x".png', 'con.', 'a\u0000b']) {
      expect(cardFileName(evil, 1), evil).toMatch(/^dead-hub-[a-z0-9-]*\d+\.png$/)
    }
  })

  it('keeps accents as their base letters and cuts long nicknames', () => {
    expect(cardFileName('Café', 3)).toBe('dead-hub-cafe-3.png')
    const long = cardFileName('a'.repeat(100), 3)
    expect(long.length).toBeLessThan(50)
  })
})

describe('fitText', () => {
  const measure = (text) => text.length * 10

  it('leaves text that fits', () => {
    expect(fitText('abc', 100, measure)).toBe('abc')
    expect(fitText('abcdefghij', 100, measure)).toBe('abcdefghij')
  })

  it('cuts what does not fit and adds an ellipsis, staying within the width', () => {
    const out = fitText('abcdefghijklmnop', 100, measure)
    expect(out.endsWith('…')).toBe(true)
    expect(measure(out)).toBeLessThanOrEqual(100)
    expect(out).toBe('abcdefghi…')
  })

  it('does not leave a space before the ellipsis', () => {
    expect(fitText('abcd efgh ijkl', 60, measure)).toBe('abcd…')
  })

  it('returns just an ellipsis when nothing else fits', () => {
    expect(fitText('abcdef', 10, measure)).toBe('…')
    expect(fitText('abcdef', 0, measure)).toBe('…')
  })

  it('takes null and numbers', () => {
    expect(fitText(null, 100, measure)).toBe('')
    expect(fitText(12345, 100, measure)).toBe('12345')
  })
})

describe('buildShareModel', () => {
  const heroes = [
    { id: 13, name: 'Haze', icon_url: 'https://assets-bucket.deadlock-api.com/haze_sm.webp' },
    { id: 2, name: 'Seven', icon_url: null, image_url: 'https://assets-bucket.deadlock-api.com/seven.webp' },
    { id: 7, name: 'Lash', icon_url: 'https://assets-bucket.deadlock-api.com/lash_sm.webp' },
    { id: 9, name: 'Wraith', icon_url: 'https://assets-bucket.deadlock-api.com/wraith_sm.webp' },
  ]
  const ranks = [{ tier: 5, name: 'Oracle', large: 'https://api.deadlock-api.com/oracle.png', sub: { 3: 'https://api.deadlock-api.com/oracle3.png' } }]
  const heroRow = (heroId, matches, wins) => ({ heroId, matches, wins, kills: matches * 6, deaths: matches * 4, assists: matches * 8, accuracy: 0.4, lastPlayed: 1 })
  let n = 0
  const game = (win) => { n += 1; return { id: n, heroId: 13, at: 9_000_000 - n * 100, win, kills: 5, deaths: 5, assists: 5, mode: 4, gameMode: 1, badge: null } }
  const input = (overrides = {}) => ({
    accountId: 898786482,
    steam: { name: 'Real_wiffy', avatar: 'https://avatars.steamstatic.com/a_medium.jpg' },
    rank: { badge: 53 },
    history: Array.from({ length: 25 }, (_, i) => game(i % 2 === 0)),
    heroStats: [heroRow(7, 10, 5), heroRow(13, 100, 60), heroRow(2, 50, 20), heroRow(9, 5, 5)],
    heroes,
    ranks,
    ...overrides,
  })

  it('has the player, rank, four numbers, three heroes and the form', () => {
    const model = buildShareModel(input(), t, 'english')
    expect(model).toMatchObject({ name: 'Real_wiffy', idLine: 'ID 898786482', avatarUrl: 'https://avatars.steamstatic.com/a_medium.jpg' })
    expect(model.badge).toEqual({ label: 'Oracle 3', image: 'https://api.deadlock-api.com/oracle3.png' })
    expect(model.stats.map((s) => s.key)).toEqual(['matches', 'winrate', 'kda', 'accuracy'])
    expect(model.stats[0].value).toBe('165')
    expect(model.stats[1].value).toBe('54.5%') // 90 побед из 165 матчей
    expect(model.heroes.map((h) => h.heroId)).toEqual([13, 2, 7])
    expect(model.heroes).toHaveLength(CARD.HEROES)
    expect(model.heroes[0]).toMatchObject({ name: 'Haze', winrate: '60.0%', matches: '100', icon: 'https://assets-bucket.deadlock-api.com/haze_sm.webp' })
    expect(model.form.results).toHaveLength(CARD.STRIP)
    expect(model.form.results[0]).toBe(true)
  })

  it('formats numbers for the interface language', () => {
    const big = input({ heroStats: [heroRow(13, 1234, 600)] })
    expect(buildShareModel(big, t, 'english').stats[0].value).toBe('1,234')
    expect(buildShareModel(big, t, 'russian').stats[0].value).toMatch(/^1\s234$/)
  })

  it('falls back to the other icon of a hero, and to the id for a hero the catalogue does not know', () => {
    const model = buildShareModel(input({ heroStats: [heroRow(2, 30, 15), heroRow(555, 20, 10)] }), t, 'english')
    expect(model.heroes[0].icon).toBe('https://assets-bucket.deadlock-api.com/seven.webp')
    expect(model.heroes[1]).toMatchObject({ name: '#555', icon: null })
  })

  it('takes the rank from the last ranked match when there is no rank, and has no rank for an unranked player', () => {
    const history = [{ ...game(true), badge: 53 }, ...input().history]
    expect(buildShareModel(input({ rank: null, history }), t, 'english').badge.label).toBe('Oracle 3')
    expect(buildShareModel(input({ rank: null }), t, 'english').badge).toBeNull()
  })

  it('shows dashes instead of invented numbers when there is no statistics', () => {
    const model = buildShareModel(input({ heroStats: [], history: [] }), t, 'english')
    expect(model.stats.map((s) => s.value)).toEqual(['0', '—', '—', '—'])
    expect(model.heroes).toEqual([])
    expect(model.form).toBeNull()
  })

  it('does not show a form built on a handful of matches', () => {
    expect(buildShareModel(input({ history: Array.from({ length: 5 }, () => game(true)) }), t, 'english').form).toBeNull()
  })

  it('names the player by id when there is no profile', () => {
    expect(buildShareModel(input({ steam: null }), t, 'english')).toMatchObject({ name: '#898786482', avatarUrl: null })
  })

  it('points to the profile page on the site', () => {
    expect(buildShareModel(input(), t, 'english').footer).toBe('dead-hub.vercel.app/player/898786482')
  })

  it('only uses images from hosts the site is allowed to show (so the picture can be drawn)', () => {
    const model = buildShareModel(input(), t, 'english')
    const urls = [model.avatarUrl, model.badge.image, ...model.heroes.map((h) => h.icon)].filter(Boolean)
    for (const url of urls) expect(new URL(url).protocol).toBe('https:')
  })
})
