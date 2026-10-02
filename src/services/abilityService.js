/**
 * @fileoverview Свойства способностей: что показываем сразу, а что прячем под «все параметры».
 * Без React и без API.
 */

/**
 * Ключ свойства словами: «DragonSearchRadius» → «Dragon search radius».
 * Так выглядят внутренние параметры игры, у которых нет перевода: сырой ключ ничего не говорит игроку.
 * @param {string} key
 */
export function humanizeKey(key) {
  const words = String(key ?? '')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Делит свойства способности на основные (у ключа есть перевод в локалях) и остальные — внутренние
 * параметры вроде DragonSearchRadius. Основные показываются сразу, остальные — под спойлером.
 * @param {Array<[string, any]>} entries пары [ключ, свойство]
 * @param {(key: string) => boolean} hasLabel есть ли у ключа перевод
 * @returns {{ main: Array<[string, any]>, extra: Array<[string, any]> }}
 */
export function splitAbilityProps(entries, hasLabel) {
  const main = [];
  const extra = [];
  entries.forEach((entry) => (hasLabel(entry[0]) ? main : extra).push(entry));
  return { main, extra };
}
