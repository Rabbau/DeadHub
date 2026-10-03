import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HERO_POSTERS, heroPoster, posterOfTheDay } from '../src/data/heroArt.js'

const PUBLIC = path.resolve(import.meta.dirname, '../public')
const DAY_MS = 24 * 60 * 60 * 1000

describe('hero posters', () => {
  it('belong to heroes by numeric id and to files that ship with the site', () => {
    const entries = Object.entries(HERO_POSTERS)
    expect(entries.length).toBeGreaterThanOrEqual(6)
    for (const [id, file] of entries) {
      expect(Number.isInteger(Number(id)) && Number(id) > 0, `id ${id}`).toBe(true)
      expect(file, id).toMatch(/^\/art\/[\w-]+\.webp$/)
      expect(fs.existsSync(path.join(PUBLIC, file)), file).toBe(true)
    }
  })

  it('give every hero its own poster', () => {
    const files = Object.values(HERO_POSTERS)
    expect(new Set(files).size).toBe(files.length)
  })

  it('find a poster by id (number or string) and say nothing for the others', () => {
    expect(heroPoster(80)).toBe('/art/hero-silver.webp')
    expect(heroPoster('80')).toBe('/art/hero-silver.webp')
    expect(heroPoster(1)).toBeNull()
    expect(heroPoster(undefined)).toBeNull()
    expect(heroPoster('constructor')).toBeNull() // ключи прототипа — не герои
  })
})

describe('posterOfTheDay', () => {
  const posters = Object.values(HERO_POSTERS)
  const noon = (day) => day * DAY_MS + DAY_MS / 2

  it('is one of the posters and stays the same during a day', () => {
    const day = 20_000
    const first = posterOfTheDay(day * DAY_MS)
    expect(posters).toContain(first)
    expect(posterOfTheDay(noon(day))).toBe(first)
    expect(posterOfTheDay((day + 1) * DAY_MS - 1)).toBe(first)
  })

  it('changes at midnight UTC and goes through every poster before it repeats', () => {
    const seen = Array.from({ length: posters.length }, (_, i) => posterOfTheDay(noon(20_000 + i)))
    expect(new Set(seen).size).toBe(posters.length)
    expect(posterOfTheDay(noon(20_000 + posters.length))).toBe(seen[0])
    expect(posterOfTheDay(noon(20_001))).not.toBe(posterOfTheDay(noon(20_000)))
  })

  it('works for dates before 1970 and for the current time', () => {
    expect(posters).toContain(posterOfTheDay(-DAY_MS * 3))
    expect(posters).toContain(posterOfTheDay())
  })
})
