import { useCallback, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

const STORAGE_KEY = 'dlhub_hero_view';

function readSaved() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'cards' || value === 'table' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Вид списка героев: «карточки» или «таблица». Выбор запоминается. Пока посетитель сам ничего не выбирал,
 * на телефоне открывается таблица (38 карточек — это шесть тысяч пикселей прокрутки, таблица — меньше двух),
 * на остальных экранах — карточки.
 * @returns {['cards'|'table', (view: 'cards'|'table') => void]}
 */
export function useHeroView() {
  const narrow = useMediaQuery('(max-width: 720px)');
  const [saved, setSaved] = useState(readSaved);

  const setView = useCallback((view) => {
    setSaved(view);
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // не критично: выбор просто не переживёт перезагрузку
    }
  }, []);

  return [saved ?? (narrow ? 'table' : 'cards'), setView];
}
