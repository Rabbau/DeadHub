import { useHeroStore } from '../store/heroStore';
import { getTranslation } from '../i18n';

export function useTranslation() {
  const language = useHeroStore(state => state.language);
  return function t(key) {
    return getTranslation(language, key);
  };
}