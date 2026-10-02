import { useHeroStore } from '../store/heroStore';
import { getTranslation, hasTranslation } from '../i18n';

/**
 * Возвращает функцию перевода t(ключ, параметры); t.has(ключ) проверяет, есть ли у ключа перевод,
 * не засоряя консоль предупреждениями.
 */
export function useTranslation() {
  const language = useHeroStore(state => state.language);
  function t(key, params = {}) {
    return getTranslation(language, key, params);
  }
  t.has = (key) => hasTranslation(language, key);
  return t;
}
