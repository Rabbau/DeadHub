import { describe, expect, it } from 'vitest'
import { filterAndSort } from '../src/services/heroService.js'

const hero = (name, role, wr, pr, games, kda) => ({ name, role, stats: { winrate: wr, pickrate: pr, games_played: games, kda } })
const heroes = [
  hero('Bebop', 'Marksman', 0.51, 0.04, 40000, 2.5),
  hero('Abrams', 'Brawler', 0.55, 0.02, 20000, 3.1),
  hero('Calico', 'Assassin', 0.49, 0.03, 30000, 2.9),
  hero('Ghost', 'Mystic', 0, 0, 0, null), // нет матчей в выборке
]
const names = (list) => list.map((h) => h.name)

describe('filterAndSort', () => {
  it.each([
    ['winrate', 'desc', ['Abrams', 'Bebop', 'Calico', 'Ghost']],
    ['winrate', 'asc', ['Calico', 'Bebop', 'Abrams', 'Ghost']], // герой без матчей остаётся последним
    ['pickrate', 'desc', ['Bebop', 'Calico', 'Abrams', 'Ghost']],
    ['matches', 'desc', ['Bebop', 'Calico', 'Abrams', 'Ghost']],
    ['matches', 'asc', ['Abrams', 'Calico', 'Bebop', 'Ghost']],
    ['kda', 'desc', ['Abrams', 'Calico', 'Bebop', 'Ghost']],
    ['kda', 'asc', ['Bebop', 'Calico', 'Abrams', 'Ghost']],
    ['name', 'asc', ['Abrams', 'Bebop', 'Calico', 'Ghost']],
    ['name', 'desc', ['Ghost', 'Calico', 'Bebop', 'Abrams']],
    ['nope', 'desc', ['Abrams', 'Bebop', 'Calico', 'Ghost']], // неизвестный ключ — как winrate
  ])('sorts by %s %s', (sort, dir, expected) => {
    expect(names(filterAndSort(heroes, { sort, dir }))).toEqual(expected)
  })

  it('defaults to winrate desc', () => {
    expect(names(filterAndSort(heroes))).toEqual(['Abrams', 'Bebop', 'Calico', 'Ghost'])
  })

  it('searches by name and filters by role', () => {
    expect(names(filterAndSort(heroes, { search: 'cal' }))).toEqual(['Calico'])
    expect(names(filterAndSort(heroes, { role: 'brawler' }))).toEqual(['Abrams'])
  })

  it('does not mutate the input and accepts an empty list', () => {
    filterAndSort(heroes, { sort: 'name' })
    expect(names(heroes)).toEqual(['Bebop', 'Abrams', 'Calico', 'Ghost'])
    expect(filterAndSort([])).toEqual([])
  })
})
