/**
 * @fileoverview Работа с текстом из API. Без React и без запросов.
 */

/**
 * Описания предметов приходят с HTML-разметкой (<span class="highlight">, <br>).
 * Для обычного текста снимаем теги; <br> превращаем в перенос строки.
 * DOMParser строит «мёртвый» документ: скрипты не выполняются и ресурсы не грузятся.
 * @param {string|null|undefined} html
 * @returns {string}
 */
export function htmlToText(html) {
  if (!html) return '';
  const withBreaks = String(html).replace(/<br\s*\/?>/gi, '\n');
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}
