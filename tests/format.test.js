import { describe, expect, it } from 'vitest'
import { formatAge, formatShortDate } from '../src/services/format.js'

const NOW = Date.UTC(2026, 9, 3, 12, 0) // 3 октября 2026, полдень UTC
const ago = (days) => Math.floor(NOW / 1000) - days * 86400

describe('formatAge', () => {
  it('says today, yesterday and «N days ago» in English', () => {
    expect(formatAge(ago(0), 'english', NOW)).toBe('today')
    expect(formatAge(ago(1), 'english', NOW)).toBe('yesterday')
    expect(formatAge(ago(3), 'english', NOW)).toBe('3 days ago')
  })

  it('says the same in Russian', () => {
    expect(formatAge(ago(0), 'russian', NOW)).toBe('сегодня')
    expect(formatAge(ago(1), 'russian', NOW)).toBe('вчера')
    expect(formatAge(ago(3), 'russian', NOW)).toBe('3 дня назад')
    expect(formatAge(ago(5), 'russian', NOW)).toBe('5 дней назад')
  })

  it('counts in days up to two months and in months after that', () => {
    expect(formatAge(ago(59), 'english', NOW)).toBe('59 days ago')
    expect(formatAge(ago(60), 'english', NOW)).toBe('2 months ago')
    expect(formatAge(ago(100), 'english', NOW)).toBe('3 months ago')
  })

  it('never goes into the future: a post dated ahead of the clock counts as today', () => {
    expect(formatAge(ago(-2), 'english', NOW)).toBe('today')
  })
})

describe('formatShortDate', () => {
  it('shows day and month, and a dash when there is no date', () => {
    expect(formatShortDate(Date.UTC(2026, 8, 29, 12) / 1000, 'english')).toMatch(/Sep 29|29 Sep/) // полдень UTC: дата та же в любом поясе
    expect(formatShortDate(0, 'english')).toBe('—')
    expect(formatShortDate(undefined, 'russian')).toBe('—')
  })
})
