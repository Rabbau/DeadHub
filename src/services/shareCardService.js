/**
 * @fileoverview Картинка профиля для публикации: что на ней написано и как называется файл. Без DOM и без API;
 * саму картинку рисует src/components/player/shareCardCanvas.js (canvas в браузере посетителя, на сервер ничего
 * не уходит). Здесь только модель — какие цифры, какие герои, какая полоса результатов — и она проверяется тестами.
 */
import { badgeImage, formatBadge } from './rankService.js';
import { formatNumber } from './format.js';
import { formatWinrate } from './heroService.js';
import { statsMatches, summarizeRows } from './playerHistoryService.js';
import { summarizeHeroStats, topHeroes } from './playerService.js';
import { SITE_URL } from './siteMeta.js';

export const CARD = {
  WIDTH: 1200,
  HEIGHT: 630,
  /** Сколько любимых героев и сколько последних результатов на картинке. */
  HEROES: 3,
  STRIP: 10,
  /** Сколько последних матчей в подписи «форма» и сколько нужно, чтобы её показывать. */
  FORM_WINDOW: 20,
  FORM_MIN: 8,
};

/**
 * Имя файла: «dead-hub-<ник>-<id>.png». Ник приводится к латинице, цифрам и дефисам — в имени файла нельзя ни слэши,
 * ни кавычки, ни управляющие знаки; если от ника ничего не осталось (кириллица, иероглифы), берётся одно ID.
 * @param {string|null|undefined} name
 * @param {number} accountId
 */
export function cardFileName(name, accountId) {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 24)
    .replace(/-+$/g, '');
  return slug ? `dead-hub-${slug}-${accountId}.png` : `dead-hub-${accountId}.png`;
}

/**
 * Подгоняет текст под ширину: если не помещается, обрезает и ставит многоточие.
 * @param {string} text
 * @param {number} maxWidth
 * @param {(text: string) => number} measure ширина строки в пикселях (ctx.measureText)
 */
export function fitText(text, maxWidth, measure) {
  const value = String(text ?? '');
  if (measure(value) <= maxWidth) return value;
  let low = 0;
  let high = value.length;
  // Бинарный поиск самой длинной начальной части, которая вместе с многоточием помещается
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(`${value.slice(0, mid).trimEnd()}…`) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low > 0 ? `${value.slice(0, low).trimEnd()}…` : '…';
}

/**
 * Что нарисовать на картинке.
 * @param {{
 *   accountId: number,
 *   steam: { name?: string, avatar?: string|null }|null,
 *   rank: { badge: number }|null,
 *   history: any[],
 *   heroStats: any[],
 *   heroes: Array<{ id: number, name: string, icon_url?: string|null, image_url?: string|null }>,
 *   ranks: any[],
 * }} input
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @param {string} language
 */
export function buildShareModel({ accountId, steam, rank, history, heroStats, heroes, ranks }, t, language) {
  const summary = summarizeHeroStats(heroStats);
  const recent = statsMatches(history);
  const badge = rank?.badge ?? history.find((row) => row.badge)?.badge ?? null;
  const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
  const matches = summary.matches || history.length;

  const formRows = recent.slice(0, CARD.FORM_WINDOW);
  const form = formRows.length >= CARD.FORM_MIN
    ? {
      results: recent.slice(0, CARD.STRIP).map((row) => row.win),
      caption: t('share.form', { count: formRows.length, winrate: formatWinrate(summarizeRows(formRows).winrate) }),
    }
    : null;

  return {
    name: steam?.name ?? `#${accountId}`,
    idLine: `ID ${accountId}`,
    avatarUrl: steam?.avatar ?? null,
    badge: badge ? { label: formatBadge(ranks, badge), image: badgeImage(ranks, badge) } : null,
    stats: [
      { key: 'matches', label: t('player.matches'), value: formatNumber(matches, language) },
      { key: 'winrate', label: t('player.winrate'), value: summary.matches ? formatWinrate(summary.winrate) : '—' },
      { key: 'kda', label: t('player.kda'), value: summary.matches ? summary.kda.toFixed(2) : '—' },
      { key: 'accuracy', label: t('player.accuracy'), value: summary.accuracy ? formatWinrate(summary.accuracy) : '—' },
    ],
    heroesTitle: t('player.topHeroes'),
    heroes: topHeroes(heroStats, CARD.HEROES).map((row) => {
      const hero = heroById.get(row.heroId);
      return {
        heroId: row.heroId,
        name: hero?.name ?? `#${row.heroId}`,
        icon: hero?.icon_url ?? hero?.image_url ?? null,
        matches: formatNumber(row.matches, language),
        winrate: row.matches ? formatWinrate(row.wins / row.matches) : '—',
      };
    }),
    form,
    footer: `${SITE_URL.replace(/^https?:\/\//, '')}/player/${accountId}`,
    note: t('share.note'),
  };
}
