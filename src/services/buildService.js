/**
 * @fileoverview Случайный билд: зерно и генератор случайных чисел, подбор героя и двенадцати предметов с учётом слотов,
 * бюджета душ и закреплённых предметов, этапы покупки, итоги, адрес страницы и история бросков.
 * Не знает ни про React, ни про API.
 *
 * Билд — чистая функция от зерна, героя, настроек, закреплённых предметов и справочника: то же зерно даёт тот же билд.
 * Поэтому «билд дня» у всех одинаков, а ссылкой с зерном можно поделиться.
 *
 * Выбор устроен через «приоритет»: у каждого предмета и героя он свой — хеш от зерна и id. Берутся те, у кого приоритет
 * выше (число меньше). Так выбор не зависит от порядка и размера списков: новый предмет в магазине, предмет, который
 * вошёл в список «нужных герою» или вышел из него, меняет билд на одну позицию, а не перетасовывает его целиком
 * (случайная перестановка списка после каждого такого изменения давала бы каждому посетителю свой «билд дня»).
 */

export const SLOTS = ['weapon', 'spirit', 'vitality'];
export const MODES = ['balance', 'random'];
export const PHASES = ['early', 'mid', 'late'];
export const BUILD_SIZE = 12;

/** Бюджет душ: от самой дешёвой сборки из 12 предметов (≈9 600) до «всё, что захочется». */
export const BUDGET = { min: 10000, max: 80000, step: 1000, default: 50000 };

export const DEFAULT_OPTIONS = Object.freeze({
  heroId: null, // null — любой герой, выбирается по зерну
  slots: SLOTS,
  mode: 'balance',
  budget: BUDGET.default,
  useful: true, // без предметов, которые на этом герое почти не покупают
});

export const HISTORY_LIMIT = 8;

/** Предмет считается нужным герою, если он есть хотя бы в этой доле его матчей. */
export const USEFUL_SHARE = 0.01;

const SLOT_ORDER = { weapon: 0, spirit: 1, vitality: 2 };

// ── Зерно ─────────────────────────────────────────────────────────

/** Зерно — число от 0 до 6 553 599; на экране оно пишется как «A7F3-29»: четыре шестнадцатеричные цифры и две десятичные. */
export const SEED_COUNT = 0x10000 * 100;

/** Строка → 32 бита (хеш xmur3): из даты получается зерно «билда дня». */
export function hashString(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Приоритет предмета, героя или слота при этом зерне: у кого меньше, тот выбирается раньше. */
function priorityOf(seed, key) {
  return hashString(`${seed}:${key}`);
}

export function randomSeed(random = Math.random) {
  return Math.floor(random() * SEED_COUNT);
}

/** 42 → «002A-00». */
export function formatSeed(seed) {
  const n = Math.max(0, Math.min(SEED_COUNT - 1, Math.floor(Number(seed) || 0)));
  return `${Math.floor(n / 100).toString(16).toUpperCase().padStart(4, '0')}-${String(n % 100).padStart(2, '0')}`;
}

/** «A7F3-29» или «#a7f3-29» → число; всё остальное — null. */
export function parseSeed(text) {
  const match = /^#?([0-9a-f]{4})-(\d{2})$/i.exec(String(text ?? '').trim());
  return match ? parseInt(match[1], 16) * 100 + Number(match[2]) : null;
}

/**
 * Сегодняшняя дата посетителя, «2026-10-05»: на ней держится билд дня. Берётся местная, а не UTC: дата в заголовке страницы
 * должна совпадать с календарём посетителя (для России UTC-сутки меняются в три часа ночи). Цена этого — у посетителей
 * в разных часовых поясах билд дня меняется в разное время; поделиться билдом можно ссылкой с зерном.
 */
export function dayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Зерно билда дня: одно на всех посетителей с одной датой. */
export function dailySeed(day = dayKey()) {
  return hashString(`build-of-the-day:${day}`) % SEED_COUNT;
}

// ── Настройки ─────────────────────────────────────────────────────

/** Выбранные слоты в каноническом порядке, только известные; пусто — значит «все» (так делает и адрес). */
export function normalizeSlots(slots) {
  const wanted = new Set(Array.isArray(slots) ? slots : []);
  return SLOTS.filter((slot) => wanted.has(slot));
}

/** Бюджет в пределах слайдера и с шагом слайдера. */
export function clampBudget(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return BUDGET.default;
  const stepped = Math.round(n / BUDGET.step) * BUDGET.step;
  return Math.min(BUDGET.max, Math.max(BUDGET.min, stepped));
}

/** Настройки из чего угодно (адрес, сохранённая запись): лишнее выбрасывается, пропущенное берётся по умолчанию. */
export function normalizeOptions(raw) {
  const heroId = Number(raw?.heroId);
  const slots = normalizeSlots(raw?.slots);
  return {
    heroId: Number.isInteger(heroId) && heroId > 0 ? heroId : null,
    slots: slots.length ? slots : [...SLOTS],
    mode: MODES.includes(raw?.mode) ? raw.mode : DEFAULT_OPTIONS.mode,
    budget: raw?.budget === undefined ? BUDGET.default : clampBudget(raw.budget),
    useful: raw?.useful !== false,
  };
}

export function isDefaultOptions(options) {
  const o = normalizeOptions(options);
  return o.heroId === null && o.slots.length === SLOTS.length && o.mode === DEFAULT_OPTIONS.mode
    && o.budget === DEFAULT_OPTIONS.budget && o.useful === DEFAULT_OPTIONS.useful;
}

// ── Подбор ────────────────────────────────────────────────────────

/**
 * Герой билда: заданный или, если «любой», тот, у кого при этом зерне самый высокий приоритет (выход нового героя
 * меняет выбор только если он сам окажется первым). null — героя нет (список пуст или заданный пропал).
 */
export function pickHero(heroes, options, seed) {
  if (!heroes.length) return null;
  if (options.heroId != null) return heroes.find((hero) => hero.id === Number(options.heroId)) ?? null;
  let best = null;
  let bestPriority = Infinity;
  heroes.forEach((hero) => {
    const priority = priorityOf(seed, `hero:${hero.id}`);
    if (priority < bestPriority || (priority === bestPriority && hero.id < best.id)) {
      best = hero;
      bestPriority = priority;
    }
  });
  return best;
}

/**
 * Порядок покупки: сначала дешёвые. При равной цене — по тиру, слоту и названию, чтобы порядок не зависел от случая.
 */
export function sortForPurchase(items) {
  return [...items].sort((a, b) => (
    (a.cost ?? 0) - (b.cost ?? 0)
    || (a.item_tier ?? 0) - (b.item_tier ?? 0)
    || (SLOT_ORDER[a.item_slot_type] ?? 9) - (SLOT_ORDER[b.item_slot_type] ?? 9)
    || String(a.name).localeCompare(String(b.name))
  ));
}

const costOf = (item) => item.cost ?? 0;
const sum = (items) => items.reduce((total, item) => total + costOf(item), 0);

/**
 * Какие этапы и сколько предметов в каждом: для 12 — по четыре, для остальных — как можно ровнее, ранние крупнее.
 * @returns {number[]}
 */
export function phaseSizes(count) {
  const early = Math.ceil(count / 3);
  const mid = Math.ceil((count - early) / 2);
  return [early, mid, count - early - mid];
}

/**
 * Билд из готового набора предметов: порядок покупки, этапы, итоги по слотам. Нужен и генератору, и истории
 * (запись истории хранит предметы, а не зерно — после патча зерно дало бы другой набор).
 * @param {{ hero: any, items: any[], seed: number, options: any, pinnedIds?: Iterable<number>, overBudget?: boolean, usefulApplied?: boolean }} input
 */
export function assembleBuild({ hero, items, seed, options, pinnedIds = [], overBudget = false, usefulApplied = false }) {
  const pinned = new Set(pinnedIds);
  const sorted = sortForPurchase(items);
  const phases = [];
  let from = 0;
  phaseSizes(sorted.length).forEach((size, index) => {
    const slice = sorted.slice(from, from + size);
    from += size;
    phases.push({
      id: PHASES[index],
      entries: slice.map((item) => ({ item, pinned: pinned.has(item.id) })),
      total: sum(slice),
    });
  });

  const totals = { total: sum(sorted), weapon: 0, spirit: 0, vitality: 0 };
  sorted.forEach((item) => { if (item.item_slot_type in totals) totals[item.item_slot_type] += costOf(item); });

  return {
    seed,
    seedLabel: formatSeed(seed),
    hero,
    options: normalizeOptions(options),
    phases,
    items: sorted,
    totals,
    overBudget,
    usefulApplied,
  };
}

/**
 * Делит `need` мест между слотами как можно ровнее с учётом того, сколько в слоте уже занято и сколько в нём ещё
 * предметов; при равенстве выигрывает слот, стоящий раньше в `order`. Возвращает по слотам, сколько взять.
 * @param {string[]} order слоты в порядке предпочтения при равенстве
 * @param {Record<string, number>} taken занято в слотах (закреплённые предметы)
 * @param {Record<string, number>} available сколько предметов ещё можно взять в слоте
 */
export function balancedCounts(need, order, taken, available) {
  const add = Object.fromEntries(order.map((slot) => [slot, 0]));
  for (let n = 0; n < need; n += 1) {
    let best = null;
    order.forEach((slot) => {
      if (add[slot] >= (available[slot] ?? 0)) return;
      if (best === null || (taken[slot] ?? 0) + add[slot] < (taken[best] ?? 0) + add[best]) best = slot;
    });
    if (best === null) break;
    add[best] += 1;
  }
  return add;
}

/**
 * Билд для героя: двенадцать предметов из выбранных слотов с закреплёнными в том числе, не дороже бюджета.
 * Если выбранное дороже бюджета, самый дорогой незакреплённый предмет меняется на более дешёвый того же слота
 * (с лучшим приоритетом), и так, пока не уложимся.
 * Не хватает предметов или бюджет недостижим — билд всё равно собирается, с `overBudget`.
 *
 * @param {{ hero: any, items: any[], options: any, seed: number, pins?: number[], useful?: Set<number>|null }} input
 *   items — продающиеся предметы; useful — id предметов, нужных этому герою (null — не фильтровать)
 * @returns {ReturnType<typeof assembleBuild>|{ error: 'noSlots'|'noItems' }}
 */
export function makeBuild({ hero, items, options, seed, pins = [], useful = null }) {
  // Пустой набор слотов здесь — ошибка выбора, а не «все слоты» (так читается только адрес)
  const slots = normalizeSlots(options?.slots);
  if (!slots.length) return { error: 'noSlots' };
  const opts = normalizeOptions({ ...options, slots });

  const byId = new Map(items.map((item) => [item.id, item]));
  const pinnedItems = [...new Set(pins)]
    .map((id) => byId.get(id))
    .filter((item) => item && slots.includes(item.item_slot_type))
    .slice(0, BUILD_SIZE);
  const pinnedIds = new Set(pinnedItems.map((item) => item.id));
  const need = BUILD_SIZE - pinnedItems.length;

  const useUseful = useful instanceof Set && useful.size > 0 && opts.useful;
  const rank = new Map(items.map((item) => [item.id, priorityOf(seed, `item:${item.id}`)]));
  const byRank = (a, b) => rank.get(a.id) - rank.get(b.id) || a.id - b.id;

  // Пул каждого слота: сначала нужные герою предметы по приоритету, затем остальные (если нужных не хватает)
  const pools = {};
  slots.forEach((slot) => {
    const free = items.filter((item) => item.item_slot_type === slot && !pinnedIds.has(item.id)).sort(byRank);
    pools[slot] = {
      primary: useUseful ? free.filter((item) => useful.has(item.id)) : free,
      reserve: useUseful ? free.filter((item) => !useful.has(item.id)) : [],
    };
  });
  const ordered = (slot) => [...pools[slot].primary, ...pools[slot].reserve];

  let picked = [];
  if (opts.mode === 'random') {
    const first = slots.flatMap((slot) => pools[slot].primary).sort(byRank);
    const rest = slots.flatMap((slot) => pools[slot].reserve).sort(byRank);
    picked = [...first, ...rest].slice(0, need);
  } else {
    const order = [...slots].sort((a, b) => priorityOf(seed, `slot:${a}`) - priorityOf(seed, `slot:${b}`));
    const taken = {};
    const available = {};
    slots.forEach((slot) => {
      taken[slot] = pinnedItems.filter((item) => item.item_slot_type === slot).length;
      available[slot] = ordered(slot).length;
    });
    const counts = balancedCounts(need, order, taken, available);
    slots.forEach((slot) => { picked.push(...ordered(slot).slice(0, counts[slot])); });
  }

  const chosen = [...pinnedItems, ...picked];
  if (!chosen.length) return { error: 'noItems' };

  // Бюджет: пока дороже, меняем самый дорогой незакреплённый предмет на более дешёвый того же слота с лучшим приоритетом
  const used = new Set(chosen.map((item) => item.id));
  let total = sum(chosen);
  for (let guard = 0; guard < 400 && total > opts.budget; guard += 1) {
    const victims = chosen.filter((item) => !pinnedIds.has(item.id)).sort((a, b) => costOf(b) - costOf(a) || byRank(a, b));
    let swapped = false;
    for (const victim of victims) {
      const replacement = ordered(victim.item_slot_type).find((item) => !used.has(item.id) && costOf(item) < costOf(victim));
      if (!replacement) continue;
      chosen[chosen.indexOf(victim)] = replacement;
      used.delete(victim.id);
      used.add(replacement.id);
      total += costOf(replacement) - costOf(victim);
      swapped = true;
      break;
    }
    if (!swapped) break;
  }

  return assembleBuild({ hero, items: chosen, seed, options: opts, pinnedIds, overBudget: total > opts.budget, usefulApplied: useUseful });
}

/**
 * Какие предметы нужны герою по статистике: те, что есть хотя бы в 1 % его матчей. Если данных мало (новый герой,
 * узкая выборка) и таких предметов меньше `minCount`, порог понемногу опускается; не помогло — null: не фильтровать.
 * @param {Array<{ itemId: number, matches: number }>} rows предметы героя из item-stats
 * @param {number} heroMatches сколько матчей у героя за тот же период (0 — взять самый частый предмет)
 */
export function usefulItemIds(rows, heroMatches = 0, minCount = BUILD_SIZE * 3) {
  const list = Array.isArray(rows) ? rows.filter((row) => Number.isFinite(row?.matches) && row.matches > 0) : [];
  if (!list.length) return null;
  const base = heroMatches > 0 ? heroMatches : Math.max(...list.map((row) => row.matches));
  for (const share of [USEFUL_SHARE, USEFUL_SHARE / 2, USEFUL_SHARE / 5]) {
    const ids = list.filter((row) => row.matches >= share * base).map((row) => row.itemId);
    if (ids.length >= minCount) return new Set(ids);
  }
  return null;
}

// ── Адрес страницы ────────────────────────────────────────────────

/**
 * Состояние из адреса: `?seed=A7F3-29&hero=6&slots=weapon,spirit&mode=random&budget=40000&useful=0&pin=101,202`.
 * Всё необязательно, всё проверяется.
 * @param {URLSearchParams} params
 * @returns {{ options: ReturnType<typeof normalizeOptions>, seed: number|null, pins: number[] }}
 */
export function parseBuildSearch(params) {
  const slotsText = params.get('slots');
  const budgetText = params.get('budget');
  const options = normalizeOptions({
    heroId: params.get('hero'),
    slots: slotsText ? slotsText.split(',') : [],
    mode: params.get('mode'),
    budget: budgetText === null || budgetText.trim() === '' ? undefined : budgetText,
    useful: params.get('useful') !== '0',
  });
  const pins = [...new Set((params.get('pin') ?? '').split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, BUILD_SIZE);
  return { options, seed: parseSeed(params.get('seed')), pins };
}

/**
 * Адрес билда: только то, что отличается от умолчаний. Билд дня с настройками по умолчанию и без закреплённых
 * предметов — чистый адрес.
 * @returns {string} «?seed=…» или пустая строка
 */
export function buildSearch({ options, seed, pins = [] }, today = dailySeed()) {
  const opts = normalizeOptions(options);
  const parts = [];
  if (seed !== null && seed !== undefined && !(seed === today && isDefaultOptions(opts) && !pins.length)) parts.push(`seed=${formatSeed(seed)}`);
  if (opts.heroId !== null) parts.push(`hero=${opts.heroId}`);
  if (opts.slots.length !== SLOTS.length) parts.push(`slots=${opts.slots.join(',')}`);
  if (opts.mode !== DEFAULT_OPTIONS.mode) parts.push(`mode=${opts.mode}`);
  if (opts.budget !== DEFAULT_OPTIONS.budget) parts.push(`budget=${opts.budget}`);
  if (!opts.useful) parts.push('useful=0');
  if (pins.length) parts.push(`pin=${pins.join(',')}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// ── История бросков ───────────────────────────────────────────────

/**
 * Запись истории: предметы хранятся списком id — после патча зерно дало бы другой набор; закреплённые на момент
 * броска предметы нужны, чтобы по записи можно было собрать адрес и бросить снова.
 */
export function historyEntry(build, { pins = [], now = Date.now() } = {}) {
  return {
    seed: build.seed,
    heroId: build.hero.id,
    heroName: build.hero.name,
    options: { ...build.options },
    pins: [...pins],
    itemIds: build.items.map((item) => item.id),
    total: build.totals.total,
    at: now,
  };
}

const sameRoll = (a, b) => a.seed === b.seed && a.heroId === b.heroId && a.itemIds.join() === b.itemIds.join();

/** Новая запись первой, повторы убираются, хвост обрезается. */
export function pushHistory(history, entry) {
  return [entry, ...history.filter((existing) => !sameRoll(existing, entry))].slice(0, HISTORY_LIMIT);
}

/** Всё, что читается из localStorage, проходит здесь: мусор и чужие записи выбрасываются. */
export function normalizeHistory(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const result = [];
  list.forEach((row) => {
    const itemIds = Array.isArray(row?.itemIds) ? row.itemIds.filter((id) => Number.isInteger(id) && id > 0) : [];
    if (!itemIds.length || itemIds.length > BUILD_SIZE || !Number.isInteger(row?.heroId) || !Number.isFinite(row?.seed) || !Number.isFinite(row?.at)) return;
    result.push({
      seed: row.seed,
      heroId: row.heroId,
      heroName: typeof row.heroName === 'string' ? row.heroName.slice(0, 60) : '',
      options: normalizeOptions(row.options),
      pins: Array.isArray(row.pins) ? [...new Set(row.pins.filter((id) => Number.isInteger(id) && id > 0))].slice(0, BUILD_SIZE) : [],
      itemIds,
      total: Number.isFinite(row.total) ? row.total : 0,
      at: row.at,
    });
  });
  return result.slice(0, HISTORY_LIMIT);
}

/**
 * Билд из записи истории: предметы по id (пропавшие после патча пропускаются), герой по id.
 * null — ничего не осталось.
 */
export function buildFromEntry(entry, items, heroes) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const chosen = entry.itemIds.map((id) => byId.get(id)).filter(Boolean);
  const hero = heroes.find((candidate) => candidate.id === entry.heroId);
  if (!chosen.length || !hero) return null;
  return assembleBuild({ hero, items: chosen, seed: entry.seed, options: { ...entry.options, heroId: entry.heroId }, pinnedIds: [] });
}
