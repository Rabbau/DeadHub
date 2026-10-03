import { describe, expect, it } from 'vitest'
import { slimHistory } from '../src/api/playerApi.js'

// Урезанные строки настоящего ответа match-history (см. tests/fixtures: поля те же, что отдаёт API)
const row = (overrides = {}) => ({
  account_id: 898786482, match_id: 109851588, hero_id: 76, hero_level: 26, start_time: 1790967986, game_mode: 4, match_mode: 1,
  player_team: 0, player_kills: 2, player_deaths: 4, player_assists: 10, net_worth: 22400, last_hits: 71, abandoned_time_s: 0,
  match_duration_s: 758, match_result: 1, ranked_display_badge: null, ranked_delta: null, ...overrides,
})

describe('slimHistory', () => {
  it('turns a match-history row into the shape of the site, with the game mode', () => {
    const [match] = slimHistory([row()])
    expect(match).toEqual({
      id: 109851588, heroId: 76, at: 1790967986, duration: 758, kills: 2, deaths: 4, assists: 10, win: false,
      mode: 1, gameMode: 4, delta: null, badge: null, abandoned: false,
    })
  })

  it('counts a win when the winning team is the player’s team', () => {
    expect(slimHistory([row({ player_team: 1, match_result: 1 })])[0].win).toBe(true)
    expect(slimHistory([row({ player_team: 0, match_result: 1 })])[0].win).toBe(false)
  })

  it('keeps the rank badge and its change of a ranked match', () => {
    const [match] = slimHistory([row({ match_mode: 4, game_mode: 1, ranked_display_badge: 53, ranked_delta: -17 })])
    expect(match).toMatchObject({ mode: 4, gameMode: 1, badge: 53, delta: -17 })
  })

  it('marks an abandoned match', () => {
    expect(slimHistory([row({ abandoned_time_s: 312 })])[0].abandoned).toBe(true)
  })

  it('puts the newest match first', () => {
    const list = slimHistory([row({ match_id: 1, start_time: 100 }), row({ match_id: 3, start_time: 300 }), row({ match_id: 2, start_time: 200 })])
    expect(list.map((m) => m.id)).toEqual([3, 2, 1])
  })

  it('fills in zeros for missing numbers and leaves the game mode unknown when the row has none', () => {
    const { game_mode: _gameMode, match_duration_s: _duration, player_kills: _kills, ...bare } = row()
    const [match] = slimHistory([bare])
    expect(match).toMatchObject({ gameMode: null, duration: 0, kills: 0 })
  })

  it('is empty for anything that is not a list', () => {
    expect(slimHistory(undefined)).toEqual([])
    expect(slimHistory({ error: 'x' })).toEqual([])
    expect(slimHistory([])).toEqual([])
  })
})
