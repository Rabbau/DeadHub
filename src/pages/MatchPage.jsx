import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useHeroes } from '../hooks/useHeroes';
import { useItemCatalog, useMatch, usePlayerNames } from '../hooks/useMatch';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import { useHeroStore } from '../store/heroStore';
import { useProfileStore } from '../store/profileStore';
import HeroIcon from '../components/hero/HeroIcon';
import RankBadge from '../components/ui/RankBadge';
import NotFoundView from '../components/layout/NotFoundView';
import KillFeed from '../components/match/KillFeed';
import MatchScoreboard from '../components/match/MatchScoreboard';
import MatchSummary from '../components/match/MatchSummary';
import SoulsChart from '../components/match/SoulsChart';
import { formatDuration, formatFullDate } from '../services/format';
import { TEAMS, teamAverageBadge, teamWon } from '../services/matchService';

/** Номер матча — только цифры; всё остальное в адресе считаем несуществующим матчем. */
function parseMatchId(raw) {
  return /^\d{1,12}$/.test(raw || '') ? Number(raw) : null;
}

/** Account ID игрока, с чьей страницы пришли (?p=): только цифры, иначе подсветки нет. */
function parseAccountId(raw) {
  return /^\d{1,10}$/.test(raw || '') ? Number(raw) : null;
}

/**
 * Страница матча: итог, сравнение команд, перевес по душам, таблицы игроков с покупками и хроника убийств.
 * Попадают сюда из истории матчей игрока (`?p=<Account ID>` подсвечивает его строку), из поиска по номеру
 * матча или по ссылке. Страница не индексируется: матчей миллионы, а ценности для поиска в них нет.
 */
function MatchPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const matchId = parseMatchId(id);
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const { allHeroes } = useHeroes();
  const { match, loading, error, retry } = useMatch(matchId);
  const profiles = usePlayerNames(match);
  // Предметы нужны только таблицам игроков — когда матч уже на экране
  const catalog = useItemCatalog(Boolean(match));
  const me = useProfileStore((state) => state.me);

  // Подсвечиваем игрока, с чьего профиля пришли; без него — «мой профиль», если он есть в этом матче
  const fromProfile = parseAccountId(params.get('p'));
  const focus = fromProfile ?? me?.id ?? null;
  const focusLabel = focus != null && focus === me?.id ? t('match.you') : t('match.selected');

  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((hero) => [hero.id, hero])), [allHeroes]);

  usePageMeta(
    matchId
      ? { title: t('seo.match.title', { id: matchId }), description: t('seo.match.description') }
      : 'notFound',
    { noindex: true },
  );

  if (matchId == null) return <NotFoundView />;

  const back = fromProfile
    ? <Link to={`/player/${fromProfile}`} className="back-link">{t('match.backToPlayer')}</Link>
    : <Link to="/players" className="back-link">{t('player.back')}</Link>;

  if (loading) {
    return (
      <div className="page match-page">
        {back}
        <div className="state-center">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    const text = {
      notFound: t('match.notFound'),
      rateLimited: t('match.rateLimited'),
      unavailable: t('match.unavailable'),
    }[error] ?? t('match.error');
    return (
      <div className="page match-page">
        {back}
        <div className="state-center state-error">{text}</div>
        <p className="match-page__retry">
          {error === 'notFound'
            ? <span className="matchup-panel__empty">{t('match.notFoundHint')}</span>
            : <button type="button" className="btn btn-secondary" onClick={retry}>{t('match.retry')}</button>}
        </p>
      </div>
    );
  }

  const winner = match.winner;
  const banned = match.banned.map((heroId) => heroMap[heroId] ?? { id: heroId, name: `#${heroId}` });

  return (
    <div className="page match-page">
      {back}

      <header className="match-head">
        <h1 className="page-title match-head__title">{t('match.title', { id: match.id })}</h1>
        <div className="match-head__chips">
          <span className="tag tag--role">{t(`match.modes.${match.gameMode}`)}</span>
          <span className="tag">{t(`player.modes.${match.mode}`)}</span>
          <span className="tag" title={t('match.duration')}>{formatDuration(match.duration)}</span>
          <span className="tag">{formatFullDate(match.startedAt, language)}</span>
        </div>
      </header>

      <div className={`match-result${winner == null ? '' : ` match-result--${winner === 0 ? 'a' : 'b'}`}`}>
        <span className="match-result__title">
          {winner == null ? t('match.noWinner') : t('match.won', { team: t('match.teamN', { n: winner + 1 }) })}
        </span>
        {match.score && (
          <span className="match-result__score" title={t('match.roundsHint')}>
            {t('match.rounds')} {match.score[0]} : {match.score[1]}
          </span>
        )}
      </div>

      {banned.length > 0 && (
        <div className="match-banned">
          <span className="match-banned__label">{t('match.banned')}</span>
          {banned.map((hero) => (
            <Link key={hero.id} to={`/hero/${hero.id}`} className="match-banned__hero" title={hero.name}>
              <HeroIcon hero={hero} size="sm" />
            </Link>
          ))}
        </div>
      )}

      <div className="match-overview">
        <MatchSummary match={match} />
        <SoulsChart match={match} />
      </div>

      {TEAMS.map((team) => {
        const won = teamWon(match, team);
        const badge = teamAverageBadge(match, team);
        return (
          <section key={team} className={`section match-team match-team--${team === 0 ? 'a' : 'b'}`}>
            <h2 className="section__title match-team__title">
              <span>{t('match.teamN', { n: team + 1 })}</span>
              {won != null && (
                <span className={`tag match-team__result match-team__result--${won ? 'win' : 'loss'}`}>
                  {t(won ? 'match.victory' : 'match.defeat')}
                </span>
              )}
              {badge && (
                <span className="match-team__rank" title={t('match.avgRank')}>
                  <RankBadge badge={badge} />
                </span>
              )}
            </h2>
            <MatchScoreboard
              match={match}
              team={team}
              heroMap={heroMap}
              profiles={profiles}
              catalog={catalog}
              focus={focus}
              focusLabel={focusLabel}
            />
          </section>
        );
      })}

      <KillFeed match={match} heroMap={heroMap} profiles={profiles} />

      <p className="match-note">{t('match.note')}</p>
    </div>
  );
}

export default MatchPage;
