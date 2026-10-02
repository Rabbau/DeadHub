import { useCallback, useState } from 'react';

/**
 * Выбор из фиксированного набора значений, который запоминается в localStorage (вид списка, вкладка).
 * Неизвестное сохранённое значение игнорируется; без localStorage выбор просто живёт до перезагрузки.
 * @template {string} T
 * @param {string} storageKey
 * @param {readonly T[]} allowed допустимые значения
 * @param {T} fallback значение, пока посетитель ничего не выбирал
 * @returns {[T, (value: T) => void]}
 */
export function useStoredChoice(storageKey, allowed, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return allowed.includes(saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  });

  const choose = useCallback((next) => {
    setValue(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // не критично: выбор просто не переживёт перезагрузку
    }
  }, [storageKey]);

  return [value, choose];
}
