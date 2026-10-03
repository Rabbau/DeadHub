/**
 * @fileoverview Сводка последних матчей для карточки избранного игрока: когда играл, как закончились последние матчи,
 * форма, серия, ранг и любимые герои. Без React и без API. Отдельно от favoritesService.js: разбор истории матчей
 * нужен только странице «Избранное» и запросу сводки, а не меню и странице героя.
 */
import { currentStreak, summarizeRows, MODE_RANKED, MODE_UNRANKED } from './playerHistoryService.js';

/** Сколько матчей берём для сводки «последние матчи» и сколько результатов показываем полосой. */
export const CARD_WINDOW = 20;
export const CARD_STRIP = 5;
const CARD_HEROES = 3;

/**
 * Сводка последних матчей для карточки избранного игрока: когда играл, как закончились последние пять матчей,
 * винрейт и KDA за последние двадцать, серия, ранг и любимые герои. Из истории Steam (она полная и свежая), поэтому
 * для всех игроков одинакова и не зависит от того, принял ли матчи анализ API. Матчи с ботами и кастомные не считаются.
 * @param {Array<{ at: number, win: boolean, heroId: number, kills: number, deaths: number, assists: number, mode: number, badge: number|null }>} history новые сверху
 */
export function summarizeForCard(history) {
  const real = (history || []).filter((row) => row.mode === MODE_RANKED || row.mode === MODE_UNRANKED);
  const last = real.slice(0, CARD_WINDOW);

  const counts = new Map();
  for (const row of last) counts.set(row.heroId, (counts.get(row.heroId) ?? 0) + 1);
  const heroes = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, CARD_HEROES).map(([heroId]) => heroId);

  return {
    lastMatchAt: real[0]?.at ?? null,
    results: real.slice(0, CARD_STRIP).map((row) => row.win),
    recent: summarizeRows(last),
    streak: currentStreak(real),
    // История идёт от новых к старым, поэтому первый бейдж — самый свежий
    badge: (history || []).find((row) => row.badge)?.badge ?? null,
    heroes,
  };
}
