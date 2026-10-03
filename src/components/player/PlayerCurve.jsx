import { useEffect, useMemo, useState } from 'react';
import { fetchPlayerCurve, fetchRankCurve } from '../../api/index.js';
import { useTranslation } from '../../hooks/useTranslation';
import { CURVE_DAYS, compareCurves, soulsRange } from '../../services/curveService';
import { formatCompact, formatNumber } from '../../services/format';
import { rankBand } from '../../services/playerInsightsService';

const WIDTH = 560;
const HEIGHT = 150;
const PAD = 8;

/** Число с одним знаком для строк таблицы: 5,7 убийств, 41 404 души — по правилам языка интерфейса. */
const cell = (key, value, language) => (key === 'souls' ? formatNumber(Math.round(value), language) : formatNumber(Math.round(value * 10) / 10, language));

/**
 * «Ход матча»: средние души игрока на каждой десятой доле матча рядом со средним игроком его ранга и итоги в конце
 * матча (души, убийства, смерти, помощь). Данные из player-performance-curve — это матчи, которые знает аналитика
 * API; запрос тяжёлый (у диапазона рангов — секунды), поэтому уходит, только когда посетитель раскрыл блок.
 * @param {{ accountId: number, badge: number|null, language: string }} props
 */
function PlayerCurve({ accountId, badge, language }) {
  const t = useTranslation();
  const [wanted, setWanted] = useState(false);
  const [state, setState] = useState({ status: 'idle', player: [], average: null });
  const band = useMemo(() => rankBand(badge), [badge]);
  const rankMin = band?.rankMin ?? null;
  const rankMax = band?.rankMax ?? null;

  useEffect(() => {
    if (!wanted) return undefined;
    let cancelled = false;
    setState({ status: 'loading', player: [], average: null });
    // Кривая ранга — дополнение: если она не загрузилась, показываем кривую самого игрока
    const average = rankMin ? fetchRankCurve({ rankMin, rankMax }).catch(() => null) : Promise.resolve(null);
    Promise.all([fetchPlayerCurve(accountId), average])
      .then(([player, rank]) => { if (!cancelled) setState({ status: 'ready', player, average: rank }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', player: [], average: null }); });
    return () => { cancelled = true; };
  }, [wanted, accountId, rankMin, rankMax]);

  const comparison = useMemo(() => compareCurves(state.player, state.average), [state.player, state.average]);
  const hasAverage = Boolean(comparison && comparison.rows[0].average != null);

  let body = null;
  if (wanted) {
    if (state.status === 'loading' || state.status === 'idle') {
      body = <p className="matchup-panel__empty">{t('player.curve.loading')}</p>;
    } else if (state.status === 'error') {
      body = <p className="matchup-panel__empty">{t('player.curve.error')}</p>;
    } else if (!comparison) {
      body = <p className="matchup-panel__empty">{t('player.curve.empty', { days: CURVE_DAYS })}</p>;
    } else {
      const range = soulsRange(state.player, hasAverage ? state.average : null);
      const x = (at) => PAD + (at / 100) * (WIDTH - 2 * PAD);
      const y = (souls) => PAD + (HEIGHT - 2 * PAD) * (1 - (souls - range.min) / (range.max - range.min || 1));
      const path = (curve) => curve.map((point, i) => `${i === 0 ? 'M' : 'L'}${Math.round(x(point.at) * 10) / 10} ${Math.round(y(point.souls) * 10) / 10}`).join(' ');
      const souls = comparison.rows[0];
      const summary = hasAverage
        ? `${formatCompact(souls.player, language)} / ${formatCompact(souls.average, language)}`
        : formatCompact(souls.player, language);

      body = (
        <>
          <figure className="trend-chart form-chart">
            <figcaption className="trend-chart__caption">
              <span className="curve-legend">
                <span className="curve-legend__item"><span className="curve-legend__swatch" />{t('player.curve.playerLine')}</span>
                {hasAverage && <span className="curve-legend__item"><span className="curve-legend__swatch curve-legend__swatch--avg" />{t('player.curve.averageLine')}</span>}
              </span>
              <span className="trend-chart__summary">{summary}</span>
            </figcaption>
            <svg
              className="trend-chart__svg form-chart__svg"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={t('player.curve.alt', { summary })}
            >
              {hasAverage && <path className="trend-chart__line form-chart__stroke curve-line--avg" d={path(state.average)} fill="none" />}
              <path className="trend-chart__line form-chart__stroke" d={path(state.player)} fill="none" />
            </svg>
            <div className="trend-chart__axis" aria-hidden="true">
              <span>{t('player.curve.start')}</span>
              <span>{t('player.curve.end')}</span>
            </div>
          </figure>

          <div className="compare-table-wrapper">
            <table className="lb-table curve-table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">{t('player.curve.summary')}</span></th>
                  <th scope="col" className="num">{t('player.curve.colPlayer')}</th>
                  {hasAverage && <th scope="col" className="num">{t('player.curve.colAverage')}</th>}
                  {hasAverage && <th scope="col" className="num">{t('player.curve.colRatio')}</th>}
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{t(`player.curve.rows.${row.key}`)}</th>
                    <td className="num">{cell(row.key, row.player, language)}</td>
                    {hasAverage && <td className="num">{cell(row.key, row.average, language)}</td>}
                    {hasAverage && <td className="num">{row.ratio != null ? `×${row.ratio.toFixed(2)}` : '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="player-section__note">{t('player.curve.note')}</p>
        </>
      );
    }
  }

  return (
    <details className="curve-box" onToggle={(event) => { if (event.currentTarget.open) setWanted(true); }}>
      <summary>{t('player.curve.title')} · {t('player.curve.summary')}</summary>
      <p className="player-section__lead">
        {band
          ? t('player.curve.lead', { days: CURVE_DAYS, from: band.rankMin, to: band.rankMax })
          : t('player.curve.leadNoRank', { days: CURVE_DAYS })}
      </p>
      {body}
    </details>
  );
}

export default PlayerCurve;
