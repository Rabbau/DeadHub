import { useId } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { SHOP_SLOTS, SORTS } from '../../services/shopService';
import { CloseIcon, SearchIcon } from './ItemIcons';
import { SLOT_KEYS } from './labels';

const KINDS = [
  { id: 'all', key: 'itemsPage.kindAll' },
  { id: 'active', key: 'itemsPage.kindActive' },
  { id: 'passive', key: 'itemsPage.kindPassive' },
];

/** Флажок в стиле сайта: настоящий input поверх нарисованного квадрата, число рядом с подписью. */
function Check({ checked, onChange, label, count, title }) {
  return (
    <label className="items-check" title={title}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="items-check__box" aria-hidden="true" />
      <span>{label}</span>
      {count != null && <small>{count}</small>}
    </label>
  );
}

/**
 * Панель фильтров страницы предметов: поиск, слоты (с числом предметов), тип, флажки «Corrupted» и «Отключённые»
 * и сортировка. Состояние хранит страница; панель только показывает его и сообщает об изменениях.
 * @param {{
 *   value: { search: string, slot: string, kind: string, corruptible: boolean, showDisabled: boolean, sort: string },
 *   onChange: (patch: object) => void,
 *   slotCounts: { all: number, weapon: number, vitality: number, spirit: number },
 *   corruptibleCount: number, disabledCount: number, showSort: boolean,
 *   searchRef: import('react').RefObject<HTMLInputElement>,
 * }} props
 */
function ItemsToolbar({ value, onChange, slotCounts, corruptibleCount, disabledCount, showSort, searchRef }) {
  const t = useTranslation();
  const sortId = useId();

  const slots = [{ id: 'all', label: t('itemsPage.slotAll') }, ...SHOP_SLOTS.map((slot) => ({ id: slot, label: t(SLOT_KEYS[slot]) }))];

  return (
    <section className="items-filters" aria-label={t('filters.title')}>
      <div className="items-filters__row">
        <div className="items-search">
          <SearchIcon />
          <input
            ref={searchRef}
            type="text"
            className="items-search__input"
            placeholder={t('itemsPage.searchPlaceholder')}
            aria-label={t('itemsPage.searchLabel')}
            aria-keyshortcuts="/"
            autoComplete="off"
            spellCheck={false}
            value={value.search}
            onChange={(event) => onChange({ search: event.target.value })}
            onKeyDown={(event) => { if (event.key === 'Escape' && value.search) onChange({ search: '' }); }}
          />
          {value.search
            ? (
              <button type="button" className="items-search__clear" aria-label={t('itemsPage.searchClear')} onClick={() => { onChange({ search: '' }); searchRef.current?.focus(); }}>
                <CloseIcon />
              </button>
            )
            : <kbd className="items-search__key" aria-hidden="true">/</kbd>}
        </div>

        <div className="items-chips" role="group" aria-label={t('itemsPage.slotFilter')}>
          {slots.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`items-chip items-chip--${id}${value.slot === id ? ' is-on' : ''}`}
              aria-pressed={value.slot === id}
              onClick={() => onChange({ slot: id })}
            >
              {id !== 'all' && <i aria-hidden="true" />}
              {label}
              <small>{slotCounts[id]}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="items-filters__row items-filters__row--bottom">
        <div className="items-kind" role="group" aria-label={t('itemsPage.kindFilter')}>
          <span className="items-label" aria-hidden="true">{t('itemsPage.kindFilter')}</span>
          {KINDS.map(({ id, key }) => (
            <button
              key={id}
              type="button"
              className={`items-chip items-chip--sm${value.kind === id ? ' is-on' : ''}`}
              aria-pressed={value.kind === id}
              onClick={() => onChange({ kind: id })}
            >
              {t(key)}
            </button>
          ))}
        </div>

        <div className="items-options">
          <Check
            checked={value.corruptible}
            onChange={(corruptible) => onChange({ corruptible })}
            label={t('itemsPage.corruptible')}
            count={corruptibleCount}
            title={t('itemsPage.corruptibleHint')}
          />
          {disabledCount > 0 && (
            <Check
              checked={value.showDisabled}
              onChange={(showDisabled) => onChange({ showDisabled })}
              label={t('itemsPage.showDisabled')}
              count={disabledCount}
            />
          )}
          {showSort && (
            <div className="items-sort">
              <label className="items-label" htmlFor={sortId}>{t('itemsPage.sort')}</label>
              <select id={sortId} className="select" value={value.sort} onChange={(event) => onChange({ sort: event.target.value })}>
                {SORTS.map((sort) => <option key={sort} value={sort}>{t(`itemsPage.sorts.${sort}`)}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ItemsToolbar;
