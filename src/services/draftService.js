/**
 * @fileoverview Подбор героя против вражеской команды по матрицам контрпиков и синергий. Без React и без API.
 *
 * Как это считается — и почему не «просто винрейт против героя»:
 *
 * Винрейт героя против соперника почти целиком объясняется силой самого соперника. На реальных данных
 * (30 дней, все ранги) 95% разброса «винрейт против героя минус общий винрейт» — это сила соперника
 * (наклон 0,98 к его отклонению от 50%), а настоящий контр-эффект пары — около ±0,7 пп. Поэтому у каждой пары
 * считаем ЧИСТЫЙ эффект: вклад именно этой пары, без силы самих героев.
 *
 *   контрпик:  чистый = WR(A против e) − WR(A) + (WR(e) − ½)
 *   синергия:  чистый = WR(A с a)     − WR(A) − (WR(a) − ½)
 *
 * Чистые эффекты малы, а выборка пары конечна, поэтому каждый сглаживается к нулю (эмпирический Байес):
 * вес = τ² / (τ² + σ²), где σ² — шум винрейта пары (p·(1−p)/n), а τ² — дисперсия настоящих эффектов, которую
 * мы оцениваем по самой матрице (дисперсия чистых эффектов минус средний шум). Чем короче период и уже ранги,
 * тем больше шума и тем сильнее сглаживание; если данные неотличимы от шума, ранжирование идёт по силе героя.
 *
 *   скорректированный WR = WR героя + Σ сглаженных контр-эффектов + Σ сглаженных синергий
 *
 * Сила врагов и союзников у всех кандидатов одинакова, поэтому в оценку не входит: она сдвинула бы все числа
 * на одну величину и не повлияла бы на выбор. Модель складывает вклады героев и не знает ни про линии, ни про
 * сборки, ни про умение игроков — это подсказка, а не прогноз матча.
 */
import { minGamesFor } from './tierService.js';

/** Сколько героев можно отметить в командах (Deadlock — 6 на 6, один из союзников — вы). */
export const MAX_ENEMIES = 6;
export const MAX_ALLIES = 5;

/** Пары с меньшей выборкой не участвуют в оценке разброса настоящих эффектов: шум в них слишком велик. */
const MIN_PAIR_MATCHES = 100;

/** Нижняя граница дисперсии настоящих эффектов: даже при чистом шуме делить на ноль нельзя. */
const MIN_TAU2 = 1e-8;

/** Режимы выбора героя на странице: куда попадает нажатый герой. */
export const DRAFT_LISTS = ['enemies', 'allies', 'excluded'];

/**
 * Общий винрейт героя по его строке матрицы: победы / матчи против всех (или с всеми).
 * @param {Map<number, Map<number, { wins: number, matches: number }>>} index
 * @returns {Map<number, number>}
 */
export function baselinesOf(index) {
  const result = new Map();
  index.forEach((row, hero) => {
    let wins = 0;
    let matches = 0;
    row.forEach((cell) => {
      wins += cell.wins;
      matches += cell.matches;
    });
    if (matches > 0) result.set(hero, wins / matches);
  });
  return result;
}

/** Чистый эффект пары (формулы — в описании модуля). kind: 'counter' | 'synergy'. */
export function pureEffect(kind, wr, ownBase, otherBase) {
  const strength = otherBase - 0.5;
  return kind === 'counter' ? wr - ownBase + strength : wr - ownBase - strength;
}

/** Шум винрейта пары: дисперсия доли при n матчах (p·(1−p) не даём нулю, чтобы пара с 0% или 100% не «знала всё»). */
function noiseVariance(wr, matches) {
  return Math.max(wr * (1 - wr), 0.01) / matches;
}

/**
 * Дисперсия настоящих эффектов (τ²) по всей матрице.
 * @param {Map<number, Map<number, { wins: number, matches: number, wr: number }>>} index
 * @param {'counter'|'synergy'} kind
 * @param {Map<number, number>} baselines baselinesOf(index)
 * @returns {number}
 */
export function estimateTau2(index, kind, baselines) {
  let sum = 0;
  let count = 0;
  index.forEach((row, hero) => {
    const own = baselines.get(hero);
    if (own == null) return;
    row.forEach((cell, other) => {
      if (cell.matches < MIN_PAIR_MATCHES) return;
      const otherBase = baselines.get(other);
      if (otherBase == null) return;
      const effect = pureEffect(kind, cell.wr, own, otherBase);
      sum += effect * effect - noiseVariance(cell.wr, cell.matches);
      count++;
    });
  });
  return count ? Math.max(MIN_TAU2, sum / count) : MIN_TAU2;
}

/**
 * Эффект пары (герой, другой герой) или null, если такой пары нет в данных.
 * pure — чистый эффект как есть, weight — доверие к нему (0..1), effect = weight × pure — сглаженный вклад.
 */
function pairEffect(kind, index, baselines, tau2, heroId, otherId) {
  const cell = index.get(heroId)?.get(otherId);
  const own = baselines.get(heroId);
  const otherBase = baselines.get(otherId);
  if (!cell || own == null || otherBase == null) return null;

  const pure = pureEffect(kind, cell.wr, own, otherBase);
  const weight = tau2 / (tau2 + noiseVariance(cell.wr, cell.matches));
  return { id: otherId, wr: cell.wr, matches: cell.matches, pure, weight, effect: weight * pure };
}

/** Насколько можно верить вкладу пар: high — цифры почти не сглажены, low — по сути шум. */
export function certaintyLevel(certainty) {
  if (certainty >= 0.6) return 'high';
  if (certainty >= 0.3) return 'medium';
  return 'low';
}

/**
 * Рейтинг героев для текущего драфта.
 * Кандидаты — герои, которых ещё нет ни среди врагов, ни среди союзников, ни среди недоступных, и у которых
 * в выборке достаточно матчей (как в тир-листе): иначе общий винрейт ненадёжен.
 * @param {{
 *   heroes: Array<{ id: number, name: string, role?: string|null, released?: boolean, stats: { winrate: number, games_played: number } }>,
 *   counters: Map<number, Map<number, { wins: number, matches: number, wr: number }>>,
 *   synergy: Map<number, Map<number, { wins: number, matches: number, wr: number }>>,
 *   enemies?: number[], allies?: number[], excluded?: number[], role?: string
 * }} input
 * @returns {{
 *   rows: Array<{
 *     hero: object, base: number, adjusted: number, advantage: number, certainty: number,
 *     counter: { total: number, items: Array<object|{ id: number, missing: true }> },
 *     synergy: { total: number, items: Array<object|{ id: number, missing: true }> },
 *     coverage: { used: number, requested: number }
 *   }>,
 *   tau: { counter: number, synergy: number },
 *   minGames: number
 * }} tau — типичный «чистый» эффект пары в долях (0,007 = 0,7 пп)
 */
export function rankDraft({ heroes, counters, synergy, enemies = [], allies = [], excluded = [], role = 'all' }) {
  const counterBase = baselinesOf(counters);
  const synergyBase = baselinesOf(synergy);
  const tauCounter = estimateTau2(counters, 'counter', counterBase);
  const tauSynergy = estimateTau2(synergy, 'synergy', synergyBase);

  const released = heroes.filter((hero) => hero.released !== false);
  const minGames = minGamesFor(released.reduce((sum, hero) => sum + hero.stats.games_played, 0));
  const taken = new Set([...enemies, ...allies, ...excluded]);

  const rows = released
    .filter((hero) => !taken.has(hero.id) && hero.stats.games_played >= minGames && (role === 'all' || hero.role === role))
    .map((hero) => {
      const counterItems = enemies.map((id) => pairEffect('counter', counters, counterBase, tauCounter, hero.id, id) ?? { id, missing: true });
      const synergyItems = allies.map((id) => pairEffect('synergy', synergy, synergyBase, tauSynergy, hero.id, id) ?? { id, missing: true });

      const used = [...counterItems, ...synergyItems].filter((item) => !item.missing);
      const counterTotal = counterItems.reduce((sum, item) => sum + (item.effect ?? 0), 0);
      const synergyTotal = synergyItems.reduce((sum, item) => sum + (item.effect ?? 0), 0);
      const base = hero.stats.winrate;

      return {
        hero,
        base,
        advantage: counterTotal + synergyTotal,
        adjusted: base + counterTotal + synergyTotal,
        // Без выбранных героев сглаживать нечего — доверие полное
        certainty: used.length ? used.reduce((sum, item) => sum + item.weight, 0) / used.length : 1,
        counter: { total: counterTotal, items: counterItems },
        synergy: { total: synergyTotal, items: synergyItems },
        coverage: { used: used.length, requested: counterItems.length + synergyItems.length },
      };
    })
    // При равной оценке выше сильнее герой, затем — по названию: порядок не «прыгает»
    .sort((a, b) => b.adjusted - a.adjusted || b.base - a.base || a.hero.name.localeCompare(b.hero.name));

  return { rows, tau: { counter: Math.sqrt(tauCounter), synergy: Math.sqrt(tauSynergy) }, minGames };
}

// ── Выбор героев на странице ─────────────────────────────────────────────────

const LIMITS = { enemies: MAX_ENEMIES, allies: MAX_ALLIES, excluded: Infinity };

/** Пустой драфт. */
export const EMPTY_SELECTION = Object.freeze({ enemies: [], allies: [], excluded: [] });

/** Занят ли выбранный список целиком. */
export function isListFull(selection, list) {
  return selection[list].length >= LIMITS[list];
}

/**
 * Нажатие на героя в режиме `list`: убирает героя из этого списка, если он там уже был, иначе добавляет
 * (и убирает из другого списка — один герой не бывает одновременно врагом и союзником). Если список заполнен,
 * возвращает тот же объект selection — по этому сравнению интерфейс понимает, что места нет.
 * @param {{ enemies: number[], allies: number[], excluded: number[] }} selection
 * @param {'enemies'|'allies'|'excluded'} list
 * @param {number} heroId
 */
export function toggleHero(selection, list, heroId) {
  if (selection[list].includes(heroId)) {
    return { ...selection, [list]: selection[list].filter((id) => id !== heroId) };
  }
  if (isListFull(selection, list)) return selection;

  const next = { enemies: [], allies: [], excluded: [] };
  DRAFT_LISTS.forEach((key) => {
    next[key] = selection[key].filter((id) => id !== heroId);
  });
  next[list] = [...next[list], heroId];
  return next;
}

/** Герои из адреса (`?e=1,2&a=3&x=4`): только известные, без повторов, не больше лимита; первое упоминание главнее. */
export function parseSelection(params, validIds) {
  const valid = validIds instanceof Set ? validIds : new Set(validIds);
  const seen = new Set();
  const read = (key, limit) => {
    const ids = [];
    String(params.get(key) ?? '')
      .split(',')
      .map((part) => Number(part))
      .forEach((id) => {
        if (Number.isInteger(id) && valid.has(id) && !seen.has(id) && ids.length < limit) {
          seen.add(id);
          ids.push(id);
        }
      });
    return ids;
  };
  return { enemies: read('e', MAX_ENEMIES), allies: read('a', MAX_ALLIES), excluded: read('x', Infinity) };
}

/**
 * Строка запроса для адреса (`?e=1,2&a=3&x=4&r=Brawler`) с запятыми как есть: читается и руками, и parseSelection.
 * Пустые списки и роль «все» в адрес не попадают; без выбора — пустая строка.
 */
export function selectionSearch(selection, role = 'all') {
  const parts = [];
  if (selection.enemies.length) parts.push(`e=${selection.enemies.join(',')}`);
  if (selection.allies.length) parts.push(`a=${selection.allies.join(',')}`);
  if (selection.excluded.length) parts.push(`x=${selection.excluded.join(',')}`);
  if (role && role !== 'all') parts.push(`r=${encodeURIComponent(role)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Обратное к parseSelection: пустые списки в адрес не попадают. */
export function selectionParams(selection) {
  const params = {};
  if (selection.enemies.length) params.e = selection.enemies.join(',');
  if (selection.allies.length) params.a = selection.allies.join(',');
  if (selection.excluded.length) params.x = selection.excluded.join(',');
  return params;
}
