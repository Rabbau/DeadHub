import { useState } from 'react';
import Avatar from '../ui/Avatar';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePlayerSearch } from '../../hooks/usePlayers';
import { useTranslation } from '../../hooks/useTranslation';
import { toAccountId } from '../../services/playerService';

/**
 * Выбор игрока: поле для ника, Account ID, SteamID64 или ссылки на профиль, результаты поиска и быстрые варианты
 * («Я», недавние, избранные). Поиск по нику уходит, когда посетитель перестал печатать; ID и ссылки поиска не требуют.
 * @param {{ label: string, quick: Array<{ id: number, name: string|null, avatar: string|null, group: string }>, onPick: (id: number) => void }} props
 */
function PlayerPicker({ label, quick, onPick }) {
  const t = useTranslation();
  const [input, setInput] = useState('');
  const text = input.trim();
  const direct = toAccountId(text);
  const query = useDebouncedValue(direct ? '' : text, 500);
  const { results, loading, error } = usePlayerSearch(query);
  const showResults = !direct && query.length >= 2 && query === text;

  const submit = (event) => {
    event.preventDefault();
    if (direct) onPick(direct);
  };

  return (
    <div className="picker">
      <form className="player-search" onSubmit={submit} role="search" aria-label={label}>
        <div className="filters__search">
          <span className="filters__search-icon" aria-hidden="true">&gt;</span>
          <input
            type="text"
            className="input"
            placeholder={t('versus.placeholder')}
            aria-label={`${label}: ${t('versus.placeholder')}`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
        {direct && <button type="submit" className="btn btn-primary">{t('versus.choose')} · {direct}</button>}
      </form>

      {showResults && (
        <div className="picker__results" aria-live="polite">
          {loading ? (
            <p className="picker__hint">{t('versus.searching')}</p>
          ) : error ? (
            <p className="picker__hint">{t('versus.searchError')}</p>
          ) : results.length === 0 ? (
            <p className="picker__hint">{t('versus.noResults')}</p>
          ) : (
            <ul className="picker__list">
              {results.slice(0, 6).map((player) => (
                <li key={player.id}>
                  <button type="button" className="picker__row" onClick={() => onPick(player.id)}>
                    <Avatar src={player.avatar} name={player.name} />
                    <span className="picker__name">{player.name}</span>
                    {player.country && <span className="tag">{player.country}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {quick.length > 0 && (
        <div className="picker__quick">
          <span className="picker__quick-label">{t('versus.quick')}</span>
          {quick.map((player) => (
            <button key={`${player.group}-${player.id}`} type="button" className="chip picker__chip" onClick={() => onPick(player.id)} title={t(`versus.${player.group}`)}>
              <Avatar src={player.avatar} name={player.name} />
              <span>{player.group === 'me' ? t('versus.me') : player.name ?? `#${player.id}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PlayerPicker;
