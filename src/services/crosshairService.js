/**
 * @fileoverview Студия прицела: настройки прицела Deadlock, их проверка, перевод в запрос к API и обратно.
 * Без React и без API. Кодирует настройки в код и рисует картинку сам API (crosshair/*), сайт только собирает запросы.
 *
 * API принимает любые целые (проверяет только цвета 0–255), а пределы, которые разрешает сама игра, нигде не
 * опубликованы. Поэтому ползунки сайта рассчитаны на привычные значения (SLIDER), а вводить и импортировать
 * можно любые в пределах HARD: игра при импорте кода может обрезать то, что ей не подходит.
 */

/** Настройки по умолчанию, как их возвращает API для кода без параметров (значения самой игры). */
export const CROSSHAIR_DEFAULTS = Object.freeze({
  themed: false,
  pip_gap_static: false,
  pip_width: 2,
  pip_height: 16,
  pip_gap: 4,
  pip_opacity: 0.5,
  pip_outline_border: 1,
  pip_outline_gap: 0,
  pip_outline_opacity: 0.7,
  dot_size: 4,
  dot_opacity: 0.7,
  dot_outline_border: 2,
  dot_outline_gap: 0,
  dot_outline_opacity: 0.7,
  color_r: 255,
  color_g: 255,
  color_b: 255,
  outline_color_r: 0,
  outline_color_g: 0,
  outline_color_b: 0,
});

const BOOLEAN_KEYS = ['themed', 'pip_gap_static'];
const OPACITY_KEYS = ['pip_opacity', 'pip_outline_opacity', 'dot_opacity', 'dot_outline_opacity'];
const COLOR_KEYS = ['color_r', 'color_g', 'color_b', 'outline_color_r', 'outline_color_g', 'outline_color_b'];
const SIZE_KEYS = ['pip_width', 'pip_height', 'pip_gap', 'pip_outline_border', 'pip_outline_gap', 'dot_size', 'dot_outline_border', 'dot_outline_gap'];

/** Крайние значения, которые сайт вообще отправляет в API. */
export const HARD = { sizeMax: 255, colorMax: 255 };

/** Что показывают ползунки: группа, предел и шаг. Значения вне пределов ползунка можно ввести числом. */
export const SLIDER = {
  pip_width: { group: 'pips', max: 12, step: 1 },
  pip_height: { group: 'pips', max: 40, step: 1 },
  pip_gap: { group: 'pips', max: 30, step: 1 },
  pip_opacity: { group: 'pips', max: 1, step: 0.05 },
  pip_outline_border: { group: 'pips', max: 6, step: 1 },
  pip_outline_gap: { group: 'pips', max: 6, step: 1 },
  pip_outline_opacity: { group: 'pips', max: 1, step: 0.05 },
  dot_size: { group: 'dot', max: 20, step: 1 },
  dot_opacity: { group: 'dot', max: 1, step: 0.05 },
  dot_outline_border: { group: 'dot', max: 6, step: 1 },
  dot_outline_gap: { group: 'dot', max: 6, step: 1 },
  dot_outline_opacity: { group: 'dot', max: 1, step: 0.05 },
};

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Число или запасное значение: строка «5» тоже число, а «abc» и NaN — нет. */
function toNumber(value, fallback) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Приводит что угодно (ответ API, адрес, ввод) к допустимым настройкам: лишние поля отбрасываются, недостающие
 * берутся из значений по умолчанию, числа обрезаются до допустимых пределов.
 * @param {any} raw
 * @returns {typeof CROSSHAIR_DEFAULTS}
 */
export function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const result = { ...CROSSHAIR_DEFAULTS };
  for (const key of BOOLEAN_KEYS) {
    if (typeof source[key] === 'boolean') result[key] = source[key];
    else if (source[key] === 'true' || source[key] === 'false') result[key] = source[key] === 'true';
  }
  for (const key of OPACITY_KEYS) result[key] = Math.round(clamp(toNumber(source[key], CROSSHAIR_DEFAULTS[key]), 0, 1) * 100) / 100;
  for (const key of COLOR_KEYS) result[key] = Math.round(clamp(toNumber(source[key], CROSSHAIR_DEFAULTS[key]), 0, HARD.colorMax));
  for (const key of SIZE_KEYS) result[key] = Math.round(clamp(toNumber(source[key], CROSSHAIR_DEFAULTS[key]), 0, HARD.sizeMax));
  return result;
}

/** Совпадают ли две настройки (после приведения к допустимым). */
export function sameSettings(a, b) {
  const left = normalizeSettings(a);
  const right = normalizeSettings(b);
  return Object.keys(CROSSHAIR_DEFAULTS).every((key) => left[key] === right[key]);
}

/**
 * Параметры запроса к API: только то, что отличается от значений по умолчанию (адрес короче, а одинаковые настройки
 * дают один и тот же запрос — это нужно кешу), ключи по алфавиту.
 * @param {Partial<typeof CROSSHAIR_DEFAULTS>} settings
 * @returns {Record<string, string|number|boolean>}
 */
export function settingsParams(settings) {
  const normal = normalizeSettings(settings);
  const params = {};
  for (const key of Object.keys(CROSSHAIR_DEFAULTS).sort()) {
    if (normal[key] !== CROSSHAIR_DEFAULTS[key]) params[key] = normal[key];
  }
  return params;
}

/** Цвет в виде #rrggbb. */
export function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((part) => clamp(Math.round(toNumber(part, 0)), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

/** #rrggbb (или #rgb) → { r, g, b }; null, если это не цвет. */
export function hexToRgb(hex) {
  const text = String(hex ?? '').trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(text);
  if (short) return { r: parseInt(short[1] + short[1], 16), g: parseInt(short[2] + short[2], 16), b: parseInt(short[3] + short[3], 16) };
  const full = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(text);
  return full ? { r: parseInt(full[1], 16), g: parseInt(full[2], 16), b: parseInt(full[3], 16) } : null;
}

/** Код прицела из игры: «DL.» и base64-подобная строка. Длина — с запасом: настоящие коды около 330 знаков. */
const CODE_PATTERN = /^DL\.[A-Za-z0-9._-]{8,1200}$/;

/** Похоже ли значение на код прицела (в адресе и в поле импорта). */
export function isCrosshairCode(value) {
  return CODE_PATTERN.test(String(value ?? '').trim());
}

/**
 * Код из адреса страницы (?code=DL…): только если он похож на код, иначе null — в запрос к API из адреса
 * попадает лишь проверенная строка.
 * @param {string|URLSearchParams} search
 */
export function codeFromSearch(search) {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const code = (params.get('code') ?? '').trim();
  return isCrosshairCode(code) ? code : null;
}

/**
 * Ввод в поле импорта: готовый код «DL.…» или команды консоли («citadel_crosshair_dot_size 4; …»), которые API
 * тоже понимает. Возвращает строку для запроса или null, если вводить нечего или ввод слишком длинный/странный.
 * @param {string} input
 */
export function importInput(input) {
  const text = String(input ?? '').trim();
  if (!text || text.length > 2000) return null;
  if (isCrosshairCode(text)) return text;
  // Команды консоли: citadel_crosshair_<имя> <значение>, через «;» или перевод строки
  return /^(?:\s*citadel_crosshair_[a-z_]+\s+[-\w.]+\s*(?:;|\r?\n|$))+$/i.test(text) ? text : null;
}

/** Заготовки: частичные настройки поверх значений по умолчанию. Это отправные точки, а не «профессиональные» прицелы. */
export const CROSSHAIR_PRESETS = [
  { id: 'default', settings: {} },
  { id: 'dot', settings: { pip_opacity: 0, pip_outline_opacity: 0, dot_size: 3, dot_opacity: 1, dot_outline_border: 1, dot_outline_opacity: 1 } },
  { id: 'cross', settings: { dot_opacity: 0, dot_outline_opacity: 0, pip_width: 2, pip_height: 10, pip_gap: 6, pip_opacity: 1, pip_outline_opacity: 1 } },
  { id: 'minimal', settings: { pip_width: 1, pip_height: 8, pip_gap: 2, pip_opacity: 1, pip_outline_border: 0, pip_outline_opacity: 0, dot_size: 2, dot_opacity: 1, dot_outline_border: 0, dot_outline_opacity: 0 } },
  { id: 'neon', settings: { color_r: 0, color_g: 255, color_b: 136, pip_opacity: 1, dot_opacity: 1 } },
  { id: 'ember', settings: { color_r: 255, color_g: 98, color_b: 40, pip_opacity: 1, dot_opacity: 1 } },
];

/** Настройки заготовки целиком. */
export function presetSettings(id) {
  const preset = CROSSHAIR_PRESETS.find((p) => p.id === id);
  return normalizeSettings(preset ? preset.settings : {});
}

/** Какой заготовке соответствуют настройки (id) или null, если они свои. */
export function activePreset(settings) {
  return CROSSHAIR_PRESETS.find((preset) => sameSettings(settings, preset.settings))?.id ?? null;
}

/** Высоты экрана для предпросмотра: размеры прицела в игре зависят от высоты экрана. */
export const SCREEN_HEIGHTS = [720, 1080, 1440, 2160];
export const DEFAULT_SCREEN_HEIGHT = 1080;
