/**
 * @fileoverview Бейджи рангов. badge = tier * 10 + subtier, где tier 1..11 (Initiate … Eternus),
 * subtier 1..6. Названия и картинки приходят из assets API (см. ranksApi).
 */

export function badgeTier(badge) {
  return Math.floor(badge / 10);
}

export function badgeSubtier(badge) {
  return badge % 10;
}

/**
 * @param {Array<{ tier: number, name: string }>} ranks
 * @param {number} tier
 */
export function findRank(ranks, tier) {
  return ranks.find((rank) => rank.tier === tier) ?? null;
}

/**
 * «Oracle 6». Пока ранги не загрузились — «8.6», чтобы не показывать пустоту.
 * @returns {string|null} null, если бейджа нет
 */
export function formatBadge(ranks, badge) {
  if (!badge) return null;
  const tier = badgeTier(badge);
  const sub = badgeSubtier(badge);
  const rank = findRank(ranks, tier);
  return rank ? `${rank.name} ${sub}` : `${tier}.${sub}`;
}

/** Картинка бейджа с подрангом, а если её нет — общая картинка ранга. */
export function badgeImage(ranks, badge) {
  if (!badge) return null;
  const rank = findRank(ranks, badgeTier(badge));
  if (!rank) return null;
  return rank.sub[badgeSubtier(badge)] ?? rank.large;
}
