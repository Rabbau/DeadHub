import { useEffect, useState } from 'react';
import { fetchSpawnTimers } from '../api/index.js';

/**
 * Время появления лагерей и ящиков (см. fetchSpawnTimers). Не вышло получить — вернётся null: карта работает и без
 * таймеров, просто без шкалы времени и без «появляется на …» в подсказках.
 * @param {boolean} [enabled] запрос уходит только когда таймеры нужны
 */
export function useSpawnTimers(enabled = true) {
  const [timers, setTimers] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetchSpawnTimers()
      .then((result) => { if (!cancelled) setTimers(result); })
      .catch(() => { if (!cancelled) setTimers(null); });
    return () => { cancelled = true; };
  }, [enabled]);

  return timers;
}
