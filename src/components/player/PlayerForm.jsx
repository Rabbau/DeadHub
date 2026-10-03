import { useMemo } from 'react';
import FormChart from './FormChart';
import PlayerCurve from './PlayerCurve';
import RankChart from './RankChart';
import { useTranslation } from '../../hooks/useTranslation';
import { formatWinrate } from '../../services/heroService';
import {
  FORM_WINDOW, MIN_FORM_MATCHES, TREND_WINDOW, currentStreak, formSeries, formTrend, rankSteps, statsMatches,
} from '../../services/playerHistoryService';

/** Серия показывается плашкой, когда она хотя бы из трёх матчей: на двух подряд — это не серия. */
const STREAK_MIN = 3;

/**
 * «Форма» игрока по истории матчей: серия, полоса последних результатов, заметно ли изменился винрейт, скользящий
 * винрейт и ход ранга. Всё из уже загруженной истории — ни одного нового запроса.
 * @param {{ history: any[], accountId: number, badge: number|null, language: string }} props
 */
function PlayerForm({ history, accountId, badge, language }) {
  const t = useTranslation();
  const rows = useMemo(() => statsMatches(history), [history]);
  const streak = useMemo(() => currentStreak(rows), [rows]);
  const series = useMemo(() => formSeries(rows), [rows]);
  const trend = useMemo(() => formTrend(rows), [rows]);
  const steps = useMemo(() => rankSteps(history), [history]);
  const strip = rows.slice(0, TREND_WINDOW);

  const trendText = trend
    ? t(`player.form.trend${trend.verdict === 'up' ? 'Up' : trend.verdict === 'down' ? 'Down' : 'Steady'}`, {
      recent: formatWinrate(trend.recent.winrate),
      previous: formatWinrate(trend.previous.winrate),
      count: trend.recent.matches,
    })
    : t('player.form.trendNone');

  return (
    <section id="form" className="section player-section" aria-labelledby="form-title">
      <h2 className="section__title" id="form-title">{t('player.form.title')}</h2>
      <p className="player-section__lead">{t('player.form.lead')}</p>

      {rows.length === 0 ? (
        <p className="matchup-panel__empty">{t('player.noMatches')}</p>
      ) : (
        <>
          <div className="form-top">
            {streak && streak.length >= STREAK_MIN && (
              <span className={`tag ${streak.win ? 'tag--green' : 'tag--bad'}`}>
                {t(streak.win ? 'player.form.streakWin' : 'player.form.streakLoss', { count: streak.length })}
              </span>
            )}
            <ol className="form-strip" aria-label={t('player.form.lastResults', { count: strip.length })}>
              {strip.map((row) => (
                <li key={row.id} className={`form-strip__cell ${row.win ? 'is-win' : 'is-loss'}`}>
                  <span className="sr-only">{row.win ? t('player.form.win') : t('player.form.loss')}</span>
                  <span aria-hidden="true">{row.win ? t('player.win') : t('player.loss')}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className={`form-trend${trend ? ` form-trend--${trend.verdict}` : ''}`}>
            {trendText}
            {trend && <span className="form-trend__kda"> {t('player.form.kdaLine', { recent: trend.recent.kda.toFixed(2), previous: trend.previous.kda.toFixed(2) })}</span>}
          </p>

          {series.length > 0 ? (
            <FormChart points={series} window={FORM_WINDOW} />
          ) : (
            <p className="matchup-panel__empty">{t('player.form.empty', { count: MIN_FORM_MATCHES, have: rows.length })}</p>
          )}
          {steps.length >= 2 && <RankChart steps={steps} />}
          <PlayerCurve accountId={accountId} badge={badge} language={language} />
        </>
      )}
    </section>
  );
}

export default PlayerForm;
