/**
 * @fileoverview Сравнение героев: оси радара, показатели с лидером, общие для всех характеристики и выбор героев.
 * Не знает ни про React, ни про API.
 */

export const MAX_COMPARED = 3;

/** Цвета героев по порядку выбора: на графике, в карточках, в полосках и на плитках выбора одни и те же. */
export const COMPARE_COLORS = ['var(--acid)', 'var(--amber)', 'var(--violet)'];

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Доля в процентах: API отдаёт то долю, то проценты, поэтому всё, что не больше 1, считается долей. */
const percent = (rate) => {
  const value = num(rate);
  if (value === null) return null;
  // Округление до тысячных процента убирает хвосты вида 60.199999999999996 от умножения доли на сто
  return Math.round((value > 1 ? value : value * 100) * 1000) / 1000;
};

// ── Выбор героев ──────────────────────────────────────────────────

/**
 * Что станет с выбором после щелчка по герою: выбранного снимает, новому находит место, а если мест нет —
 * вытесняет того, кого выбрали раньше всех.
 * @param {number[]} ids
 * @param {number} id
 */
export function nextSelection(ids, id) {
  if (ids.includes(id)) return ids.filter((existing) => existing !== id);
  if (ids.length < MAX_COMPARED) return [...ids, id];
  return [...ids.slice(1), id];
}

/** Выбранные герои в порядке выбора (а не в порядке списка): первый всегда оранжевый, второй жёлтый. Неизвестные id пропускаются. */
export function pickSelected(heroes, ids) {
  return ids.map((id) => heroes.find((hero) => hero.id === id)).filter(Boolean);
}

/** Герои на плитках выбора: по названию и роли. */
export function filterPicker(heroes, { search = '', role = 'all' } = {}) {
  const query = search.trim().toLowerCase();
  return heroes.filter((hero) => (
    (!query || hero.name.toLowerCase().includes(query))
    && (role === 'all' || hero.role?.toLowerCase() === role.toLowerCase())
  ));
}

// ── Показатели ────────────────────────────────────────────────────

const perLevel = (key) => (hero) => num(hero.levelScaling?.[key]);

/**
 * Числовые показатели героя, которые можно сравнивать. label — ключ локали, get — значение (или null, если
 * его нет), perLevel — рост за уровень, meta — показатель меты (винрейт и пикрейт: «одинаково у всех» для них не пишем).
 */
export const COMPARE_STATS = [
  { id: 'winrate', label: 'compare.winrate', get: (hero) => percent(hero.stats?.winrate), percent: true, meta: true },
  { id: 'health', label: 'compare.health', get: (hero) => num(hero.stats?.maxHealth), perLevel: perLevel('healthPerLevel') },
  { id: 'moveSpeed', label: 'compare.moveSpeed', get: (hero) => num(hero.stats?.maxMoveSpeed) },
  { id: 'sprint', label: 'compare.sprintSpeed', get: (hero) => num(hero.stats?.sprintSpeed) },
  { id: 'heavyMelee', label: 'compare.heavyMelee', get: (hero) => num(hero.stats?.heavyMeleeDamage), perLevel: perLevel('meleeDamagePerLevel') },
  { id: 'lightMelee', label: 'compare.lightMelee', get: (hero) => num(hero.stats?.lightMeleeDamage), perLevel: perLevel('meleeDamagePerLevel') },
  { id: 'stamina', label: 'compare.stamina', get: (hero) => num(hero.stats?.stamina) },
  { id: 'healthRegen', label: 'compare.healthRegen', get: (hero) => num(hero.stats?.healthRegen) },
  { id: 'groundDash', label: 'compare.groundDash', get: (hero) => num(hero.stats?.groundDashDistance) },
  { id: 'airDash', label: 'compare.airDash', get: (hero) => num(hero.stats?.airDashDistance) },
  { id: 'pickrate', label: 'compare.pickrate', get: (hero) => percent(hero.stats?.pickrate), percent: true, meta: true },
];

/** Значение показателя для подписи: проценты с десятой, остальное — без хвоста нулей. */
export function formatStat(stat, value) {
  if (value === null || value === undefined) return '—';
  return stat.percent ? `${value.toFixed(1)}%` : String(Number(value.toFixed(2)));
}

/** Рост за уровень: «+43» (подпись «/ур» добавляет вызывающий — она зависит от языка). */
export function formatPerLevel(value) {
  return value ? `+${Number(value.toFixed(2))}` : '';
}

/**
 * Показатели, по которым выбранные герои различаются, — с лидером (кто больше), и те, что у всех одинаковы.
 * Показатель, которого нет хотя бы у одного героя, не сравнивается. Для одного героя сравнивать не с чем.
 * @param {any[]} heroes
 * @returns {{
 *   differing: Array<{ stat: typeof COMPARE_STATS[number], values: number[], best: number, leaders: number[], extras: Array<number|null> }>,
 *   identical: Array<{ stat: typeof COMPARE_STATS[number], value: number }>,
 * }}
 */
export function compareStats(heroes) {
  const differing = [];
  const identical = [];
  if (heroes.length < 2) return { differing, identical };

  COMPARE_STATS.forEach((stat) => {
    const values = heroes.map(stat.get);
    if (values.some((value) => value === null)) return;
    if (values.every((value) => value === values[0])) {
      if (!stat.meta) identical.push({ stat, value: values[0] });
      return;
    }
    const best = Math.max(...values);
    differing.push({
      stat,
      values,
      best,
      leaders: values.flatMap((value, index) => (value === best ? [index] : [])),
      extras: heroes.map((hero) => stat.perLevel?.(hero) ?? null),
    });
  });
  return { differing, identical };
}

/** Мета героя для карточки: винрейт с тоном (хорошо / нейтрально / плохо), пикрейт, число матчей. */
export function heroMeta(hero) {
  const winrate = percent(hero.stats?.winrate);
  const tone = winrate === null ? 'neutral' : winrate >= 52 ? 'good' : winrate >= 48 ? 'neutral' : 'bad';
  return { winrate, tone, pickrate: percent(hero.stats?.pickrate), matches: num(hero.stats?.games_played) };
}

// ── Радар ─────────────────────────────────────────────────────────

/** Оси радара: что у героя можно мерить в одних и тех же единицах «слабее — сильнее». */
export const RADAR_AXES = [
  { id: 'health', label: 'compare.health', get: (hero) => num(hero.stats?.maxHealth) },
  { id: 'moveSpeed', label: 'compare.moveSpeed', get: (hero) => num(hero.stats?.maxMoveSpeed) },
  { id: 'sprint', label: 'compare.sprintSpeed', get: (hero) => num(hero.stats?.sprintSpeed) },
  { id: 'melee', label: 'compare.axisMelee', get: (hero) => num(hero.stats?.heavyMeleeDamage) },
  { id: 'complexity', label: 'compare.complexity', get: (hero) => num(hero.complexity) },
];

/** Нижняя граница оси: самый слабый герой — не нуль в центре, а заметная точка, иначе фигура схлопывается. */
export const RADAR_FLOOR = 0.14;

/**
 * Оси радара с диапазоном значений по всем героям игры: шкала каждой оси — от самого слабого до самого сильного.
 * Ось, на которой все герои одинаковы, не нужна — на ней ничего не сравнить.
 * @param {any[]} roster
 * @returns {Array<{ id: string, label: string, get: (hero: any) => number|null, min: number, max: number }>}
 */
export function radarAxes(roster) {
  return RADAR_AXES.flatMap((axis) => {
    const values = roster.map(axis.get).filter((value) => value !== null);
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return max > min ? [{ ...axis, min, max }] : [];
  });
}

/** Доля оси от RADAR_FLOOR до 1; нет значения — самое слабое. */
export function radarLevel(axis, hero) {
  const value = axis.get(hero);
  if (value === null) return RADAR_FLOOR;
  return RADAR_FLOOR + (1 - RADAR_FLOOR) * ((value - axis.min) / (axis.max - axis.min));
}

/**
 * Точка оси `index` из `count` на расстоянии `level` (0..1) от центра; первая ось смотрит вверх, дальше по часовой.
 * @returns {[number, number]}
 */
export function radarPoint(index, count, level, { cx, cy, radius }) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return [cx + Math.cos(angle) * radius * level, cy + Math.sin(angle) * radius * level];
}
