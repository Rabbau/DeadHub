import en from './locales/en.js';
import ru from './locales/ru.js';

const locales = { english: en, russian: ru };

export function getTranslation(lang, key) {
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
  return value;
}