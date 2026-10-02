import { useMemo, useState } from 'react';
import HeroIcon from '../hero/HeroIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { DRAFT_LISTS } from '../../services/draftService';
import { normalizeQuery } from '../../services/searchService';

const LIST_KEYS = { enemies: 'draft.enemies', allies: 'draft.allies', excluded: 'draft.excluded' };
const STATE_KEYS = { enemies: 'draft.stateEnemy', allies: 'draft.stateAlly', excluded: 'draft.stateExcluded' };

/** В каком списке драфта сейчас герой (или null). */
function listOf(selection, id) {
  return DRAFT_LISTS.find((list) => selection[list].includes(id)) ?? null;
}

/**
 * Выбор героев: переключатель «куда добавлять» (враги / союзники / недоступны), поиск и сетка героев.
 * Нажатие на героя добавляет его в выбранный список, а если он там уже есть — убирает. Герой, который лежит
 * в другом списке, переедет в выбранный.
 * @param {{
 *   heroes: Array<object>, selection: object, mode: string, onMode: (mode: string) => void,
 *   onToggle: (heroId: number) => void, full: boolean
 * }} props full — в выбранном списке нет места (подсказка показывается под сеткой)
 */
function DraftPicker({ heroes, selection, mode, onMode, onToggle, full }) {
  const t = useTranslation();
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = normalizeQuery(query);
    return q ? heroes.filter((hero) => normalizeQuery(hero.name).includes(q)) : heroes;
  }, [heroes, query]);

  return (
    <section className="draft-picker" aria-label={t('draft.pickerLabel')}>
      <div className="draft-picker__bar">
        <span className="stats-filters__label">{t('draft.addToLabel')}</span>
        <div className="chip-group" role="group" aria-label={t('draft.addToLabel')}>
          {DRAFT_LISTS.map((list) => (
            <button
              key={list}
              type="button"
              className={`chip draft-mode draft-mode--${list}${mode === list ? ' active' : ''}`}
              aria-pressed={mode === list}
              onClick={() => onMode(list)}
            >
              {t(LIST_KEYS[list])}
            </button>
          ))}
        </div>
        <div className="filters__search draft-picker__search">
          <span className="filters__search-icon" aria-hidden="true">&gt;</span>
          <input
            type="text"
            className="input"
            placeholder={t('draft.search')}
            aria-label={t('draft.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="matchup-picker draft-grid" role="group" aria-label={t('draft.pickerLabel')}>
        {shown.map((hero) => {
          const list = listOf(selection, hero.id);
          return (
            <button
              key={hero.id}
              type="button"
              className={`matchup-pick draft-pick${list ? ` draft-pick--${list}` : ''}`}
              aria-pressed={list === mode}
              aria-label={list ? `${hero.name} — ${t(STATE_KEYS[list])}` : hero.name}
              title={list ? `${hero.name} — ${t(STATE_KEYS[list])}` : hero.name}
              onClick={() => onToggle(hero.id)}
            >
              <HeroIcon hero={hero} size="md" decorative />
              <span>{hero.name}</span>
            </button>
          );
        })}
        {shown.length === 0 && <p className="matchup-panel__empty">{t('draft.noHero')}</p>}
      </div>

      <p className="draft-picker__hint" role="status">{full ? t('draft.full') : ''}</p>
    </section>
  );
}

export default DraftPicker;
