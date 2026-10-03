import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import { fetchPlayerEnemies, fetchPlayerMates } from '../../api/index.js';
import { useInView } from '../../hooks/useInView';
import { usePlayerNames } from '../../hooks/usePlayerNames';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber, formatPoints } from '../../services/format';
import { formatWinrate, winrateColor } from '../../services/heroService';
import { MATES, buildCircle, circleIds, dataCoverage } from '../../services/matesService';
import { statsMatches } from '../../services/playerHistoryService';
import { summarizeHeroStats } from '../../services/playerService';

/** Строка человека: аватар, имя (ссылка на профиль), счёт и ссылка «сравнить». */
function PersonRow({ accountId, row, profile, language, t, showTogether }) {
  return (
    <tr>
      <td className="lb-table__name">
        <Link to={`/player/${row.id}`} className="circle-person">
          <Avatar src={profile?.avatar} name={profile?.name} />
          <span className="circle-person__name">{profile?.name ?? t('player.circle.playerById', { id: row.id })}</span>
        </Link>
      </td>
      <td className="num">{formatNumber(row.matches, language)}</td>
      {showTogether && (
        <td className={`num winrate-${winrateColor(row.winrate)}`}>
          {formatWinrate(row.winrate)} <span className="circle-diff" title={t('player.circle.vsOverall', { diff: formatPoints(row.diff) })}>{formatPoints(row.diff)}</span>
        </td>
      )}
      <td className="num">{row.wins}–{row.losses}</td>
      <td className="num">
        <Link to={`/versus?a=${accountId}&b=${row.id}`} className="circle-compare" title={t('player.circle.compare')}>
          {t('player.circle.compare')}
        </Link>
      </td>
    </tr>
  );
}

function PeopleTable({ title, rows, showTogether, accountId, names, language, t }) {
  if (rows.length === 0) return null;
  return (
    <div className="circle-block">
      <h3 className="advice-col__title">{title}</h3>
      <div className="compare-table-wrapper">
        <table className="lb-table circle-table">
          <thead>
            <tr>
              <th scope="col">{t('leaderboard.player')}</th>
              <th scope="col" className="num">{t('player.circle.matches')}</th>
              {showTogether && <th scope="col" className="num">{t('player.circle.together')}</th>}
              <th scope="col" className="num">{t('player.circle.record')}</th>
              <th scope="col"><span className="sr-only">{t('player.circle.compare')}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PersonRow key={row.id} accountId={accountId} row={row} profile={names[row.id]} language={language} t={t} showTogether={showTogether} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Напарники и соперники игрока: с кем он чаще играет вместе и против кого, и «немезида» — соперник с самым большим
 * перевесом над ним. Считает аналитика API, а она знает не все матчи, поэтому над списками написан охват. Данные
 * запрашиваются, когда блок подошёл к экрану.
 * @param {{ accountId: number, history: any[], heroStats: any[], language: string }} props
 */
function PlayerCircle({ accountId, history, heroStats, language }) {
  const t = useTranslation();
  const ref = useRef(null);
  const seen = useInView(ref);
  const [data, setData] = useState({ state: 'idle', mates: [], enemies: [] });

  useEffect(() => {
    if (!seen) return undefined;
    let cancelled = false;
    setData({ state: 'loading', mates: [], enemies: [] });
    Promise.all([fetchPlayerMates(accountId), fetchPlayerEnemies(accountId)])
      .then(([mates, enemies]) => { if (!cancelled) setData({ state: 'ready', mates, enemies }); })
      .catch(() => { if (!cancelled) setData({ state: 'error', mates: [], enemies: [] }); });
    return () => { cancelled = true; };
  }, [seen, accountId]);

  const summary = useMemo(() => summarizeHeroStats(heroStats), [heroStats]);
  const coverage = useMemo(() => dataCoverage(summary.matches, statsMatches(history).length), [summary.matches, history]);
  const circle = useMemo(() => buildCircle(data.mates, data.enemies, { baseline: summary.matches ? summary.winrate : 0.5 }), [data.mates, data.enemies, summary]);
  const ids = useMemo(() => circleIds(circle), [circle]);
  const { names } = usePlayerNames(ids, data.state === 'ready');
  const empty = data.state === 'ready' && circle.friends.length === 0 && circle.rivals.length === 0;

  let body;
  if (!seen || data.state === 'idle' || data.state === 'loading') {
    body = <p className="matchup-panel__empty">{t('player.circle.loading')}</p>;
  } else if (data.state === 'error') {
    body = <p className="matchup-panel__empty">{t('player.circle.error')}</p>;
  } else if (empty) {
    body = <p className="matchup-panel__empty">{t('player.circle.empty', { count: MATES.MIN_MATCHES })}</p>;
  } else {
    const nemesisName = circle.nemesis ? names[circle.nemesis.id]?.name ?? t('player.circle.playerById', { id: circle.nemesis.id }) : '';
    body = (
      <>
        {coverage.level !== 'unknown' && (
          <p className={`circle-coverage circle-coverage--${coverage.level}`}>
            {t(`player.circle.coverage${coverage.level === 'full' ? 'Full' : coverage.level === 'partial' ? 'Partial' : 'Low'}`, { share: `${Math.round(coverage.share * 100)}%` })}
          </p>
        )}
        {circle.nemesis && (
          <div className="circle-nemesis">
            <span className="tag tag--bad">{t('player.circle.nemesis')}</span>
            <Link to={`/player/${circle.nemesis.id}`} className="circle-nemesis__who">
              <Avatar src={names[circle.nemesis.id]?.avatar} name={nemesisName} />
              <strong>{nemesisName}</strong>
            </Link>
            <span className="circle-nemesis__text">
              {t('player.circle.nemesisText', { name: nemesisName, record: `${circle.nemesis.wins}–${circle.nemesis.losses}`, count: MATES.NEMESIS_MIN_MATCHES })}
            </span>
          </div>
        )}
        <div className="circle-grid">
          <PeopleTable title={t('player.circle.friends')} rows={circle.friends} showTogether accountId={accountId} names={names} language={language} t={t} />
          <PeopleTable title={t('player.circle.rivals')} rows={circle.rivals} showTogether={false} accountId={accountId} names={names} language={language} t={t} />
        </div>
        <p className="player-section__note">{t('player.circle.note', { count: MATES.MIN_MATCHES })}</p>
      </>
    );
  }

  return (
    <section id="circle" ref={ref} className="section player-section" aria-labelledby="circle-title">
      <h2 className="section__title" id="circle-title">{t('player.circle.title')}</h2>
      {body}
    </section>
  );
}

export default PlayerCircle;
