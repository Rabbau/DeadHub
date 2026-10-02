import { describe, expect, it } from 'vitest'
import ranked from './fixtures/match-ranked.json'
import brawl from './fixtures/match-street-brawl.json'
import {
  finalBuild,
  gameModeKey,
  kdaOf,
  killFeed,
  leadRange,
  matchErrorKey,
  maxOf,
  playerByAccount,
  playersBySlot,
  slimMatch,
  soulsLead,
  splitItemLog,
  teamAverageBadge,
  teamTotals,
  teamWon,
} from '../src/services/matchService.js'

describe('slimMatch on a real ranked match', () => {
  const match = slimMatch(ranked)

  it('reads the match header', () => {
    expect(match).toMatchObject({ id: 109064028, duration: 2014, gameMode: 'normal', mode: 'ranked', winner: 0, score: null })
    expect(match.startedAt).toBeGreaterThan(1_700_000_000)
    expect(match.badges).toEqual([null, null]) // средний ранг в этом матче не считался
  })

  it('has 12 players, team 1 first and richer players first inside a team', () => {
    expect(match.players).toHaveLength(12)
    expect(match.players.map((p) => p.team)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1])
    const worth = (team) => match.players.filter((p) => p.team === team).map((p) => p.netWorth)
    expect(worth(0)).toEqual([...worth(0)].sort((a, b) => b - a))
    expect(worth(1)).toEqual([...worth(1)].sort((a, b) => b - a))
  })

  it('takes the totals from the last stats snapshot', () => {
    const p = match.players[0]
    const raw = ranked.match_info.players.find((x) => x.player_slot === p.slot)
    const last = raw.stats[raw.stats.length - 1]
    expect(p.damage).toBe(last.player_damage)
    expect(p.taken).toBe(last.player_damage_taken)
    expect(p.healing).toBe(last.player_healing)
    expect(p.series[p.series.length - 1]).toEqual([last.time_stamp_s, last.net_worth])
  })

  it('keeps the rating change of ranked players and the MVP places', () => {
    const rated = match.players.filter((p) => p.rank)
    expect(rated).toHaveLength(12)
    // рейтинг до матча — Этернус (бейдж 11x), а изменение по знаку совпадает с итогом: победа +, поражение −
    expect(rated.every((p) => Math.floor(p.rank.badge / 10) === 11)).toBe(true)
    expect(rated.every((p) => (p.result === 1) === (p.rank.change > 0))).toBe(true)
    expect(rated.filter((p) => p.result === 1).every((p) => p.team === match.winner)).toBe(true)
    expect(match.players.filter((p) => p.mvp).map((p) => p.mvp).sort()).toEqual([1, 2, 3])
  })

  it('counts only destroyed objectives and orders them by time', () => {
    expect(match.objectives.length).toBeGreaterThan(5)
    expect(match.objectives.every((o) => o.time >= 5)).toBe(true)
    expect(match.objectives.map((o) => o.time)).toEqual([...match.objectives.map((o) => o.time)].sort((a, b) => a - b))
    expect(match.midBoss).toEqual([{ time: 1165, team: 0 }, { time: 1618, team: 0 }])
  })

  it('does not keep what the page does not read', () => {
    expect(Object.keys(match.players[0]).sort()).toEqual([
      'account', 'assists', 'boss', 'damage', 'deathLog', 'deaths', 'denies', 'hero', 'items', 'kills', 'lane', 'lastHits',
      'left', 'level', 'mvp', 'netWorth', 'rank', 'result', 'series', 'slot', 'taken', 'team', 'healing',
    ].sort())
    expect(JSON.stringify(match).length).toBeLessThan(45_000)
  })
})

describe('slimMatch on a Street Brawl match', () => {
  const match = slimMatch(brawl)

  it('knows the mode, the round score and the 4v4 size', () => {
    expect(match).toMatchObject({ gameMode: 'street_brawl', mode: 'unranked', winner: 0, score: [3, 1], duration: 779 })
    expect(match.players).toHaveLength(8)
    expect(teamTotals(match).map((t) => t.size)).toEqual([4, 4])
  })
})

describe('slimMatch robustness', () => {
  it('refuses a response without a match, so nothing empty is cached', () => {
    expect(() => slimMatch(null)).toThrow('notFound')
    expect(() => slimMatch({})).toThrow('notFound')
    expect(() => slimMatch({ match_info: { players: [] } })).toThrow('notFound')
  })

  it('survives missing optional parts', () => {
    const match = slimMatch({ match_info: { match_id: 5, players: [{ player_slot: 1, team: 0, hero_id: 7 }] } })
    expect(match.players[0]).toMatchObject({ slot: 1, hero: 7, kills: 0, series: [], items: [], deathLog: [], account: null, rank: null, mvp: null, left: null })
    expect(match).toMatchObject({ winner: null, score: null, banned: [], midBoss: [], objectives: [] })
  })

  it('drops players that are on neither team (spectators)', () => {
    const match = slimMatch({ match_info: { players: [{ player_slot: 1, team: 0 }, { player_slot: 2, team: 5 }] } })
    expect(match.players).toHaveLength(1)
  })

  it('marks a player who left and keeps bots without an account id', () => {
    const match = slimMatch({ match_info: { players: [{ player_slot: 1, team: 0, account_id: 0, abandon_match_time_s: 733 }] } })
    expect(match.players[0]).toMatchObject({ account: null, left: 733 })
  })

  it('maps the game mode', () => {
    expect([gameModeKey(1), gameModeKey(4), gameModeKey(2), gameModeKey(undefined)]).toEqual(['normal', 'street_brawl', 'other', 'other'])
  })
})

describe('team totals', () => {
  const match = slimMatch(ranked)
  const [a, b] = teamTotals(match)

  it('sums players of each team', () => {
    const sum = (team, key) => match.players.filter((p) => p.team === team).reduce((s, p) => s + p[key], 0)
    expect(a.kills).toBe(sum(0, 'kills'))
    expect(b.netWorth).toBe(sum(1, 'netWorth'))
    expect(a.size + b.size).toBe(12)
  })

  it('credits objectives to the team that destroyed them (the owner is the other team)', () => {
    expect(a.objectives + b.objectives).toBe(match.objectives.length)
    expect(a.objectives).toBe(match.objectives.filter((o) => o.team === 1).length)
    // победила команда 1: она разрушила больше объектов и убила обоих боссов середины
    expect(a.objectives).toBeGreaterThan(b.objectives)
    expect([a.midBoss, b.midBoss]).toEqual([2, 0])
  })

  it('every kill has a death: kills of one team (without assists) never exceed deaths of the other', () => {
    expect(a.kills).toBeLessThanOrEqual(b.deaths)
    expect(b.kills).toBeLessThanOrEqual(a.deaths)
  })
})

describe('soulsLead', () => {
  const match = slimMatch(ranked)
  const lead = soulsLead(match)

  it('starts at zero and ends at the difference of the final net worth', () => {
    expect(lead[0]).toEqual({ time: 0, teams: [0, 0], lead: 0 })
    const last = lead[lead.length - 1]
    const total = (team) => match.players.filter((p) => p.team === team).reduce((s, p) => s + p.series[p.series.length - 1][1], 0)
    expect(last.teams).toEqual([total(0), total(1)])
    expect(last.lead).toBe(total(0) - total(1))
  })

  it('is ordered by time and has one point per snapshot', () => {
    expect(lead.map((point) => point.time)).toEqual([...lead.map((point) => point.time)].sort((a, b) => a - b))
    expect(lead).toHaveLength(10) // 0 + 9 срезов
  })

  it('keeps the last known value for a player who has no snapshot at that time', () => {
    const synthetic = {
      players: [
        { team: 0, series: [[100, 1000], [200, 2000]] },
        { team: 1, series: [[100, 500]] }, // ушёл из матча после первого среза
      ],
    }
    const points = soulsLead(synthetic)
    expect(points.map((p) => p.lead)).toEqual([0, 500, 1500])
  })
})

describe('matchErrorKey', () => {
  it('tells a missing match, the rate limit and a service failure apart', () => {
    expect(matchErrorKey({ status: 404 })).toBe('notFound')
    expect(matchErrorKey({ status: 400 })).toBe('notFound')
    expect(matchErrorKey(new Error('notFound'))).toBe('notFound') // пустой ответ: slimMatch бросает «notFound»
    expect(matchErrorKey({ status: 429 })).toBe('rateLimited')
  })

  it('treats 5xx as unavailable: the API answers 503 for a number that does not exist', () => {
    expect(matchErrorKey({ status: 503, message: 'HTTP 503' })).toBe('unavailable')
    expect(matchErrorKey({ status: 500 })).toBe('unavailable')
    expect(matchErrorKey({ status: 502 })).toBe('unavailable')
  })

  it('passes anything else through', () => {
    expect(matchErrorKey(new Error('Failed to fetch'))).toBe('Failed to fetch')
    expect(matchErrorKey(null)).toBe('unknown')
    expect(matchErrorKey(undefined)).toBe('unknown')
  })

  it('is what slimMatch errors resolve to', () => {
    let error
    try { slimMatch({}) } catch (e) { error = e }
    expect(matchErrorKey(error)).toBe('notFound')
  })
})

describe('leadRange', () => {
  const leads = (...values) => values.map((lead) => ({ lead }))

  it('keeps a balanced game symmetric', () => {
    const { up, down } = leadRange(leads(-8000, 0, 8000))
    expect(up).toBeCloseTo(8960)
    expect(down).toBeCloseTo(8960)
  })

  it('compresses the empty side of a one-sided game instead of wasting half of the chart', () => {
    const { up, down } = leadRange(leads(0, 5000, 10000))
    expect(up).toBeCloseTo(11200)
    expect(down).toBeCloseTo(11200 * 0.28) // нулевая линия ниже середины, но место для отметок на ней есть
    expect(down).toBeGreaterThan(0)
    // зеркально для победы команды 2
    const mirrored = leadRange(leads(0, -5000, -10000))
    expect(mirrored.down).toBeCloseTo(up)
    expect(mirrored.up).toBeCloseTo(down)
  })

  it('does not blow a tiny lead up into a mountain', () => {
    expect(leadRange(leads(0, 200, -100))).toEqual({ up: 1000, down: 1000 })
    expect(leadRange(leads(0, 0))).toEqual({ up: 1000, down: 1000 })
    expect(leadRange([])).toEqual({ up: 1000, down: 1000 })
  })

  it('fits every real point of a real match', () => {
    const points = soulsLead(slimMatch(ranked))
    const { up, down } = leadRange(points)
    expect(points.every((p) => p.lead <= up && -p.lead <= down)).toBe(true)
  })
})

describe('killFeed', () => {
  const match = slimMatch(ranked)
  const feed = killFeed(match)

  it('has one entry per death, sorted by time', () => {
    expect(feed).toHaveLength(match.players.reduce((s, p) => s + p.deathLog.length, 0))
    expect(feed.map((k) => k.time)).toEqual([...feed.map((k) => k.time)].sort((a, b) => a - b))
  })

  it('names the killer only when it is a player of the match', () => {
    const slots = new Set(match.players.map((p) => p.slot))
    feed.forEach((k) => {
      expect(slots.has(k.victim)).toBe(true)
      if (k.killer != null) expect(slots.has(k.killer)).toBe(true)
    })
    const stranger = slimMatch({ match_info: { players: [{ player_slot: 1, team: 0, death_details: [{ game_time_s: 10, killer_player_slot: 99 }] }] } })
    expect(killFeed(stranger)).toEqual([{ time: 10, victim: 1, killer: null }])
  })
})

describe('item log', () => {
  const log = [[10, 300, 0, 1], [20, 100, 0, 0], [11, 50, 400, 1], [20, 700, 0, 0], [12, 900, 0, 129]]
  const isUpgrade = (id) => [10, 11, 12].includes(id)

  it('splits purchases from ability points and sorts both by time', () => {
    const { purchases, abilities } = splitItemLog(log, isUpgrade)
    expect(purchases.map((p) => p.id)).toEqual([11, 10, 12])
    expect(abilities.map((a) => [a.id, a.at])).toEqual([[20, 100], [20, 700]])
  })

  it('the final build is what was bought and not sold', () => {
    const { purchases } = splitItemLog(log, isUpgrade)
    expect(finalBuild(purchases).map((p) => p.id)).toEqual([10, 12])
  })

  it('on a real match every player ends with at most 12 items, and sold items are excluded', () => {
    const match = slimMatch(ranked)
    match.players.forEach((player) => {
      // каталога под рукой нет: покупками считаем записи с upgrade_id = 1 — этого достаточно, чтобы проверить сам механизм
      const { purchases } = splitItemLog(player.items, (id) => player.items.some(([item, , , upgrade]) => item === id && upgrade === 1))
      expect(finalBuild(purchases).length).toBeLessThanOrEqual(12)
      expect(finalBuild(purchases).every((p) => p.soldAt === 0)).toBe(true)
    })
  })
})

describe('small helpers', () => {
  const match = slimMatch(ranked)

  it('finds players by slot and by account', () => {
    const bySlot = playersBySlot(match)
    expect(bySlot.size).toBe(12)
    expect(playerByAccount(match, match.players[3].account)).toBe(match.players[3])
    expect(playerByAccount(match, 123)).toBeNull()
    expect(playerByAccount(match, null)).toBeNull()
  })

  it('computes KDA with at least one death and the maximum for bars', () => {
    expect(kdaOf({ kills: 4, assists: 6, deaths: 0 })).toBe(10)
    expect(kdaOf({ kills: 4, assists: 6, deaths: 5 })).toBe(2)
    expect(maxOf(match, 'netWorth')).toBe(Math.max(...match.players.map((p) => p.netWorth)))
  })

  it('says who won, or nothing when the winner is unknown', () => {
    expect(teamWon(match, 0)).toBe(true)
    expect(teamWon(match, 1)).toBe(false)
    expect(teamWon({ winner: null }, 0)).toBeNull()
  })
})

describe('teamAverageBadge', () => {
  const rated = (team, badge) => ({ team, rank: { badge, change: 0 } })

  it('averages on the 6-subrank scale and rounds back to a badge', () => {
    // 85 и 86 — соседние подранги одного ранга: среднее ровно посередине, округляется вверх
    expect(teamAverageBadge({ players: [rated(0, 85), rated(0, 86)], badges: [null, null] }, 0)).toBe(86)
    expect(teamAverageBadge({ players: [rated(0, 81), rated(0, 81), rated(0, 81)], badges: [null, null] }, 0)).toBe(81)
    // Oracle 6 (86) и Phantom 1 (91) — соседние подранги на стыке рангов, а не «разрыв» между 86 и 91
    expect(teamAverageBadge({ players: [rated(0, 86), rated(0, 91)], badges: [null, null] }, 0)).toBe(91)
    // Emissary 1 (61) и Eternus 1 (111) — 30 подрангов друг от друга: середина — Oracle 4 (84)
    expect(teamAverageBadge({ players: [rated(0, 61), rated(0, 111)], badges: [null, null] }, 0)).toBe(84)
  })

  it('counts only the players of the team and skips the unrated', () => {
    const players = [rated(0, 41), rated(1, 111), { team: 0, rank: null }]
    expect(teamAverageBadge({ players, badges: [null, null] }, 0)).toBe(41)
    expect(teamAverageBadge({ players, badges: [null, null] }, 1)).toBe(111)
  })

  it('falls back to the API figure, then to nothing', () => {
    expect(teamAverageBadge({ players: [{ team: 0, rank: null }], badges: [93, null] }, 0)).toBe(93)
    expect(teamAverageBadge({ players: [{ team: 0, rank: null }], badges: [93, null] }, 1)).toBeNull()
  })

  it('stays inside the real rank range on real matches', () => {
    const match = slimMatch(ranked)
    for (const team of [0, 1]) {
      const badge = teamAverageBadge(match, team)
      expect(Math.floor(badge / 10)).toBe(11)
      expect(badge % 10).toBeGreaterThanOrEqual(1)
      expect(badge % 10).toBeLessThanOrEqual(6)
    }
    expect(teamAverageBadge(slimMatch(brawl), 0)).toBeNull()
  })
})
