import en from './locales/en.js';
import ru from './locales/ru.js';

const locales = { english: en, russian: ru };

export function getTranslation(lang, key, params = {}) {
  const keys = key.split('.');
  let value = locales[lang];
  for (const k of keys) {
    if (value && value[k] !== undefined) {
      value = value[k];
    } else {
      console.warn(`Translation missing for ${key}`);
      return key;
    }
  }

  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (_, name) =>
      params[name] !== undefined ? params[name] : `{${name}}`
    );
  }

  return value;
}

// Правила множественного числа создаются один раз на язык: Intl.PluralRules недёшев в создании
const pluralRules = {};

/**
 * Строка с числом в нужной форме: «1 предмет», «2 предмета», «5 предметов». По ключу лежит объект с формами
 * one / few / many / other (в английском few и many совпадают с other — так наборы ключей языков остаются одинаковыми).
 * @param {string} lang
 * @param {string} key ключ объекта с формами, без суффикса формы
 * @param {number} count
 * @param {Record<string, string|number>} [params] подстановки; {count} уже подставлен
 */
export function getPlural(lang, key, count, params = {}) {
  pluralRules[lang] ??= new Intl.PluralRules(lang === 'russian' ? 'ru' : 'en');
  return getTranslation(lang, `${key}.${pluralRules[lang].select(count)}`, { count, ...params });
}

/**
 * Есть ли у ключа перевод. В отличие от getTranslation, ничего не пишет в консоль: нужен там,
 * где отсутствие перевода — обычный случай (например, названия параметров способностей).
 */
export function hasTranslation(lang, key) {
  let value = locales[lang];
  for (const k of key.split('.')) {
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, k)) {
      value = value[k];
    } else {
      return false;
    }
  }
  return typeof value === 'string';
}
