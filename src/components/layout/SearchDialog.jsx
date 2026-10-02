import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchIndex } from '../../hooks/useSearchIndex';
import { useTranslation } from '../../hooks/useTranslation';
import { useProfileStore } from '../../store/profileStore';
import { matchAction, playerAction, searchEntries } from '../../services/searchService';

function Option({ id, active, entry, onChoose, onHover }) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      className={`search-option${active ? ' is-active' : ''}`}
      onMouseMove={onHover}
      onClick={onChoose}
    >
      {entry.icon !== undefined && (
        entry.icon
          ? <img src={entry.icon} alt="" className="search-option__img" loading="lazy" decoding="async" />
          : <span className="search-option__img search-option__img--empty" aria-hidden="true" />
      )}
      <span className="search-option__name">{entry.name}</span>
      {entry.sub && <span className="search-option__sub">{entry.sub}</span>}
    </div>
  );
}

/**
 * Окно поиска: герои, предметы, разделы сайта; для игроков — «открыть профиль» или «искать по нику».
 * Монтируется только когда открыто, поэтому до первого обращения не загружает ничего.
 */
function SearchDialog({ onClose }) {
  const t = useTranslation();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // «Мой профиль» находится по названию, только если он выбран
  const hasProfile = useProfileStore((state) => Boolean(state.me));
  const extraPages = useMemo(
    () => (hasProfile ? [{ to: '/me', name: t('nav.myProfile') }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- подпись обновится вместе с языком через pages
    [hasProfile],
  );
  const { entries, pages, itemsLoading } = useSearchIndex({ query, extraPages });

  // Плоский список вариантов в порядке показа: по нему ходят стрелки; группы — только оформление
  const { groups, flat } = useMemo(() => {
    const trimmed = query.trim();
    const found = trimmed
      ? searchEntries(entries, trimmed)
      // Пока ничего не набрано — разделы сайта как быстрые переходы
      : [{ type: 'page', results: pages.filter((page) => page.to !== '/') }];
    const action = playerAction(trimmed);
    // Длинное число — это и Account ID, и номер матча: предлагаем оба действия
    const matchOpen = matchAction(trimmed);
    const list = found.flatMap((group) => group.results.map((entry) => ({ ...entry, group: group.type })));
    if (action) {
      list.push({
        group: 'player',
        type: 'player',
        id: action.to,
        to: action.to,
        name: action.kind === 'open' ? t('search.openPlayer', { id: action.id }) : t('search.findPlayers', { query: action.query }),
      });
    }
    if (matchOpen) {
      list.push({ group: 'match', type: 'match', id: matchOpen.to, to: matchOpen.to, name: t('search.openMatch', { id: matchOpen.id }) });
    }
    const order = [...found.map((group) => group.type), ...(action ? ['player'] : []), ...(matchOpen ? ['match'] : [])];
    return {
      groups: order.map((type) => ({ type, items: list.filter((entry) => entry.group === type) })),
      flat: list,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- подписи зависят от языка, а он уже учтён в entries
  }, [query, entries, pages]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Выбранный стрелками вариант должен быть виден в прокручиваемом списке
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const choose = (entry) => {
    if (!entry) return;
    onClose();
    navigate(entry.to);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (flat.length ? (index + 1) % flat.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (flat.length ? (index - 1 + flat.length) % flat.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(flat[active]);
    } else if (event.key === 'Tab') {
      event.preventDefault(); // фокус остаётся в поле: окно модальное
    }
  };

  const groupTitle = (type) => t(`search.groups.${type}`);
  let optionIndex = -1;

  return (
    <div className="search-overlay" onMouseDown={onClose}>
      <div
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('search.label')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="search-dialog__input-row">
          <span className="search-dialog__prompt" aria-hidden="true">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            className="search-dialog__input"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={flat.length ? `${listId}-${active}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <button type="button" className="search-dialog__close" onClick={onClose} aria-label={t('search.close')}>Esc</button>
        </div>

        <div id={listId} role="listbox" aria-label={t('search.label')} className="search-dialog__results">
          {groups.map((group) => (
            <div key={group.type} role="group" aria-label={groupTitle(group.type)} className="search-group">
              <div className="search-group__title">{groupTitle(group.type)}</div>
              {group.items.map((entry) => {
                optionIndex += 1;
                const index = optionIndex;
                return (
                  <Option
                    key={`${entry.group}-${entry.id}`}
                    id={`${listId}-${index}`}
                    active={index === active}
                    entry={entry}
                    onChoose={() => choose(entry)}
                    onHover={() => setActive(index)}
                  />
                );
              })}
            </div>
          ))}

          {query.trim() && flat.every((entry) => entry.group === 'player' || entry.group === 'match') && !itemsLoading && (
            <p className="search-dialog__empty">{t('search.nothing')}</p>
          )}
          {itemsLoading && <p className="search-dialog__empty">{t('search.loadingItems')}</p>}
        </div>

        <div className="search-dialog__hint" aria-hidden="true">{t('search.hint')}</div>
      </div>
    </div>
  );
}

export default SearchDialog;
