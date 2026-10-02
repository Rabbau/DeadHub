/**
 * @fileoverview Распределение игроков по рангам и положение игрока в нём. Без React и без API.
 *
 * API отдаёт одну строку на бейдж (тир 1–11 × подранг 1–6) с числом игроков. Положение считаем по доле игроков
 * ниже: «лучше, чем у N% игроков» — ровно половина игроков с тем же бейджем считается «ниже», чтобы середина
 * бейджа не округлялась ни вверх, ни вниз.
 */

/**
 * Облегчённое распределение: по тирам, внутри — по подрангам.
 * @param {Array<{ rank: number, subrank: number, players: number }>} rows ответ /v1/players/rank/distribution
 * @returns {{ total: number, tiers: Array<{ tier: number, players: number, subs: Array<{ sub: number, players: number }> }> }}
 *   tiers по возрастанию ранга; игроков в тире и всего — суммы по подрангам
 */
export function slimDistribution(rows) {
  const byTier = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const tier = Number(row?.rank);
    const sub = Number(row?.subrank);
    const players = Number(row?.players) || 0;
    if (!Number.isInteger(tier) || tier < 1 || !Number.isInteger(sub) || sub < 1) return;
    if (!byTier.has(tier)) byTier.set(tier, new Map());
    const subs = byTier.get(tier);
    subs.set(sub, (subs.get(sub) ?? 0) + players);
  });

  const tiers = [...byTier.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tier, subs]) => {
      const list = [...subs.entries()].sort(([a], [b]) => a - b).map(([sub, players]) => ({ sub, players }));
      return { tier, players: list.reduce((sum, item) => sum + item.players, 0), subs: list };
    });

  return { total: tiers.reduce((sum, tier) => sum + tier.players, 0), tiers };
}

/**
 * Где в распределении бейдж игрока.
 * @param {ReturnType<typeof slimDistribution>} distribution
 * @param {number} badge тир × 10 + подранг (например, 86 — Oracle 6)
 * @returns {{ below: number, own: number, total: number, betterThan: number, topPercent: number }|null}
 *   betterThan — доля игроков, которых игрок обошёл (0..1); topPercent — «в топ-N%» (0..100, не меньше 0,1)
 */
export function positionOf(distribution, badge) {
  if (!distribution || distribution.total <= 0 || !badge) return null;
  const tier = Math.floor(badge / 10);
  const sub = badge % 10;

  let below = 0;
  let own = 0;
  let found = false;
  distribution.tiers.forEach((entry) => {
    entry.subs.forEach((item) => {
      const value = entry.tier * 10 + item.sub;
      if (value < tier * 10 + sub) below += item.players;
      else if (value === tier * 10 + sub) { own = item.players; found = true; }
    });
  });
  if (!found) return null;

  const betterThan = (below + own / 2) / distribution.total;
  return {
    below,
    own,
    total: distribution.total,
    betterThan,
    topPercent: Math.max(0.1, Math.round((1 - betterThan) * 1000) / 10),
  };
}

/** Доля тира среди всех игроков (0..1). */
export function tierShare(distribution, tier) {
  if (!distribution || distribution.total <= 0) return 0;
  return (distribution.tiers.find((entry) => entry.tier === tier)?.players ?? 0) / distribution.total;
}
