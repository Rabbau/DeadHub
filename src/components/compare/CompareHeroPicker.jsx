import { forwardRef, useMemo, useState } from 'react';
import HeroIcon from '../hero/HeroIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { COMPARE_COLORS, MAX_COMPARED, filterPicker } from '../../services/compareService';
import { extractRoles } from '../../services/heroService';

/**
 * Выбор героев: поиск, роли и плитки. Выбранные подсвечены цветом своей колонки и пронумерованы в порядке выбора.
 * Ещё одного героя после третьего можно выбрать — самый ранний уступит место (см. nextSelection).
 * @param {{ heroes: any[], selectedIds: number[], onToggle: (id: number) => void, history: Array<{ key: string, ids: number[] }>, onHistory: (ids: number[]) => void }} props
 */
const CompareHeroPicker = forwardRef(function CompareHeroPicker({ heroes, selectedIds, onToggle, history, onHistory }, ref) {
  const t = useTranslation();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const roles = useMemo(() => extractRoles(heroes), [heroes]);
  const shown = useMemo(() => filterPicker(heroes, { search, role }), [heroes, search, role]);
  const nameOf = (id) => heroes.find((hero) => hero.id === id)?.name;

  return (
    <section ref={ref} id="compare-picker" className="cmp-picker" aria-labelledby="cmp-picker-title">
      <h2 id="cmp-picker-title" className="section__title">
        {t('compare.pickerTitle')} <span className="cmp-picker__hint">{t('compare.pickerHint', { count: MAX_COMPARED })}</span>
      </h2>

      {history.length > 0 && (
        <div className="cmp-history">
          <span className="cmp-history__label">{t('compare.history')}</span>
          {history.map((entry) => (
            <button key={entry.key} type="button" className="cmp-history__item" onClick={() => onHistory(entry.ids)}>
              {entry.ids.map(nameOf).filter(Boolean).join(' vs ') || entry.ids.join(', ')}
            </button>
          ))}
        </div>
      )}

      <div className="cmp-picker__bar">
        <input
          type="search"
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('compare.searchPlaceholder')}
          aria-label={t('compare.searchPlaceholder')}
        />
        <div className="chip-group" role="group" aria-label={t('compare.rolesLabel')}>
          <button type="button" className={`chip${role === 'all' ? ' active' : ''}`} aria-pressed={role === 'all'} onClick={() => setRole('all')}>{t('compare.allRoles')}</button>
          {roles.map((name) => (
            <button key={name} type="button" className={`chip${role === name ? ' active' : ''}`} aria-pressed={role === name} onClick={() => setRole(name)}>{name}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="cmp-hint">{t('compare.noResults')}</p>
      ) : (
        <div className="cmp-tiles">
          {shown.map((hero) => {
            const at = selectedIds.indexOf(hero.id);
            const on = at >= 0;
            return (
              <button
                key={hero.id}
                type="button"
                className={`cmp-tile${on ? ' is-on' : ''}`}
                style={on ? { '--c': COMPARE_COLORS[at] } : undefined}
                aria-pressed={on}
                onClick={() => onToggle(hero.id)}
              >
                {on && <b className="cmp-tile__n" aria-hidden="true">{at + 1}</b>}
                <HeroIcon hero={hero} size="md" decorative />
                <span>{hero.name}</span>
                {on && <span className="sr-only">{t('compare.position', { n: at + 1 })}</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
});

export default CompareHeroPicker;
