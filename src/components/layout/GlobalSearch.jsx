import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

// Окно поиска нужно только после открытия, поэтому его код грузится отдельным файлом. Чтобы первые символы,
// набранные сразу после «/», не потерялись, файл подгружается заранее — в паузе после загрузки страницы
const loadDialog = () => import('./SearchDialog');
const SearchDialog = lazy(loadDialog);

/** Печатает ли посетитель сейчас в поле ввода: тогда горячая клавиша `/` должна остаться обычным символом. */
function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Кнопка поиска в шапке и окно поиска. Открывается кнопкой, клавишей `/` (когда посетитель не печатает
 * в поле) или Ctrl/⌘+K; закрывается Esc, щелчком снаружи и после выбора.
 */
function GlobalSearch() {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTypingTarget(event.target);
      const palette = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey);
      if (slash || palette) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Подгрузка файла окна, пока браузер свободен
  useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(loadDialog, { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(loadDialog, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Пока окно открыто, страница под ним не прокручивается; после закрытия фокус возвращается на кнопку
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trigger = triggerRef.current;
    return () => {
      document.body.style.overflow = previous;
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="nav__search"
        aria-label={t('search.open')}
        aria-keyshortcuts="/"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        onPointerEnter={loadDialog}
        onFocus={loadDialog}
      >
        <svg className="nav__search-icon" viewBox="0 0 12 12" width="14" height="14" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M3 0h4v1h2v1h1v1h1v4h-1v1h-1v1H8v1H7l2 2-1 1-2-2H3v-1H2V9H1V8H0V3h1V2h1V1h1zM3 2v1H2v4h1v1h4V7h1V3H7V2z" />
        </svg>
        <span className="nav__search-label">{t('search.button')}</span>
        <kbd className="nav__search-key" aria-hidden="true">/</kbd>
      </button>
      {open && (
        <Suspense fallback={null}>
          <SearchDialog onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

export default GlobalSearch;
