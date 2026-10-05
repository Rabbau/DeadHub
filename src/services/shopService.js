/**
 * @fileoverview Витрина магазина предметов: тиры, в каждом три колонки по слотам, счётчики для фильтров и вкладок,
 * сортировка и правила сворачивания. Без React и без API.
 *
 * Тир предмета определяется ценой (getPriceTierKey), как и везде на сайте: 800 / 1600 / 3200 / 6400 и «легендарные»
 * за 9999. Предметы, которых нет в магазине (отключённые и служебные заготовки), собираются в отдельный раздел.
 */
import { getPriceTierKey, isAvailableItem } from './itemService.js';
import { buildItemRows, sortItemRows } from './itemStatsService.js';

export const SHOP_TIERS = ['t1', 't2', 't3', 't4', 't5'];

/** Порядок колонок, как в магазине игры. */
export const SHOP_SLOTS = ['weapon', 'vitality', 'spirit'];

export const TIER_COST = { t1: 800, t2: 1600, t3: 3200, t4: 6400, t5: 9999 };
export const TIER_ROMAN = { t1: 'I', t2: 'II', t3: 'III', t4: 'IV', t5: 'V' };

/** Раскрытые тиры, пока посетитель ничего не трогал: дешёвые, их покупают в первую очередь. */
export const OPEN_TIERS = ['t1', 't2'];

/** Сколько предметов остаётся в длинной колонке, пока её не раскрыли («ещё N»). */
export const PREVIEW_ROWS = 4;

/** Колонка до этого размера показывается целиком: прятать из неё два-три предмета незачем. */
export const FULL_ROWS = 9;

export const SORTS = ['name', 'usage', 'winrate'];

/** Буквы на плитке предмета без картинки: первые буквы первых двух слов («Ближняя дистанция» → «БД»). */
export function itemMonogram(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join('') : words[0][0];
  return letters.toUpperCase();
}

/** Сколько предметов в каждом слоте: { all, weapon, vitality, spirit }. */
export function countBySlot(items) {
  const counts = { all: items.length };
  SHOP_SLOTS.forEach((slot) => { counts[slot] = items.filter((item) => item.item_slot_type === slot).length; });
  return counts;
}

/**
 * Вкладки тиров: цена и число продающихся предметов в каждом (0 — тир пуст при текущих фильтрах).
 * @returns {Array<{ key: string, cost: number, count: number }>}
 */
export function tierSummary(items) {
  const counts = Object.fromEntries(SHOP_TIERS.map((key) => [key, 0]));
  items.forEach((item) => {
    if (isAvailableItem(item)) counts[getPriceTierKey(item.cost)] += 1;
  });
  return SHOP_TIERS.map((key) => ({ key, cost: TIER_COST[key], count: counts[key] }));
}

/**
 * Порядок предметов: по алфавиту, по доле покупок или по винрейту. Без статистики (ещё не пришла) — по алфавиту;
 * предметы с малой выборкой при сортировке по цифрам уходят в конец (см. sortItemRows).
 * @param {object[]} items
 * @param {{ sort?: string, language?: string, statsById?: Record<number, any>|null, base?: number }} [options]
 */
export function sortShopItems(items, { sort = 'name', language = 'english', statsById = null, base = 0 } = {}) {
  if (sort === 'name' || !statsById) {
    const collator = new Intl.Collator(language === 'russian' ? 'ru' : 'en', { sensitivity: 'base' });
    return [...items].sort((a, b) => collator.compare(a.name, b.name));
  }
  return sortItemRows(buildItemRows(items, statsById, base), sort, 'desc').map((row) => row.item);
}

function makeSection(key, items) {
  const columns = SHOP_SLOTS.map((slot) => ({ slot, items: items.filter((item) => item.item_slot_type === slot) }));
  // Предмет без известного слота в колонки не попадает: общее число считаем по колонкам, чтобы не обещать лишнего
  const total = columns.reduce((sum, column) => sum + column.items.length, 0);
  return { key, cost: key === 'indev' ? null : TIER_COST[key], total, columns };
}

/**
 * Витрина: тиры с предметами (пустые не попадают) и раздел «не в магазине», если такие предметы есть среди переданных.
 * @param {object[]} items уже отфильтрованные предметы
 * @param {Parameters<typeof sortShopItems>[1]} [options]
 * @returns {{ tiers: Array<{ key: string, cost: number|null, total: number, columns: Array<{ slot: string, items: object[] }> }>, indev: object|null }}
 */
export function buildShop(items, options = {}) {
  const sorted = sortShopItems(items, options);
  const tiers = SHOP_TIERS
    .map((key) => makeSection(key, sorted.filter((item) => isAvailableItem(item) && getPriceTierKey(item.cost) === key)))
    .filter((section) => section.total > 0);
  const off = makeSection('indev', sorted.filter((item) => !isAvailableItem(item)));
  return { tiers, indev: off.total > 0 ? off : null };
}

/**
 * Сетка: те же тиры, что в витрине, но предметы одним списком в выбранном порядке (без колонок по слотам).
 * @param {object[]} items
 * @param {Parameters<typeof sortShopItems>[1]} [options]
 * @returns {Array<{ key: string, cost: number|null, items: object[] }>}
 */
export function groupByTier(items, options = {}) {
  const sorted = sortShopItems(items, options);
  const groups = SHOP_TIERS
    .map((key) => ({ key, cost: TIER_COST[key], items: sorted.filter((item) => isAvailableItem(item) && getPriceTierKey(item.cost) === key) }))
    .filter((group) => group.items.length > 0);
  const off = sorted.filter((item) => !isAvailableItem(item));
  if (off.length > 0) groups.push({ key: 'indev', cost: null, items: off });
  return groups;
}

/**
 * Сколько предметов колонки показывать. Всё — если колонка короткая, её раскрыли или идёт поиск
 * (найденное не должно прятаться за «ещё N»); иначе несколько первых.
 */
export function visibleRows(total, { expanded = false, forceAll = false } = {}) {
  return forceAll || expanded || total <= FULL_ROWS ? total : PREVIEW_ROWS;
}

/** Предмет, который панель показывает, пока посетитель ничего не выбрал: первый в витрине. */
export function firstShopItem(shop) {
  for (const section of [...shop.tiers, shop.indev]) {
    for (const column of section?.columns ?? []) {
      if (column.items.length > 0) return column.items[0];
    }
  }
  return null;
}
