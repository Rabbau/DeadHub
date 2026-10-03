import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  elapsedSeconds, filterMatches, heroesOnAir, liveModeKey, regionsPresent, slimActiveMatch, slimActiveMatches, slimBroadcasts,
  soulLead, sortMatches, summarizeLive, teamPlayers,
} from '../src/services/liveService.js'

const player = (id, team, heroId) => ({ account_id: id, team, team_parsed: `Team${team}`, abandoned: null, hero_id: heroId })
const raw = (overrides = {}) => ({
  start_time: 1_000_000, winning_team: null, match_id: 100, players: [player(1, 0, 13), player(2, 0, 7), player(3, 1, 13), player(4, 1, 2)],
  net_worth_team_0: 50_000, net_worth_team_1: 40_000, duration_s: null, spectators: 2, match_mode: 4, game_mode: 1, region_mode_parsed: 'europe', ...overrides,
})
const match = (overrides = {}) => slimActiveMatch(raw(overrides))

describe('slimActiveMatch', () => {
  it('keeps what the page needs', () => {
    expect(match()).toEqual({
      id: 100, startedAt: 1_000_000, gameMode: 1, matchMode: 4, region: 'europe', souls: [50_000, 40_000], spectators: 2,
      players: [{ id: 1, team: 0, heroId: 13 }, { id: 2, team: 0, heroId: 7 }, { id: 3, team: 1, heroId: 13 }, { id: 4, team: 1, heroId: 2 }],
    })
  })

  it('refuses rows that cannot be shown', () => {
    expect(slimActiveMatch(null)).toBeNull()
    expect(slimActiveMatch(raw({ match_id: null }))).toBeNull()
    expect(slimActiveMatch(raw({ match_id: -4 }))).toBeNull()
    expect(slimActiveMatch(raw({ players: [] }))).toBeNull()
    expect(slimActiveMatch(raw({ players: 'x' }))).toBeNull()
  })

  it('skips players without an account or a hero, and fills in missing numbers', () => {
    const m = slimActiveMatch(raw({ players: [player(1, 0, 13), { account_id: null, team: 0, hero_id: 5 }, { account_id: 3, team: 1, hero_id: null }], spectators: undefined, net_worth_team_0: null, start_time: undefined, region_mode_parsed: undefined }))
    expect(m.players).toEqual([{ id: 1, team: 0, heroId: 13 }])
    expect(m).toMatchObject({ spectators: 0, souls: [0, 40_000], startedAt: null, region: null })
  })

  it('lower-cases the region', () => {
    expect(match({ region_mode_parsed: 'SE_Asia' }).region).toBe('se_asia')
  })
})

describe('slimActiveMatches', () => {
  it('drops bad rows and duplicates', () => {
    const list = slimActiveMatches([raw(), raw(), raw({ match_id: 101 }), null, { match_id: 5 }])
    expect(list.map((m) => m.id)).toEqual([100, 101])
  })

  it('is empty for anything that is not a list', () => {
    expect(slimActiveMatches(undefined)).toEqual([])
    expect(slimActiveMatches({ error: 'x' })).toEqual([])
  })

  it('reads a real answer of the API', () => {
    // Урезанный настоящий ответ matches/active (первые три матча), снятый 2026-10-03
    const file = path.resolve(import.meta.dirname, 'fixtures/active-matches.json')
    const real = JSON.parse(fs.readFileSync(file, 'utf8'))
    const list = slimActiveMatches(real)
    expect(list).toHaveLength(real.length)
    for (const m of list) {
      expect(m.players.length).toBeGreaterThanOrEqual(8)
      expect(['streetBrawl', 'ranked', 'unranked']).toContain(liveModeKey(m))
      expect(m.startedAt).toBeGreaterThan(1_700_000_000)
    }
  })
})

describe('slimBroadcasts', () => {
  it('keeps the address and the time of the last update', () => {
    const list = slimBroadcasts([{ match_id: 1, broadcast_url: 'http://dist1-ord1.steamcontent.com/tv/1_2', lobby_id: 9, updated_at: 50 }])
    expect(list).toEqual([{ matchId: 1, url: 'http://dist1-ord1.steamcontent.com/tv/1_2', updatedAt: 50 }])
  })

  it('drops rows without a proper address and repeated matches', () => {
    const list = slimBroadcasts([
      { match_id: 1, broadcast_url: 'javascript:alert(1)' },
      { match_id: 2, broadcast_url: '' },
      { match_id: 3, broadcast_url: 'http://a/b c' },
      { match_id: 4, broadcast_url: 'https://ok/4' },
      { match_id: 4, broadcast_url: 'https://ok/4-again' },
      { match_id: 'x', broadcast_url: 'https://ok/x' },
      null,
    ])
    expect(list.map((b) => b.matchId)).toEqual([4])
    expect(list[0].updatedAt).toBeNull()
  })

  it('is empty for anything that is not a list', () => {
    expect(slimBroadcasts(null)).toEqual([])
  })
})

describe('liveModeKey', () => {
  it('tells Street Brawl, ranked and unranked apart', () => {
    expect(liveModeKey(match({ game_mode: 4, match_mode: 1 }))).toBe('streetBrawl')
    expect(liveModeKey(match({ game_mode: 1, match_mode: 4 }))).toBe('ranked')
    expect(liveModeKey(match({ game_mode: 1, match_mode: 1 }))).toBe('unranked')
    expect(liveModeKey(match({ game_mode: 1, match_mode: 9 }))).toBe('unranked')
  })
})

describe('elapsedSeconds', () => {
  it('counts from the start to now and never goes negative', () => {
    expect(elapsedSeconds(match(), 1_000_000_000 + 125_000)).toBe(1_000_000_000 / 1000 + 125 - 1_000_000)
    expect(elapsedSeconds(match({ start_time: 2_000_000_000 }), 1_000_000)).toBe(0)
    expect(elapsedSeconds(match({ start_time: undefined }))).toBeNull()
  })
})

describe('soulLead', () => {
  it('shows who leads and by how much', () => {
    expect(soulLead(match())).toMatchObject({ leader: 0, lead: 10_000 })
    expect(soulLead(match())?.share).toBeCloseTo(50 / 90)
    expect(soulLead(match({ net_worth_team_0: 10, net_worth_team_1: 30 }))).toMatchObject({ leader: 1, lead: 20 })
    expect(soulLead(match({ net_worth_team_0: 1, net_worth_team_1: 0 }))).toMatchObject({ leader: 0, lead: 1 })
  })

  it('shows nothing for an even score, a negligible gap, an empty one and Street Brawl (its souls are fixed placeholders)', () => {
    expect(soulLead(match({ net_worth_team_0: 5, net_worth_team_1: 5 }))).toBeNull()
    // 34 души при 26 800 в сумме — это 0,1%: не перевес; 1% и больше — перевес
    expect(soulLead(match({ net_worth_team_0: 13_417, net_worth_team_1: 13_383 }))).toBeNull()
    expect(soulLead(match({ net_worth_team_0: 10_000, net_worth_team_1: 10_300 }))).toMatchObject({ leader: 1, lead: 300 })
    expect(soulLead(match({ net_worth_team_0: 0, net_worth_team_1: 0 }))).toBeNull()
    expect(soulLead(match({ game_mode: 4, net_worth_team_0: 136_000, net_worth_team_1: 136_001 }))).toBeNull()
  })
})

describe('teamPlayers', () => {
  it('splits players by team', () => {
    expect(teamPlayers(match(), 0).map((p) => p.id)).toEqual([1, 2])
    expect(teamPlayers(match(), 1).map((p) => p.id)).toEqual([3, 4])
  })
})

describe('filterMatches', () => {
  const list = [
    match({ match_id: 1, game_mode: 1, match_mode: 4, region_mode_parsed: 'europe' }),
    match({ match_id: 2, game_mode: 1, match_mode: 1, region_mode_parsed: 'russia', players: [player(1, 0, 99), player(2, 1, 98)] }),
    match({ match_id: 3, game_mode: 4, match_mode: 1, region_mode_parsed: 'europe' }),
  ]

  it('filters by mode and region', () => {
    expect(filterMatches(list, { mode: 'ranked' }).map((m) => m.id)).toEqual([1])
    expect(filterMatches(list, { mode: 'streetBrawl' }).map((m) => m.id)).toEqual([3])
    expect(filterMatches(list, { region: 'europe' }).map((m) => m.id)).toEqual([1, 3])
    expect(filterMatches(list, { mode: 'unranked', region: 'russia' }).map((m) => m.id)).toEqual([2])
  })

  it('filters by hero and by the presence of a broadcast', () => {
    expect(filterMatches(list, { heroId: 99 }).map((m) => m.id)).toEqual([2])
    expect(filterMatches(list, { withBroadcast: true }, new Set([3])).map((m) => m.id)).toEqual([3])
    expect(filterMatches(list, { withBroadcast: true })).toEqual([]) // трансляции не загрузились
  })

  it('shows everything without filters', () => {
    expect(filterMatches(list)).toHaveLength(3)
    expect(filterMatches(list, { mode: 'all', region: 'all' })).toHaveLength(3)
  })
})

describe('sortMatches', () => {
  const list = [
    match({ match_id: 1, start_time: 100, spectators: 1 }),
    match({ match_id: 2, start_time: 300, spectators: 9 }),
    match({ match_id: 3, start_time: 200, spectators: 9 }),
  ]

  it('puts the most watched first, then the newest', () => {
    expect(sortMatches(list, 'spectators').map((m) => m.id)).toEqual([2, 3, 1])
  })

  it('sorts by age both ways', () => {
    expect(sortMatches(list, 'newest').map((m) => m.id)).toEqual([2, 3, 1])
    expect(sortMatches(list, 'longest').map((m) => m.id)).toEqual([1, 3, 2])
  })

  it('does not change the input and falls back to a known order', () => {
    const copy = [...list]
    sortMatches(list, 'nonsense')
    expect(list).toEqual(copy)
    expect(sortMatches(list, 'nonsense').map((m) => m.id)).toEqual([2, 3, 1])
  })

  it('keeps the order stable when everything is equal (newest match number first)', () => {
    const same = [match({ match_id: 5, start_time: 1, spectators: 0 }), match({ match_id: 9, start_time: 1, spectators: 0 })]
    expect(sortMatches(same, 'spectators').map((m) => m.id)).toEqual([9, 5])
  })
})

describe('heroesOnAir', () => {
  it('counts players and matches per hero', () => {
    const list = [match({ match_id: 1 }), match({ match_id: 2 })] // в каждом матче герой 13 играет дважды
    const top = heroesOnAir(list)
    expect(top[0]).toEqual({ heroId: 13, players: 4, matches: 2 })
    expect(top.find((h) => h.heroId === 7)).toEqual({ heroId: 7, players: 2, matches: 2 })
  })

  it('shows only the top and breaks ties by hero id', () => {
    const list = [match({ players: [player(1, 0, 5), player(2, 0, 4), player(3, 1, 3), player(4, 1, 2)] })]
    expect(heroesOnAir(list, 3).map((h) => h.heroId)).toEqual([2, 3, 4])
  })
})

describe('summarizeLive / regionsPresent', () => {
  const list = [match({ match_id: 1 }), match({ match_id: 2, game_mode: 4, match_mode: 1, region_mode_parsed: 'russia' }), match({ match_id: 3, match_mode: 1, region_mode_parsed: 'mars' })]

  it('counts matches, players and modes', () => {
    expect(summarizeLive(list)).toEqual({ matches: 3, players: 12, modes: { ranked: 1, unranked: 1, streetBrawl: 1 } })
  })

  it('lists regions in a fixed order, unknown ones last', () => {
    expect(regionsPresent(list)).toEqual(['europe', 'russia', 'mars'])
    expect(regionsPresent([])).toEqual([])
  })
})
