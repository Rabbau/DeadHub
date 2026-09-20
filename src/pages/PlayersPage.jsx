import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayerSearch } from '../hooks/usePlayers';
import { useTranslation } from '../hooks/useTranslation';
import { usePlayerStore } from '../store/playerStore';
import { toAccountId } from '../services/playerService';
import { formatNumber } from '../services/format';
import { useHeroStore } from '../store/heroStore';
import Avatar from '../components/ui/Avatar';

function PlayersPage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const language = useHeroStore((state) => state.language);
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [input, setInput] = useState(query);
  const { results, loading, error } = usePlayerSearch(query);
  const recent = usePlayerStore((state) => state.recent);
  const forget = usePlayerStore((state) => state.forget);
  const clearRecent = usePlayerStore((state) => state.clear);

  // Запрос может прийти из ссылки (например, из лидерборда) — поле ввода подстраивается под адрес
  useEffect(() => { setInput(query); }, [query]);

  const submit = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) {
      setParams({});
      return;
    }
    // SteamID64, ссылка на профиль или Account ID открывают профиль сразу, без поиска
    const accountId = toAccountId(text);
    if (accountId) {
      navigate(`/player/${accountId}`);
      return;
    }
    setParams({ q: text });
  };

  const showRecent = !query && recent.length > 0;

  return (
    <div className="page players-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('players.title')}</h1>
          <div className="page-subtitle">{t('players.subtitle')}</div>
        </div>
      </div>

      <form className="player-search" onSubmit={submit} role="search">
        <div className="filters__search">
          <span className="filters__search-icon" aria-hidden="true">&gt;</span>
          <input
            type="text"
            className="input"
            placeholder={t('players.searchPlaceholder')}
            aria-label={t('players.searchPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn-primary">{t('players.search')}</button>
      </form>
      <p className="player-search__hint">{t('players.hint')}</p>

      {query && (
        <div className="section">
          {loading ? (
            <div className="state-center">
              <div className="spinner" />
              <p>{t('players.searching')}</p>
            </div>
          ) : error ? (
            <div className="state-center state-error">{t('players.searchError')}</div>
          ) : results.length === 0 ? (
            <p className="state-center" style={{ color: 'var(--muted)' }}>{t('players.noResults')}</p>
          ) : (
            <div className="player-list">
              {results.map((player) => (
                <Link key={player.id} to={`/player/${player.id}`} className="player-row">
                  <Avatar src={player.avatar} name={player.name} />
                  <span className="player-row__name">{player.name}</span>
                  <span className="player-row__meta">
                    {player.country && <span className="tag">{player.country}</span>}
                    <span>{t('players.matches30d', { count: formatNumber(player.matches30d, language) })}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {showRecent && (
        <div className="section">
          <h2 className="section__title">{t('players.recent')}</h2>
          <div className="player-list">
            {recent.map((player) => (
              <div key={player.id} className="player-row player-row--recent">
                <Link to={`/player/${player.id}`} className="player-row__link">
                  <Avatar src={player.avatar} name={player.name} />
                  <span className="player-row__name">{player.name}</span>
                </Link>
                <button
                  type="button"
                  className="player-row__remove"
                  aria-label={`${t('players.clearRecent')}: ${player.name}`}
                  onClick={() => forget(player.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary player-list__clear" onClick={clearRecent}>
            {t('players.clearRecent')}
          </button>
        </div>
      )}
    </div>
  );
}

export default PlayersPage;
