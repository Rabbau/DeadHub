import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { FAVORITES_LIMITS } from '../../services/favoritesService';

/**
 * Звезда «в избранное»: наклейка-кнопка с состоянием. onToggle возвращает 'added' | 'removed' | 'full' | 'invalid'
 * (так отвечает favoritesStore); когда место закончилось, рядом на несколько секунд появляется пояснение.
 * @param {{ active: boolean, onToggle: () => string, kind: 'player'|'hero', label: string, activeLabel: string, hint?: string, className?: string }} props
 */
function FavoriteButton({ active, onToggle, kind, label, activeLabel, hint, className = '' }) {
  const t = useTranslation();
  const [full, setFull] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const click = () => {
    const result = onToggle();
    if (result === 'full') {
      setFull(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFull(false), 5000);
    }
  };

  const max = kind === 'hero' ? FAVORITES_LIMITS.heroes : FAVORITES_LIMITS.players;
  return (
    <>
      <button
        type="button"
        className={`tag fav-button${active ? ' tag--role is-on' : ''} ${className}`.trim()}
        aria-pressed={active}
        title={hint}
        onClick={click}
      >
        <span aria-hidden="true">{active ? '★' : '☆'}</span> {active ? activeLabel : label}
      </button>
      {full && <span className="fav-button__full" role="status">{t(kind === 'hero' ? 'favorites.heroFull' : 'favorites.full', { max })}</span>}
    </>
  );
}

export default FavoriteButton;
