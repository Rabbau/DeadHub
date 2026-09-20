import { useEffect, useState } from 'react';
import { fetchRanks } from '../api/index.js';
import { useHeroStore } from '../store/heroStore.js';

/**
 * Ранги с названиями на языке интерфейса. Пока не загрузились — пустой массив
 * (потребители показывают запасной вариант, а не ждут).
 */
export function useRanks() {
  const language = useHeroStore((state) => state.language);
  const [ranks, setRanks] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchRanks(language)
      .then((list) => { if (!cancelled) setRanks(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [language]);

  return ranks;
}
