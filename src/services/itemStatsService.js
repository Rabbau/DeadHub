/**
 * @fileoverview Таблица предметов со статистикой: связывает каталог предметов с результатами item-stats,
 * считает винрейт и частоту покупки, сортирует. Без React и без API.
 *
 * Частота покупки — доля матчей, в которых предмет купили: matches предмета ÷ матчи, от которых считаем
 * (все пики выборки или матчи выбранного героя). У предметов с малой выборкой винрейт случаен: в сортировке
 * по цифрам они всегда уходят в конец, чтобы «лучшим предметом» не оказался тот, что купили 20 раз.
 */
import { getPriceTierKey } from './itemService.js';

/** Меньше стольких покупок цифры предмета «шумят»: строку показываем приглушённо и в сортировках ставим в конец. */
export const MIN_RELIABLE_MATCHES = 100;

/** Сколько покупок минимум просим у API (дальше — только то, что есть в ответе). */
export const SERVER_MIN_MATCHES = 20;

/**
 * Строки таблицы: предмет + его цифры (null, если статистики нет).
 * @param {Array<object>} items предметы каталога
 * @param {Record<number, { matches: number, wins: number, avgBuyTimeS?: number|null }>|null} statsById
 * @param {number} base матчи, от которых считается частота покупки
 * @returns {Array<{ item: object, tier: string, matches: number, winrate: number|null, usage: number|null, buyTimeS: number|null, reliable: boolean }>}
 */
export function buildItemRows(items, statsById, base) {
  return items.map((item) => {
    const stat = statsById?.[item.id] ?? null;
    const matches = stat?.matches ?? 0;
    return {
      item,
      tier: getPriceTierKey(item.cost),
      matches,
      winrate: matches > 0 ? stat.wins / matches : null,
      usage: matches > 0 && base > 0 ? matches / base : null,
      buyTimeS: stat?.avgBuyTimeS ?? null,
      reliable: matches >= MIN_RELIABLE_MATCHES,
    };
  });
}

// Значение строки для числовых сортировок
const VALUE = {
  cost: (row) => row.item.cost ?? 0,
  winrate: (row) => row.winrate,
  usage: (row) => row.usage,
  matches: (row) => row.matches,
  buyTime: (row) => row.buyTimeS,
};

/** Можно ли ставить строку в общий порядок по этой колонке (или она уходит в конец). */
function isRankable(row, sort) {
  if (sort === 'name' || sort === 'cost') return true;
  if (sort === 'matches') return row.matches > 0;
  return row.reliable && VALUE[sort](row) != null;
}

/**
 * Сортировка строк. sort: name | cost | winrate | usage | matches | buyTime.
 * Строки без цифр или с малой выборкой всегда идут в конце — в какую бы сторону ни сортировали.
 * @param {ReturnType<typeof buildItemRows>} rows
 * @param {string} [sort]
 * @param {'asc'|'desc'} [dir]
 */
export function sortItemRows(rows, sort = 'usage', dir = 'desc') {
  const known = sort === 'name' || sort in VALUE;
  const key = known ? sort : 'usage';
  const sign = dir === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aOk = isRankable(a, key);
    const bOk = isRankable(b, key);
    if (aOk !== bOk) return aOk ? -1 : 1;
    if (!aOk) return b.matches - a.matches || a.item.name.localeCompare(b.item.name);

    if (key === 'name') return sign * a.item.name.localeCompare(b.item.name);
    const diff = VALUE[key](a) - VALUE[key](b);
    // При равенстве — по названию, чтобы порядок не «прыгал» между перерисовками
    return diff !== 0 ? sign * diff : a.item.name.localeCompare(b.item.name);
  });
}

/** Среднее время покупки в виде «м:сс» или «—». */
export function formatBuyTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
