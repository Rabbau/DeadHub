/**
 * @fileoverview Постеры героев для украшения страницы героя. Это официальные арты Valve из страницы обновления
 * Old Gods, New Blood (playdeadlock.com/oldgods); права на них у Valve (см. README, «Оформление и арты»). Постер есть
 * не у всех героев: у остальных страница просто без него. Чтобы добавить героя, положите арт в public/art
 * (WebP, до 120 КБ) и допишите строку: ключ — id героя в данных API.
 */
export const HERO_POSTERS = {
  65: '/art/hero-venator.webp',
  76: '/art/hero-graves.webp',
  77: '/art/hero-apollo.webp',
  79: '/art/hero-rem.webp',
  80: '/art/hero-silver.webp',
  81: '/art/hero-celeste.webp',
};

/**
 * Постер героя или null, если его нет.
 * @param {number|string} heroId
 * @returns {string|null}
 */
export function heroPoster(heroId) {
  return HERO_POSTERS[Number(heroId)] ?? null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Постер дня для почти пустых страниц (поиск игрока, «Мой профиль»): по номеру суток по UTC выбирается один из
 * имеющихся постеров, поэтому в течение дня он у всех один и тот же, а на следующий день меняется.
 * @param {number} [nowMs]
 * @returns {string}
 */
export function posterOfTheDay(nowMs = Date.now()) {
  const posters = Object.values(HERO_POSTERS);
  const day = Math.floor(nowMs / DAY_MS);
  // Остаток от деления для дат до 1970 года отрицательный — приводим его к положительному
  return posters[((day % posters.length) + posters.length) % posters.length];
}
