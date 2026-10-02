/**
 * @fileoverview Правила безопасного разбора HTML из внешних источников (заметки об обновлениях Steam).
 * Здесь только решения «что пропускать» — без React и без DOM, чтобы их можно было проверить тестами.
 * Сам разбор и вывод в React делает компонент RichHtml, он не использует dangerouslySetInnerHTML.
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
 * Пропускаем только https. Steam оборачивает внешние ссылки в страницу-предупреждение
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
    return url.protocol === 'https:' && STEAM_IMAGE_HOST.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}
