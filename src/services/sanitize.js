/**
 * @fileoverview Правила безопасного разбора HTML из внешних источников: заметки об обновлениях Steam (RichHtml)
 * и описания способностей из API (TooltipHtml). Здесь только решения «что пропускать» — без React и без DOM, чтобы
 * их можно было проверить тестами. Сам разбор и вывод в React делают компоненты, они не используют
 * dangerouslySetInnerHTML: из разобранного дерева собираются новые элементы, куда попадает только то, что
 * разрешили эти правила (теги, классы, цвета, значения атрибутов SVG, адреса картинок и ссылок).
 */

/** Теги, которые выводим как есть. В заметках Steam встречаются p, br, b, i, a, img; остальное — про запас. */
export const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

/** Теги без содержимого. */
export const VOID_TAGS = new Set(['br', 'hr', 'img']);

/** Эти теги выбрасываются вместе с содержимым; прочие неизвестные «разворачиваются» (остаётся текст). */
export const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button',
  'textarea', 'select', 'option', 'link', 'meta', 'base', 'svg', 'math', 'video', 'audio', 'source',
  'canvas', 'noscript', 'template', 'title', 'head',
]);

const MAX_REDIRECT_DEPTH = 2;
const STEAM_IMAGE_HOST = /(^|\.)steamstatic\.com$/i;

/**
 * Безопасный адрес ссылки или null (тогда ссылку не выводим, остаётся только текст).
 * Пропускаем только https и без логина с паролем в адресе: `https://steamcommunity.com@evil.example/` ведёт на
 * evil.example, хотя выглядит как ссылка в Steam. Steam оборачивает внешние ссылки в страницу-предупреждение
 * (steamcommunity.com/linkfilter/?u=...) — ведём сразу на цель.
 * @param {string|null|undefined} href
 * @param {string} [base] — база для относительных адресов
 * @param {number} [depth]
 * @returns {string|null}
 */
export function safeHref(href, base = 'https://store.steampowered.com/', depth = 0) {
  if (typeof href !== 'string' || href.trim() === '' || depth > MAX_REDIRECT_DEPTH) return null;

  let url;
  try {
    url = new URL(href.trim(), base);
  } catch {
    return null;
  }

  if (url.hostname === 'steamcommunity.com' && url.pathname.replace(/\/+$/, '') === '/linkfilter') {
    const target = url.searchParams.get('u');
    return target ? safeHref(target, base, depth + 1) : null;
  }
  if (url.username || url.password) return null;
  return url.protocol === 'https:' ? url.href : null;
}

/**
 * Адрес картинки или null. Картинки пропускаем только с CDN Steam (в заметках других нет):
 * произвольные адреса позволили бы отслеживать посетителей.
 * @param {string|null|undefined} src
 * @returns {string|null}
 */
export function safeImageSrc(src) {
  if (typeof src !== 'string') return null;
  try {
    const url = new URL(src.trim());
    if (url.username || url.password) return null;
    return url.protocol === 'https:' && STEAM_IMAGE_HOST.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

// ── Описания способностей ────────────────────────────────────────────────────────────────────────────────────────────
// Разметка игры: <span class="highlight" style="color: #0F9;">, <br>, значки-картинки <img class="inline-attribute …">,
// иконки <svg> с path/g/rect/clipPath и служебный <Panel …>, который никто не закрывает. Всё это нужно показать,
// но ничего другого внутрь страницы пускать нельзя: описания приходят от стороннего API.

/** HTML-теги описаний. Остальные известные теги разворачиваются, опасные — в TOOLTIP_DROP_TAGS. */
export const TOOLTIP_TAGS = new Set(['span', 'br', 'b', 'strong', 'i', 'em', 'u', 'img']);

/** В описаниях выбрасываются те же теги, что в заметках, кроме svg: иконки внутри него разбираются отдельно. */
export const TOOLTIP_DROP_TAGS = new Set([...DROP_TAGS].filter((tag) => tag !== 'svg'));

/**
 * Элементы SVG, которые нужны иконкам. Ключ — имя в нижнем регистре (парсер HTML сохраняет у SVG регистр, например
 * clipPath), значение — написание для React. Всё остальное внутри svg (script, style, foreignObject, use, image,
 * a, animate…) выбрасывается вместе с содержимым.
 */
export const SVG_TAGS = new Map([
  ['svg', 'svg'], ['g', 'g'], ['path', 'path'], ['rect', 'rect'], ['circle', 'circle'], ['ellipse', 'ellipse'],
  ['line', 'line'], ['polyline', 'polyline'], ['polygon', 'polygon'], ['defs', 'defs'], ['clippath', 'clipPath'],
]);

/** Значки в описаниях лежат в хранилище ассетов API; картинки с других адресов не пропускаем (слежка за посетителем). */
const TOOLTIP_IMAGE_HOST = 'assets-bucket.deadlock-api.com';
const TOOLTIP_IMAGE_PATH = '/assets-api-res/images/';

/**
 * Безопасный адрес значка в описании или null: только https, только хранилище ассетов API, без логина и пароля.
 * @param {string|null|undefined} src
 * @returns {string|null}
 */
export function safeTooltipImageSrc(src) {
  if (typeof src !== 'string') return null;
  try {
    const url = new URL(src.trim());
    const ok = url.protocol === 'https:' && url.hostname === TOOLTIP_IMAGE_HOST && !url.username && !url.password
      && url.pathname.startsWith(TOOLTIP_IMAGE_PATH);
    return ok ? url.href : null;
  } catch {
    return null;
  }
}

// Классы описаний: те, что встречаются в данных (highlight, diminish, highlight_spirit, inline-attribute-label,
// inline-attribute, AbilityPropertyIcon…), и «предмет подписи» после них (SpiritDamage, prop_slow). Любой другой класс
// отбрасывается: чужое имя могло бы включить правила CSS самого сайта (например, наложение на всю страницу).
const CLASS_HEADS = new Set([
  'highlight', 'diminish', 'highlight_spirit', 'highlight_special', 'highlight_courage',
  'inline-attribute-label', 'inline-attribute', 'AbilityPropertyIcon', 'InlineAttributeIcon', 'InlineAttributeName',
]);
const CLASS_SUBJECT = /^(?:[A-Z][A-Za-z0-9]{0,39}|prop_[a-z0-9_]{1,39})$/;
const MAX_CLASS_TOKENS = 6;

/**
 * Атрибут class описания: известные классы и их подпись либо null, если не осталось ничего.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function safeClassName(value) {
  if (typeof value !== 'string') return null;
  const tokens = value.split(/\s+/).filter(Boolean).slice(0, MAX_CLASS_TOKENS);
  const heads = tokens.filter((token) => CLASS_HEADS.has(token));
  // Подпись без известного класса рядом (class="Slow") ничего не значит и пропущена не будет
  const subjects = heads.length > 0 ? tokens.filter((token) => !CLASS_HEADS.has(token) && CLASS_SUBJECT.test(token)) : [];
  const result = [...heads, ...subjects];
  return result.length > 0 ? result.join(' ') : null;
}

const TEXT_COLOR = /^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/;

/**
 * Цвет текста из style описания. В данных встречается только `color: #0F9;` — его и оставляем; любой другой стиль
 * (положение, размеры, url(), expression…) отбрасывается целиком.
 * @param {string|null|undefined} style
 * @returns {string|null}
 */
export function safeTextColor(style) {
  if (typeof style !== 'string') return null;
  const declarations = style.split(';').map((part) => part.trim()).filter(Boolean);
  if (declarations.length !== 1) return null;
  const match = /^color\s*:\s*(.+)$/i.exec(declarations[0]);
  if (!match) return null;
  const value = match[1].trim();
  return TEXT_COLOR.test(value) ? value : null;
}

// Значения атрибутов SVG. Все — «белые списки» символов: адреса (href, xlink:href), обработчики (onload…), style и
// ссылки url() наружу сюда не проходят вообще.
const MAX_PATH_DATA_LENGTH = 20_000;
const LENGTH = /^\d{1,4}(?:\.\d{1,3})?(?:px|em|rem|%)?$/;
const NUMBER = /^-?\d{1,6}(?:\.\d{1,6})?$/;
const UNIT = /^(?:0|1|0?\.\d{1,4}|1\.0{1,4})$/;
const PAINT = /^(?:none|currentColor|#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/;
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/;
const POINTS = /^[0-9eE.,+\-\s]*$/;
const TRANSFORM = /^(?:\s*(?:translate|rotate|scale|matrix|skewX|skewY)\(\s*[0-9eE.,+\-\s]*\))+\s*$/;
const VIEW_BOX = /^-?\d+(?:\.\d+)?(?:[\s,]+-?\d+(?:\.\d+)?){3}$/;
const SVG_ID = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const LOCAL_URL = /^url\(#([A-Za-z][A-Za-z0-9_.-]{0,63})\)$/;

const matching = (pattern) => (value) => (pattern.test(value) ? value : null);
const oneOf = (...allowed) => (value) => (allowed.includes(value) ? value : null);

/**
 * Атрибут SVG (имя в нижнем регистре) → как он называется в React и функция проверки значения: возвращает значение
 * для вывода или null, если оно не подходит. Второй аргумент проверки — префикс идентификаторов.
 */
const SVG_ATTRIBUTES = new Map([
  ['width', ['width', matching(LENGTH)]],
  ['height', ['height', matching(LENGTH)]],
  ['viewbox', ['viewBox', matching(VIEW_BOX)]],
  ['fill', ['fill', matching(PAINT)]],
  ['stroke', ['stroke', matching(PAINT)]],
  ['fill-opacity', ['fillOpacity', matching(UNIT)]],
  ['stroke-opacity', ['strokeOpacity', matching(UNIT)]],
  ['opacity', ['opacity', matching(UNIT)]],
  ['fill-rule', ['fillRule', oneOf('nonzero', 'evenodd')]],
  ['clip-rule', ['clipRule', oneOf('nonzero', 'evenodd')]],
  ['stroke-width', ['strokeWidth', matching(NUMBER)]],
  ['stroke-linecap', ['strokeLinecap', oneOf('butt', 'round', 'square')]],
  ['stroke-linejoin', ['strokeLinejoin', oneOf('miter', 'round', 'bevel')]],
  ['d', ['d', (value) => (value.length <= MAX_PATH_DATA_LENGTH && PATH_DATA.test(value) ? value : null)]],
  ['points', ['points', (value) => (value.length <= MAX_PATH_DATA_LENGTH && POINTS.test(value) ? value : null)]],
  ['transform', ['transform', matching(TRANSFORM)]],
  ...['x', 'y', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2'].map((name) => [name, [name, matching(NUMBER)]]),
  // Идентификаторы и ссылки на них получают префикс экземпляра: иначе одинаковые id в разных описаниях
  // (clip0_…) ссылались бы друг на друга, а ссылка допускается только на элемент этого же описания
  ['id', ['id', (value, prefix) => (SVG_ID.test(value) ? `${prefix}${value}` : null)]],
  ['clip-path', ['clipPath', (value, prefix) => {
    const match = LOCAL_URL.exec(value);
    return match ? `url(#${prefix}${match[1]})` : null;
  }]],
]);

/**
 * Свойства React для элемента SVG: только перечисленные атрибуты и только проверенные значения.
 * Всё остальное (class, style, href, xlink:href, on*, xmlns…) отбрасывается.
 * @param {Record<string, string>} attributes сырые атрибуты элемента: имя → значение
 * @param {string} [idPrefix] префикс для id и ссылок на них
 * @returns {Record<string, string>}
 */
export function safeSvgProps(attributes, idPrefix = '') {
  const props = {};
  for (const [rawName, rawValue] of Object.entries(attributes ?? {})) {
    const rule = SVG_ATTRIBUTES.get(String(rawName).toLowerCase());
    if (!rule || typeof rawValue !== 'string') continue;
    const checked = rule[1](rawValue.trim(), idPrefix);
    if (checked !== null) props[rule[0]] = checked;
  }
  return props;
}
