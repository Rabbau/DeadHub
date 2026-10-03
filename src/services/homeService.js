/**
 * @fileoverview Главная страница: какие разделы сайта на ней показаны и как подписаны цифры. Без React и без API.
 */
import { CURRENT_UPDATE, isHighlightsActive } from '../data/updates.js';
import { PATCH_PERIOD, describeFilters } from './statsFilters.js';
import { TIER_ORDER } from './tierService.js';

/**
 * Разделы сайта в оглавлении главной: адрес, ключ названия (то же, что в меню) и id описания
 * (`home.sections.<id>` в локалях). Порядок — по задачам, а не по меню: герои и мета, предметы, мир игры, игроки.
 * Тест сверяет список с маршрутами App.jsx: новая страница без строки в оглавлении не проходит.
 */
export const HOME_SECTIONS = [
  { id: 'heroes', to: '/heroes', nameKey: 'nav.heroes' },
  { id: 'meta', to: '/meta', nameKey: 'nav.meta' },
  { id: 'tierlist', to: '/tierlist', nameKey: 'nav.tierlist' },
  { id: 'matchups', to: '/matchups', nameKey: 'nav.matchups' },
  { id: 'draft', to: '/draft', nameKey: 'nav.draft' },
  { id: 'compare', to: '/compare', nameKey: 'nav.compare' },
  { id: 'items', to: '/items', nameKey: 'nav.items' },
  { id: 'build', to: '/build', nameKey: 'nav.randomBuild' },
  { id: 'calculator', to: '/calculator', nameKey: 'nav.calculator' },
  { id: 'crosshair', to: '/crosshair', nameKey: 'nav.crosshair' },
  { id: 'map', to: '/map', nameKey: 'nav.map' },
  { id: 'update', to: '/update', nameKey: 'nav.update' },
  { id: 'live', to: '/live', nameKey: 'nav.live' },
  { id: 'players', to: '/players', nameKey: 'nav.players' },
  { id: 'versus', to: '/versus', nameKey: 'nav.versus' },
  { id: 'leaderboard', to: '/leaderboard', nameKey: 'nav.leaderboard' },
  { id: 'ranks', to: '/ranks', nameKey: 'nav.ranks' },
  { id: 'me', to: '/me', nameKey: 'nav.myProfile' },
  { id: 'favorites', to: '/favorites', nameKey: 'nav.favorites' },
];

/** Сколько героев показываем в каждом из рейтингов на главной. */
export const HOME_TOP_COUNT = 5;

/** Сколько героев каждого тира показывает витрина тир-листа и сколько имён героев — быстрые ссылки у поиска. */
export const HOME_TIER_HEROES = 4;
export const HOME_QUICK_HEROES = 2;

/** Порядковый номер строки оглавления для оформления: 1 → «01». */
export function tileNumber(index) {
  return String(index + 1).padStart(2, '0');
}

/**
 * Герои тир-листа для витрины: первые `perTier` каждого тира, по порядку S → D. Тир без героев в список не попадает.
 * @param {Record<string, Array<{ hero: object }>>} tiers — `tiers` из buildTierList
 * @param {number} [perTier]
 * @returns {Array<{ tier: string, heroes: object[] }>}
 */
export function tierPreview(tiers, perTier = HOME_TIER_HEROES) {
  return TIER_ORDER
    .map((tier) => ({ tier, heroes: (tiers?.[tier] ?? []).slice(0, perTier).map((entry) => entry.hero) }))
    .filter((row) => row.heroes.length > 0);
}

/**
 * Арты баннера: пока обновление свежее — арты этого обновления, потом `null` (баннер без привязки к нему).
 * @param {typeof CURRENT_UPDATE} [update]
 * @param {number} [nowMs]
 */
export function bannerArt(update = CURRENT_UPDATE, nowMs = Date.now()) {
  return update.art && isHighlightsActive(nowMs, update) ? update.art : null;
}

/** Дата выхода обновления в секундах Unix. Берётся полдень по UTC: почти во всех часовых поясах это тот же календарный день. */
export function updateDate(update = CURRENT_UPDATE) {
  return Date.parse(`${update.date}T12:00:00Z`) / 1000;
}

/**
 * Подпись «за какие данные цифры»: «С патча · Ранг: Все», «30 дней · Ранг: Высокие», в Street Brawl — режим
 * вместо рангов. Названия берёт у `t`, поэтому годится для любого языка.
 * @param {{ period: number|'patch', rankMin: number, rankMax: number, mode?: string }} filters
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 */
export function summarizeFilters(filters, t) {
  const { period, rankPreset, streetBrawl } = describeFilters(filters);
  const periodLabel = period === PATCH_PERIOD ? t('filters.sincePatch') : t('filters.days', { count: period });
  if (streetBrawl) return `${periodLabel} · ${t('filters.modes.street_brawl')}`;
  const ranks = rankPreset ? t(`filters.presets.${rankPreset}`) : t('home.customRanks');
  return `${periodLabel} · ${t('filters.rank')}: ${ranks}`;
}
