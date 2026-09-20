import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useHeroes } from '../hooks/useHeroes';
import { usePlayerProfile } from '../hooks/usePlayers';
import { useTranslation } from '../hooks/useTranslation';
import { useHeroStore } from '../store/heroStore';
import { usePlayerStore } from '../store/playerStore';
import Avatar from '../components/ui/Avatar';
import RankBadge from '../components/ui/RankBadge';
import HeroIcon from '../components/hero/HeroIcon';
import { formatDuration, formatMatchDate, formatNumber } from '../services/format';
import { formatWinrate, winrateColor } from '../services/heroService';
import { matchModeKey, summarizeHeroStats, topHeroes } from '../services/playerService';

const TOP_HEROES = 8;
const MATCHES_STEP = 20;

/** Account ID — только цифры; всё остальное в адресе считаем несуществующим игроком. */
function parseAccountId(raw) {
  return /^\d{1,10}$/.test(raw || '') ? Number(raw) : null;
}

const kdaOf = (row) => (row.kills + row.assists) / Math.max(1, row.deaths);

function PlayerPage() {
  const { id } = useParams();
  const accountId = parseAccountId(id);
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const { allHeroes } = useHeroes();
  const { steam, rank, history, heroStats, loading, error } = usePlayerProfile(accountId);
  const remember = usePlayerStore((state) => state.remember);
  const [shown, setShown] = useState(MATCHES_STEP);

  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((h) => [h.id, h])), [allHeroes]);
  const summary = useMemo(() => summarizeHeroStats(heroStats), [heroStats]);
  const favourites = useMemo(() => topHeroes(heroStats, TOP_HEROES), [heroStats]);

  // Профиль попадает в «недавно просмотренные» на странице поиска
  useEffect(() => {
    if (steam) remember({ id: steam.id, name: steam.name, avatar: steam.avatar });
  }, [steam, remember]);

  // Другой игрок — список матчей снова с начала
  useEffect(() => { setShown(MATCHES_STEP); }, [accountId]);

  const back = <Link to="/players" className="back-link">{t('player.back')}</Link>;

  if (loading) {
    return (
      <div className="page player-page">
        {back}
        <div className="state-center">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page player-page">
        {back}
        <div className="state-center state-error">{t('player.notFound')}</div>
      </div>
    );
  }

  const name = steam?.name ?? `#${accountId}`;
  const lastMatch = history[0];
  // Ранг из эндпоинта rank; если его нет — из последнего рейтингового матча в истории
  const badge = rank?.badge ?? history.find((m) => m.badge)?.badge ?? null;
  const matchesTotal = summary.matches || history.length;

  const modeLabel = (mode) => t(`player.modes.${matchModeKey(mode)}`);

  return (
    <div className="page player-page">
      {back}

      <div className="player-head">
        <Avatar src={steam?.avatar} name={name} size="lg" />
        <div className="player-head__info">
          <h1 className="page-title player-head__name">{name}</h1>
          <div className="player-head__meta">
            <span className="tag">ID {accountId}</span>
            {steam?.country && <span className="tag">{steam.country}</span>}
            {steam?.profileUrl && (
              <a className="tag tag--role" href={steam.profileUrl} target="_blank" rel="noopener noreferrer">
                {t('player.steamProfile')} ↗
              </a>
            )}
          </div>
          {lastMatch && (
            <div className="page-subtitle">{t('player.lastMatch', { date: formatMatchDate(lastMatch.at, language) })}</div>
          )}
        </div>
        <div className="player-head__rank">
          <div className="stat-card__label">{t('player.rank')}</div>
          <RankBadge badge={badge} size="lg" />
        </div>
      </div>

      <div className="hero-detail__stats-row player-stats">
        <div className="stat-card">
          <div className="stat-card__label">{t('player.matches')}</div>
          <div className="stat-card__value">{formatNumber(matchesTotal, language)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('player.winrate')}</div>
          <div className={`stat-card__value ${summary.matches ? `winrate-${winrateColor(summary.winrate)}` : ''}`}>
            {summary.matches ? formatWinrate(summary.winrate) : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('player.kda')}</div>
          <div className="stat-card__value">{summary.matches ? summary.kda.toFixed(2) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">{t('player.accuracy')}</div>
          <div className="stat-card__value">{summary.accuracy ? formatWinrate(summary.accuracy) : '—'}</div>
        </div>
      </div>

      {favourites.length > 0 && (
        <div className="section">
          <h2 className="section__title">{t('player.topHeroes')}</h2>
          <div className="compare-table-wrapper">
            <table className="lb-table player-heroes">
              <thead>
                <tr>
                  <th scope="col">{t('player.hero')}</th>
                  <th scope="col" className="num">{t('player.matches')}</th>
                  <th scope="col" className="num">{t('player.winrate')}</th>
                  <th scope="col" className="num">{t('player.kda')}</th>
                </tr>
              </thead>
              <tbody>
                {favourites.map((row) => {
                  const hero = heroMap[row.heroId];
                  const wr = row.matches ? row.wins / row.matches : 0;
                  return (
                    <tr key={row.heroId}>
                      <td className="lb-table__name">
                        <Link to={`/hero/${row.heroId}`} className="player-hero-cell">
                          <HeroIcon hero={hero} size="sm" decorative />
                          <span>{hero?.name ?? `#${row.heroId}`}</span>
                        </Link>
                      </td>
                      <td className="num">{formatNumber(row.matches, language)}</td>
                      <td className={`num winrate-${winrateColor(wr)}`}>{formatWinrate(wr)}</td>
                      <td className="num">{kdaOf(row).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="section__title">{t('player.recentMatches')}</h2>
        {history.length === 0 ? (
          <p className="matchup-panel__empty">{t('player.noMatches')}</p>
        ) : (
          <>
            <div className="match-list">
              {history.slice(0, shown).map((match) => {
                const hero = heroMap[match.heroId];
                return (
                  <div key={match.id} className={`match-row ${match.win ? 'match-row--win' : 'match-row--loss'}`}>
                    <span className="match-row__result">{match.win ? t('player.win') : t('player.loss')}</span>
                    <Link to={`/hero/${match.heroId}`} className="match-row__hero">
                      <HeroIcon hero={hero} size="sm" decorative />
                      <span>{hero?.name ?? `#${match.heroId}`}</span>
                    </Link>
                    <span className="match-row__info">
                      <span className="match-row__kda">{match.kills}/{match.deaths}/{match.assists}</span>
                      <span className="match-row__mode">{modeLabel(match.mode)}</span>
                      <span className="match-row__duration" title={t('player.duration')}>{formatDuration(match.duration)}</span>
                    </span>
                    <span
                      className={`match-row__delta ${match.delta > 0 ? 'positive' : match.delta < 0 ? 'negative' : ''}`}
                      title={t('player.rankPoints')}
                    >
                      {match.delta ? `${match.delta > 0 ? '+' : ''}${match.delta}` : ''}
                    </span>
                    <span className="match-row__date">
                      {match.abandoned && <span className="tag match-row__abandon">{t('player.abandoned')}</span>}
                      {formatMatchDate(match.at, language)}
                    </span>
                  </div>
                );
              })}
            </div>
            {shown < history.length && (
              <button type="button" className="btn btn-secondary match-list__more" onClick={() => setShown((n) => n + MATCHES_STEP)}>
                {t('player.showMore')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PlayerPage;
