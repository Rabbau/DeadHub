/**
 * @fileoverview Обновления игры: какое из них последнее и насколько оно свежее. Без React и без API.
 */

const DAY_S = 24 * 60 * 60;

/** Пока обновлению меньше этого срока, окно «30 дней» наполовину состоит из данных до патча. */
export const FRESH_PATCH_DAYS = 21;

/**
 * Последнее обновление из списка (список уже отсортирован: новые сверху).
 * @param {Array<{ at: number }>} patches
 */
export function latestPatch(patches) {
  return Array.isArray(patches) && patches.length > 0 ? patches[0] : null;
}

/**
 * @param {{ at: number }|null} patch
 * @param {number} [nowMs]
 * @param {number} [days]
 */
export function isFreshPatch(patch, nowMs = Date.now(), days = FRESH_PATCH_DAYS) {
  return Boolean(patch) && nowMs / 1000 - patch.at < days * DAY_S;
}

/** «Minor Update - 09-16-2026» → «Minor Update»; «City Never Sleeps» остаётся как есть. */
export function patchName(title) {
  const name = String(title ?? '').replace(/\s*[-–—]\s*\d{1,2}-\d{1,2}-\d{4}\s*$/, '').trim();
  return name || String(title ?? '');
}

const MAX_PATCHES = 12;

/**
 * guid в ленте — не строка, а объект { is_perma_link, text }; для новостей Steam text — ссылка на новость.
 * По id обновления помним, какое из них посетитель уже открывал, и различаем записи в списке.
 */
function patchId(row) {
  const guid = typeof row?.guid === 'string' ? row.guid : row?.guid?.text;
  return String(guid || row?.link || row?.title || '');
}

/**
 * Лента /v2/patches смешивает новости Steam и темы форума. Новости Steam — это анонсы обновлений
 * игры («Minor Update — дата», «City Never Sleeps») с текстом заметок, а форумные записи лишь
 * дублируют их ссылкой без текста, поэтому оставляем только Steam. Время поста совпадает с выходом
 * обновления.
 * @param {any[]} rows ответ API
 * @returns {Array<{ id: string, title: string, at: number, link: string|null, html: string }>}
 *   новые сверху, at — unix-секунды, html — текст заметок (его нужно выводить через RichHtml)
 */
export function slimPatches(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.source === 'steam')
    .map((row) => ({
      id: patchId(row),
      title: String(row.title || '').trim(),
      at: Math.floor(Date.parse(row.pub_date) / 1000),
      link: row.link || null,
      html: String(row.content || ''),
    }))
    .filter((patch) => {
      if (!patch.id || !Number.isFinite(patch.at) || !patch.title || seen.has(patch.id)) return false;
      seen.add(patch.id);
      return true;
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_PATCHES);
}
