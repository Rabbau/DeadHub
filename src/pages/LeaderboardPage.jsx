import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHeroes } from '../hooks/useHeroes';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useTranslation } from '../hooks/useTranslation';
import { LEADERBOARD_REGIONS } from '../api/index.js';
import HeroIcon from '../components/hero/HeroIcon';

const PAGE_SIZE = 100;

function LeaderboardPage() {
  const t = useTranslation();
  const [params, setParams] = useSearchParams();
  const { allHeroes } = useHeroes();

  const region = LEADERBOARD_REGIONS.includes(params.get('region')) ? params.get('region') : 'Europe';
  const heroId = Number(params.get('hero')) || null;
  const { entries, loading, error } = useLeaderboard(region, heroId);

  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Новый регион, герой или поисковая строка — показываем список с начала
  useEffect(() => { setLimit(PAGE_SIZE); }, [region, heroId, search]);

  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((h) => [h.id, h])), [allHeroes]);
  const releasedHeroes = useMemo(
    () => allHeroes.filter((h) => h.released).sort((a, b) => a.name.localeCompare(b.name)),
    [allHeroes],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries;
  }, [entries, search]);
  const visible = filtered.slice(0, limit);

  const update = (patch) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === '') p.delete(key);
        else p.set(key, String(value));
      });
      return p;
    });
  };

  /** Ссылка на профиль: однозначный аккаунт — сразу профиль, несколько — поиск по нику. */
  const profileLink = (entry) => {
    if (entry.id) return { to: `/player/${entry.id}`, title: undefined };
    if (entry.candidates > 1) return { to: `/players?q=${encodeURIComponent(entry.name)}`, title: t('leaderboard.ambiguous') };
    return null;
  };

  return (
    <div className="page leaderboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('leaderboard.title')}</h1>
          <div className="page-subtitle">{t('leaderboard.subtitle')}</div>
        </div>
      </div>

      <div className="filters leaderboard-filters">
        <div className="chip-group" role="group" aria-label={t('leaderboard.region')}>
          {LEADERBOARD_REGIONS.map((key) => (
            <button
              key={key}
              type="button"
              className={`chip ${region === key ? 'active' : ''}`}
              aria-pressed={region === key}
              onClick={() => update({ region: key === 'Europe' ? null : key })}
            >
              {t(`leaderboard.regions.${key}`)}
            </button>
          ))}
        </div>

        <select
          className="select"
          aria-label={t('leaderboard.hero')}
          value={heroId ?? ''}
          onChange={(e) => update({ hero: e.target.value || null })}
        >
          <option value="">{t('leaderboard.allHeroes')}</option>
          {releasedHeroes.map((hero) => (
            <option key={hero.id} value={hero.id}>{hero.name}</option>
          ))}
        </select>

        <div className="filters__search">
          <span className="filters__search-icon" aria-hidden="true">&gt;</span>
          <input
            type="text"
            className="input"
            placeholder={t('leaderboard.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="state-center">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      ) : error ? (
        <div className="state-center state-error">
          {t('common.error')}: {error}
        </div>
      ) : filtered.length === 0 ? (
        <p className="state-center" style={{ color: 'var(--muted)' }}>{t('leaderboard.noResults')}</p>
      ) : (
        <>
          <div className="lb-wrapper">
            <table className="lb-table">
              <thead>
                <tr>
                  <th scope="col" className="lb-table__rank">{t('leaderboard.rank')}</th>
                  <th scope="col">{t('leaderboard.player')}</th>
                  <th scope="col" className="lb-table__heroes">{t('leaderboard.heroes')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => {
                  const link = profileLink(entry);
                  return (
                    <tr key={`${entry.rank}-${entry.name}`} className={entry.rank <= 3 ? `lb-table__top lb-table__top--${entry.rank}` : undefined}>
                      <td className="lb-table__rank">{entry.rank}</td>
                      <td className="lb-table__name">
                        {link ? <Link to={link.to} title={link.title}>{entry.name}</Link> : entry.name}
                      </td>
                      <td className="lb-table__heroes">
                        <span className="lb-heroes">
                          {entry.heroes.length === 0 && <span className="lb-heroes__none">—</span>}
                          {entry.heroes.map((id) => heroMap[id] && (
                            <Link key={id} to={`/hero/${id}`} title={heroMap[id].name}>
                              <HeroIcon hero={heroMap[id]} size="sm" />
                            </Link>
                          ))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lb-footer">
            <span>{t('leaderboard.showing', { shown: visible.length, total: filtered.length })}</span>
            {visible.length < filtered.length && (
              <button type="button" className="btn btn-secondary" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                {t('leaderboard.showMore')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default LeaderboardPage;
