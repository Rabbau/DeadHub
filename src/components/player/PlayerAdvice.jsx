import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroIcon from '../hero/HeroIcon';
import { fetchHeroStats } from '../../api/index.js';
import { useInView } from '../../hooks/useInView';
import { useTranslation } from '../../hooks/useTranslation';
import { formatMatchDate, formatNumber, formatPoints } from '../../services/format';
import { formatWinrate, winrateColor } from '../../services/heroService';
import { statsMatches } from '../../services/playerHistoryService';
import { INSIGHTS, buildAdvice, compareWithMeta, heroResults, rankBand, windowStart } from '../../services/playerInsightsService';
import { DEFAULT_PERIOD, MAX_TIER, MIN_TIER } from '../../services/statsFilters';

/** Победы сверх среднего (или недобор) одним числом: «4,2». */
const winsText = (value) => Math.abs(value).toFixed(1);

function HeroLine({ hero, heroId, children }) {
  return (
    <div className="advice-hero">
      <Link to={`/hero/${heroId}`} className="advice-hero__who">
        <HeroIcon hero={hero} size="md" decorative />
        <span className="advice-hero__name">{hero?.name ?? `#${heroId}`}</span>
      </Link>
      <div className="advice-hero__text">{children}</div>
    </div>
  );
}

/**
 * Разбор игрока: на каких героях он выигрывает чаще, чем средний игрок его ранга, на каких реже, и на каких героев
 * стоит посмотреть. Мета (hero-stats на диапазоне рангов игрока) запрашивается, когда блок подошёл к экрану, и
 * только если у игрока есть хотя бы один герой с достаточным числом матчей.
 * @param {{ history: any[], badge: number|null, heroes: any[], language: string }} props
 */
function PlayerAdvice({ history, badge, heroes, language }) {
  const t = useTranslation();
  const ref = useRef(null);
  const seen = useInView(ref);
  const [meta, setMeta] = useState({ state: 'idle', data: null });

  const band = useMemo(() => rankBand(badge), [badge]);
  const since = useMemo(() => windowStart(), []);
  const results = useMemo(() => heroResults(history, since), [history, since]);
  const eligible = useMemo(() => Object.values(results).some((entry) => entry.matches >= INSIGHTS.MIN_MATCHES), [results]);
  // Игрок давно не играл: мета за последние 30 дней не с чем сравнивать, и об этом стоит сказать прямо
  const lastStatsMatch = useMemo(() => statsMatches(history)[0] ?? null, [history]);
  const inactive = lastStatsMatch != null && lastStatsMatch.at < since;
  const heroMap = useMemo(() => Object.fromEntries(heroes.map((hero) => [hero.id, hero])), [heroes]);

  const rankMin = band?.rankMin ?? MIN_TIER;
  const rankMax = band?.rankMax ?? MAX_TIER;

  useEffect(() => {
    if (!seen || !eligible) return undefined;
    let cancelled = false;
    setMeta({ state: 'loading', data: null });
    fetchHeroStats({ period: DEFAULT_PERIOD, rankMin, rankMax })
      .then((data) => { if (!cancelled) setMeta({ state: 'ready', data }); })
      .catch(() => { if (!cancelled) setMeta({ state: 'error', data: null }); });
    return () => { cancelled = true; };
  }, [seen, eligible, rankMin, rankMax]);

  const rows = useMemo(() => (meta.data ? compareWithMeta(results, meta.data) : []), [results, meta.data]);
  const advice = useMemo(() => (meta.data ? buildAdvice(rows, { heroes, results, meta: meta.data }) : null), [rows, heroes, results, meta.data]);

  const bandText = band
    ? t('player.advice.bandRanks', { from: band.rankMin, to: band.rankMax })
    : t('player.advice.bandAll');

  let body;
  if (inactive) {
    body = <p className="matchup-panel__empty">{t('player.advice.stale', { date: formatMatchDate(lastStatsMatch.at, language), days: INSIGHTS.WINDOW_DAYS })}</p>;
  } else if (!eligible) {
    body = <p className="matchup-panel__empty">{t('player.advice.notEnough', { count: INSIGHTS.MIN_MATCHES, days: INSIGHTS.WINDOW_DAYS })}</p>;
  } else if (meta.state === 'error') {
    body = <p className="matchup-panel__empty">{t('player.advice.error')}</p>;
  } else if (!advice) {
    body = <p className="matchup-panel__empty">{t('player.advice.loading')}</p>;
  } else if (rows.length === 0) {
    body = <p className="matchup-panel__empty">{t('player.advice.notEnough', { count: INSIGHTS.MIN_MATCHES, days: INSIGHTS.WINDOW_DAYS })}</p>;
  } else {
    const noneStand = advice.strengths.length === 0 && advice.weaknesses.length === 0;
    body = (
      <>
        {noneStand && <p className="advice-none">{t('player.advice.nothing')}</p>}
        <div className="advice-grid">
          {advice.strengths.length > 0 && (
            <div className="advice-col advice-col--good">
              <h3 className="advice-col__title">{t('player.advice.strengths')}</h3>
              {advice.strengths.map((row) => (
                <HeroLine key={row.heroId} hero={heroMap[row.heroId]} heroId={row.heroId}>
                  <strong className={`winrate-${winrateColor(row.winrate)}`}>{formatWinrate(row.winrate)}</strong>
                  <span className="advice-hero__vs"> {t('player.advice.average')}: {formatWinrate(row.metaWinrate)} · {formatNumber(row.matches, language)}</span>
                  <span className="advice-hero__sub">{t('player.advice.winsMore', { count: winsText(row.extraWins) })}</span>
                </HeroLine>
              ))}
            </div>
          )}
          {advice.weaknesses.length > 0 && (
            <div className="advice-col advice-col--bad">
              <h3 className="advice-col__title">{t('player.advice.weaknesses')}</h3>
              {advice.weaknesses.map((row) => (
                <HeroLine key={row.heroId} hero={heroMap[row.heroId]} heroId={row.heroId}>
                  <strong className={`winrate-${winrateColor(row.winrate)}`}>{formatWinrate(row.winrate)}</strong>
                  <span className="advice-hero__vs"> {t('player.advice.average')}: {formatWinrate(row.metaWinrate)} · {formatNumber(row.matches, language)}</span>
                  <span className="advice-hero__sub">{t('player.advice.winsLess', { count: winsText(row.extraWins) })}</span>
                </HeroLine>
              ))}
            </div>
          )}
          {advice.suggestions.length > 0 && (
            <div className="advice-col advice-col--try">
              <h3 className="advice-col__title">{t('player.advice.suggestions')}</h3>
              {advice.suggestions.map((item) => {
                const sameAnchor = item.roleLike && item.roleLike === item.gunLike;
                const kind = sameAnchor ? 'suggestBoth' : item.roleLike ? 'suggestRole' : 'suggestGun';
                const anchor = item.roleLike ?? item.gunLike;
                return (
                  <HeroLine key={item.heroId} hero={heroMap[item.heroId]} heroId={item.heroId}>
                    <span className="advice-hero__sub advice-hero__sub--first">
                      {t(`player.advice.${kind}`, {
                        winrate: formatWinrate(item.metaWinrate),
                        hero: heroMap[anchor]?.name ?? `#${anchor}`,
                        why: t(advice.model === 'strengths' ? 'player.advice.whyStrong' : 'player.advice.whyPlayed'),
                      })}
                    </span>
                  </HeroLine>
                );
              })}
            </div>
          )}
        </div>

        <details className="advice-all">
          <summary>{t('player.advice.allHeroes')} · {rows.length}</summary>
          <div className="compare-table-wrapper">
            <table className="lb-table player-heroes">
              <thead>
                <tr>
                  <th scope="col">{t('player.hero')}</th>
                  <th scope="col" className="num">{t('player.matches')}</th>
                  <th scope="col" className="num">{t('player.winrate')}</th>
                  <th scope="col" className="num">{t('player.advice.average')}</th>
                  <th scope="col" className="num">{t('player.advice.diff')}</th>
                  <th scope="col"><span className="sr-only">{t('player.advice.title')}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.heroId}>
                    <td className="lb-table__name">
                      <Link to={`/hero/${row.heroId}`} className="player-hero-cell">
                        <HeroIcon hero={heroMap[row.heroId]} size="sm" decorative />
                        <span>{heroMap[row.heroId]?.name ?? `#${row.heroId}`}</span>
                      </Link>
                    </td>
                    <td className="num">{formatNumber(row.matches, language)}</td>
                    <td className={`num winrate-${winrateColor(row.winrate)}`}>{formatWinrate(row.winrate)}</td>
                    <td className="num">{formatWinrate(row.metaWinrate)}</td>
                    <td className="num">{formatPoints(row.diff)}</td>
                    <td><span className={`tag advice-tag advice-tag--${row.verdict}`}>{t(`player.advice.verdict.${row.verdict}`)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="player-section__note">{t('player.advice.note')}</p>
      </>
    );
  }

  return (
    <section id="advice" ref={ref} className="section player-section" aria-labelledby="advice-title">
      <h2 className="section__title" id="advice-title">{t('player.advice.title')}</h2>
      <p className="player-section__lead">{t('player.advice.lead', { days: INSIGHTS.WINDOW_DAYS, band: bandText })}</p>
      {body}
    </section>
  );
}

export default PlayerAdvice;
