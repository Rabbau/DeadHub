import { useHeroStore } from '../store/heroStore';
import { getPlural, getTranslation, hasTranslation } from '../i18n';

/**
 * Возвращает функцию перевода t(ключ, параметры); t.has(ключ) проверяет, есть ли у ключа перевод,
 * не засоряя консоль предупреждениями; t.plural(ключ, число, параметры) берёт форму слова под число
 * («1 предмет», «2 предмета», «5 предметов»).
 */
export function useTranslation() {
  const language = useHeroStore(state => state.language);
  function t(key, params = {}) {
    return getTranslation(language, key, params);
  }
  t.has = (key) => hasTranslation(language, key);
  t.plural = (key, count, params = {}) => getPlural(language, key, count, params);
  return t;
}
