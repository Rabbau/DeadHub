import { useEffect, useState } from 'react';

/**
 * Значение, которое обновляется спустя `delayMs` после последнего изменения. Нужно там, где каждое изменение
 * (движение ползунка) стоило бы запроса к бесплатному API: запрос уходит, когда посетитель остановился.
 * @template T
 * @param {T} value
 * @param {number} [delayMs]
 * @returns {T}
 */
export function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
