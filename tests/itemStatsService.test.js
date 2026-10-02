import { describe, expect, it } from 'vitest'
import { MIN_RELIABLE_MATCHES, buildItemRows, formatBuyTime, sortItemRows } from '../src/services/itemStatsService.js'

const item = (id, name, cost = 800, slot = 'weapon') => ({ id, name, cost, item_slot_type: slot })
const items = [item(1, 'Basic Mag', 800), item(2, 'Titanic Magazine', 6400), item(3, 'Rare Find', 3200), item(4, 'Never Bought', 1600)]
const stats = {
  1: { matches: 50000, wins: 26000, avgBuyTimeS: 300 },
  2: { matches: 8000, wins: 4000, avgBuyTimeS: 1500 },
  3: { matches: 40, wins: 38, avgBuyTimeS: 900 }, // 95% побед на сорока покупках — это шум, а не лучший предмет
}
const base = 200000
const names = (rows) => rows.map((r) => r.item.name)

describe('buildItemRows', () => {
  const rows = buildItemRows(items, stats, base)

  it('computes win rate and the share of matches with the item', () => {
    expect(rows[0]).toMatchObject({ matches: 50000, winrate: 0.52, usage: 0.25, buyTimeS: 300, reliable: true, tier: 't1' })
    expect(rows[1]).toMatchObject({ winrate: 0.5, usage: 0.04, tier: 't4' })
  })

  it('marks small samples and items without stats', () => {
    expect(rows[2].reliable).toBe(false)
    expect(rows[3]).toMatchObject({ matches: 0, winrate: null, usage: null, buyTimeS: null, reliable: false })
    expect(MIN_RELIABLE_MATCHES).toBe(100)
  })

  it('has no usage when the base is unknown yet (heroes still loading)', () => {
    expect(buildItemRows(items, stats, 0)[0]).toMatchObject({ winrate: 0.52, usage: null })
    expect(buildItemRows(items, null, base)[0].matches).toBe(0)
  })
})

describe('sortItemRows', () => {
  const rows = buildItemRows(items, stats, base)

  it('sorts by a number and keeps noisy and empty rows at the bottom in either direction', () => {
    expect(names(sortItemRows(rows, 'winrate', 'desc'))).toEqual(['Basic Mag', 'Titanic Magazine', 'Rare Find', 'Never Bought'])
    expect(names(sortItemRows(rows, 'winrate', 'asc'))).toEqual(['Titanic Magazine', 'Basic Mag', 'Rare Find', 'Never Bought'])
    expect(names(sortItemRows(rows, 'usage', 'desc'))).toEqual(['Basic Mag', 'Titanic Magazine', 'Rare Find', 'Never Bought'])
  })

  it('sorts by matches including small samples (the number itself is honest), empty rows last', () => {
    expect(names(sortItemRows(rows, 'matches', 'desc'))).toEqual(['Basic Mag', 'Titanic Magazine', 'Rare Find', 'Never Bought'])
    expect(names(sortItemRows(rows, 'matches', 'asc'))).toEqual(['Rare Find', 'Titanic Magazine', 'Basic Mag', 'Never Bought'])
  })

  it('sorts by name and by cost with every row taking part', () => {
    expect(names(sortItemRows(rows, 'name', 'asc'))).toEqual(['Basic Mag', 'Never Bought', 'Rare Find', 'Titanic Magazine'])
    expect(names(sortItemRows(rows, 'name', 'desc'))).toEqual(['Titanic Magazine', 'Rare Find', 'Never Bought', 'Basic Mag'])
    expect(names(sortItemRows(rows, 'cost', 'asc'))).toEqual(['Basic Mag', 'Never Bought', 'Rare Find', 'Titanic Magazine'])
    expect(names(sortItemRows(rows, 'cost', 'desc'))).toEqual(['Titanic Magazine', 'Rare Find', 'Never Bought', 'Basic Mag'])
  })

  it('sorts by buy time: earliest first, items without a time last', () => {
    expect(names(sortItemRows(rows, 'buyTime', 'asc'))).toEqual(['Basic Mag', 'Titanic Magazine', 'Rare Find', 'Never Bought'])
  })

  it('falls back to usage for an unknown column and does not touch the input', () => {
    const before = names(rows)
    expect(names(sortItemRows(rows, 'nope', 'desc'))[0]).toBe('Basic Mag')
    expect(names(rows)).toEqual(before)
  })

  it('breaks ties by name so the order is stable', () => {
    const tie = buildItemRows([item(1, 'B'), item(2, 'A')], { 1: { matches: 500, wins: 250 }, 2: { matches: 500, wins: 250 } }, 1000)
    expect(names(sortItemRows(tie, 'winrate', 'desc'))).toEqual(['A', 'B'])
  })
})

describe('formatBuyTime', () => {
  it('writes minutes and seconds', () => {
    expect(formatBuyTime(300)).toBe('5:00')
    expect(formatBuyTime(1504.6)).toBe('25:05')
    expect(formatBuyTime(0)).toBe('0:00')
  })

  it('has a dash without data', () => {
    expect(formatBuyTime(null)).toBe('—')
    expect(formatBuyTime(undefined)).toBe('—')
    expect(formatBuyTime(NaN)).toBe('—')
  })
})
