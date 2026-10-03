/**
 * @fileoverview Калькулятор билда: здоровье, урон выстрела и DPS героя на уровне с набором предметов. Без React и
 * без API.
 *
 * Это оценка по данным игры, а не копия её формул, поэтому считается только то, что устроено просто и проверяемо:
 *  - здоровье: базовое + прирост за уровень × (уровень − 1) + плоские бонусы предметов;
 *  - урон пули: (базовый + прирост за уровень × (уровень − 1)) × (1 + сумма «Weapon Damage» предметов);
 *  - скорострельность, магазин и перезарядка — от оружия героя, с бонусами предметов к скорострельности и магазину;
 *  - DPS: урон выстрела × выстрелов в секунду; «с перезарядкой» — по тому же правилу, по которому его считает API
 *    (у обычного оружия сходится с его цифрами без бонусов, см. tests/calculatorService.test.js).
 * Что бонус предмета действует всегда, а что при условии, говорят сами данные: «innate» без пометки
 * ConditionallyApplied — постоянный бонус; всё остальное (пассивки, активки, «когда здоровье выше 65%») — условное.
 * Показываются оба варианта: «постоянно» и «если условия выполнены». Эффекты, которые калькулятор не умеет
 * считать, не пропадают молча, а перечисляются в «не учтено».
 */

export const CALC = {
  MIN_LEVEL: 1,
  /** Уровень, с которого открывается калькулятор: середина матча. */
  DEFAULT_LEVEL: 20,
  /** В данных матчей герои заканчивают игру на 36-м уровне в 99% случаев (изредка — на 37-м). */
  MAX_LEVEL: 36,
  /** Предметов в инвентаре. */
  MAX_ITEMS: 12,
  /** Задержка после перезарядки, если из данных оружия её не вывести: так в данных API у обычного оружия. */
  RELOAD_DELAY_S: 0.25,
};

/** Ключи свойств предмета в API → какую характеристику они меняют. */
export const MODIFIER_KEYS = {
  BonusHealth: 'health',
  BonusHealthRegen: 'regen',
  BaseAttackDamagePercent: 'weaponDamage',
  BonusFireRate: 'fireRate',
  BonusClipSizePercent: 'clipPercent',
  BonusClipSize: 'clipFlat',
};

/** Свойства, которые влияют на здоровье, но способ их применения в данных не описан: в расчёт не входят. */
export const UNCOUNTED_KEYS = {
  BonusBaseHealth: 'baseHealthPercent',
  MaxHealthLossPercent: 'maxHealthPercent',
};

const STATS = ['health', 'regen', 'weaponDamage', 'fireRate', 'clipPercent', 'clipFlat'];
const emptyBonus = () => Object.fromEntries(STATS.map((stat) => [stat, 0]));

const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Бонусы предмета из его свойств (поле `properties` ответа assets API).
 * @param {Record<string, any>|undefined} properties
 * @returns {{ mods: Array<{ stat: string, value: number, always: boolean }>, uncounted: Array<{ stat: string, value: number }> }}
 */
export function extractModifiers(properties) {
  const mods = [];
  const uncounted = [];
  for (const [key, stat] of Object.entries(MODIFIER_KEYS)) {
    const prop = properties?.[key];
    const value = number(prop?.value);
    if (!prop || value === 0) continue;
    const always = prop.tooltip_section === 'innate' && !(prop.usage_flags || []).includes('ConditionallyApplied');
    mods.push({ stat, value, always });
  }
  for (const [key, stat] of Object.entries(UNCOUNTED_KEYS)) {
    const value = number(properties?.[key]?.value);
    if (value !== 0) uncounted.push({ stat, value });
  }
  return { mods, uncounted };
}

const nonEmpty = (value) => (typeof value === 'string' && value.trim() !== '' ? value : null);

/**
 * Предмет из ответа assets API для калькулятора: только то, что продаётся (улучшение, включено, есть цена,
 * название и картинка), и только нужные поля. Остальное — null.
 * @param {any} raw
 */
export function slimCalcItem(raw) {
  if (!raw || raw.type !== 'upgrade' || raw.shopable === false || raw.disabled === true || raw.cost == null) return null;
  const name = nonEmpty(raw.name);
  const image = nonEmpty(raw.shop_image_webp) ?? nonEmpty(raw.shop_image);
  // «upgrade_xxx» — служебные заготовки, а не предметы магазина (так же отбирает isAvailableItem)
  if (!name || name.includes('_') || !image) return null;
  const { mods, uncounted } = extractModifiers(raw.properties);
  return {
    id: raw.id,
    name,
    cost: raw.cost,
    slot: raw.item_slot_type ?? null,
    tier: raw.item_tier ?? null,
    image,
    mods,
    uncounted,
  };
}

/** Весь ответ assets API → предметы для калькулятора, дешёвые первыми. */
export function slimCalcItems(data) {
  const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? [];
  return list.map(slimCalcItem).filter(Boolean).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}

/**
 * Поправка ко времени цикла «магазин + перезарядка», какой она следует из данных API: по его собственной цифре
 * «выстрелов в секунду с перезарядкой». У обычного оружия это задержка 0,25 с после перезарядки, у оружия с очередями
 * — малая поправка на округление скорострельности (может быть чуть отрицательной). Если вывести её не из чего или
 * получилось странное значение — стандартная задержка.
 */
function reloadDelay(info) {
  const { clip_size: clip, shots_per_second: rate, shots_per_second_with_reload: withReload, reload_duration: reload } = info;
  if (clip > 0 && rate > 0 && withReload > 0) {
    const delay = clip / withReload - clip / rate - reload;
    if (Number.isFinite(delay) && delay > -0.5 && delay < 2) return delay;
  }
  return CALC.RELOAD_DELAY_S;
}

/**
 * Базовые характеристики героя для калькулятора.
 * @param {any} hero герой из assets API (достаточно starting_stats и standard_level_up_upgrades)
 * @param {any} weaponItem оружие героя из assets API (поле weapon_info) или null
 */
export function toHeroBase(hero, weaponItem) {
  const levelUp = hero?.standard_level_up_upgrades ?? {};
  const info = weaponItem?.weapon_info;
  const usable = info && number(info.bullet_damage) > 0 && number(info.shots_per_second) > 0 && number(info.clip_size) > 0;
  return {
    id: hero?.id ?? hero?.hero_id ?? null,
    name: hero?.name ?? null,
    maxHealth: number(hero?.starting_stats?.max_health?.value),
    healthRegen: number(hero?.starting_stats?.base_health_regen?.value),
    healthPerLevel: number(levelUp.MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL),
    weapon: usable
      ? {
        bulletDamage: number(info.bullet_damage),
        bullets: Math.max(1, number(info.bullets) || 1),
        damagePerLevel: number(levelUp.MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL),
        shotsPerSecond: number(info.shots_per_second),
        clipSize: number(info.clip_size),
        reloadTime: number(info.reload_duration),
        reloadDelay: reloadDelay(info),
      }
      : null,
  };
}

/** Уровень, приведённый к целому в пределах игры. */
export function clampLevel(level) {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n)) return CALC.MIN_LEVEL;
  return Math.min(CALC.MAX_LEVEL, Math.max(CALC.MIN_LEVEL, n));
}

/** Характеристики героя на уровне с суммой бонусов предметов `bonus`. */
function statsFor(base, boons, bonus) {
  const health = base.maxHealth + base.healthPerLevel * boons + bonus.health;
  const regen = base.healthRegen + bonus.regen;
  const w = base.weapon;
  if (!w) return { health, regen, weapon: null };

  const damagePerBullet = (w.bulletDamage + w.damagePerLevel * boons) * (1 + bonus.weaponDamage / 100);
  const damagePerShot = damagePerBullet * w.bullets;
  const shotsPerSecond = w.shotsPerSecond * (1 + bonus.fireRate / 100);
  const clip = Math.max(1, Math.round(w.clipSize * (1 + bonus.clipPercent / 100) + bonus.clipFlat));
  const cycle = clip / shotsPerSecond + w.reloadTime + w.reloadDelay;
  return {
    health,
    regen,
    weapon: {
      damagePerBullet,
      bullets: w.bullets,
      damagePerShot,
      shotsPerSecond,
      clip,
      reloadTime: w.reloadTime,
      dps: damagePerShot * shotsPerSecond,
      dpsSustained: (damagePerShot * clip) / cycle,
    },
  };
}

/**
 * Расчёт билда.
 * @param {ReturnType<typeof toHeroBase>} base
 * @param {number} level
 * @param {Array<ReturnType<typeof slimCalcItem>>} items выбранные предметы
 * @returns {{
 *   level: number, boons: number,
 *   base: ReturnType<typeof statsFor>, permanent: ReturnType<typeof statsFor>, peak: ReturnType<typeof statsFor>,
 *   bonuses: { permanent: Record<string, number>, conditional: Record<string, number> },
 *   uncounted: Array<{ itemId: number, name: string, stat: string, value: number }>,
 *   cost: number,
 * }}
 */
export function computeBuild(base, level, items) {
  const lvl = clampLevel(level);
  const boons = lvl - 1;
  const permanent = emptyBonus();
  const conditional = emptyBonus();
  const uncounted = [];
  let cost = 0;

  for (const item of items) {
    cost += item.cost ?? 0;
    for (const mod of item.mods) (mod.always ? permanent : conditional)[mod.stat] += mod.value;
    for (const entry of item.uncounted ?? []) uncounted.push({ itemId: item.id, name: item.name, ...entry });
  }
  const peak = Object.fromEntries(STATS.map((stat) => [stat, permanent[stat] + conditional[stat]]));

  return {
    level: lvl,
    boons,
    base: statsFor(base, boons, emptyBonus()),
    permanent: statsFor(base, boons, permanent),
    peak: statsFor(base, boons, peak),
    bonuses: { permanent, conditional },
    uncounted,
    cost,
  };
}

/** Предметы по слоту и названию: дешёвые первыми (порядок задан slimCalcItems). */
export function filterCalcItems(items, { slot = 'all', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return items.filter((item) => (slot === 'all' || item.slot === slot) && (!q || item.name.toLowerCase().includes(q)));
}

/** Добавляет предмет в набор или убирает его (повторять предмет нельзя); при полном наборе новый не добавляется. */
export function toggleItem(selected, id, max = CALC.MAX_ITEMS) {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  return selected.length >= max ? selected : [...selected, id];
}

/** Выбранные id → предметы каталога в том же порядке; id, которых в каталоге нет (убрали из игры), пропускаются. */
export function pickItems(catalog, ids) {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

const ID_PATTERN = /^\d{1,10}$/;

/**
 * Состояние калькулятора из адреса (?hero=13&lvl=24&items=1,2,3). Всё, что не похоже на допустимое, отбрасывается.
 * @param {string|URLSearchParams} search
 * @returns {{ heroId: number|null, level: number, itemIds: number[] }}
 */
export function parseCalcParams(search) {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const hero = params.get('hero');
  const level = params.get('lvl');
  const itemIds = [...new Set((params.get('items') ?? '').split(',').filter((id) => ID_PATTERN.test(id)).map(Number))].slice(0, CALC.MAX_ITEMS);
  return {
    heroId: ID_PATTERN.test(hero ?? '') && Number(hero) > 0 ? Number(hero) : null,
    level: ID_PATTERN.test(level ?? '') ? clampLevel(level) : CALC.DEFAULT_LEVEL,
    itemIds,
  };
}

/** Состояние калькулятора → строка запроса адреса (пустая, пока героя нет). */
export function calcSearch({ heroId, level, itemIds }) {
  if (!heroId) return '';
  const params = new URLSearchParams({ hero: String(heroId), lvl: String(clampLevel(level)) });
  if (itemIds.length > 0) params.set('items', itemIds.join(','));
  return params.toString().replace(/%2C/g, ',');
}
