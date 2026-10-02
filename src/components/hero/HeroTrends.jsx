import { useRef } from 'react';
import TrendChart from './TrendChart';
import { useHeroStore } from '../../store/heroStore';
import { useHeroTrend } from '../../hooks/useHeroTrend';
import { useInView } from '../../hooks/useInView';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber, formatShortDate } from '../../services/format';
import { formatPickrate, formatWinrate } from '../../services/heroService';
import { MIN_TREND_MATCHES, TREND_WEEKS } from '../../services/trendService';

/**
 * Динамика героя по неделям. Данные запрашиваются, когда блок подходит к экрану: это один тяжёлый запрос
 * к бесплатному API, и большинству посетителей до конца страницы героя не дойти.
 * @param {{ heroId: number }} props
 */
function HeroTrends({ heroId }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const ref = useRef(null);
  const seen = useInView(ref);
  const { points, loading, error } = useHeroTrend(heroId, { enabled: seen });

  let body;
  if (!seen || (loading && points.length === 0)) {
    body = <p className="hero-section__hint">{t('common.loading')}</p>;
  } else if (error) {
    body = <p className="hero-section__hint">{t('common.error')}: {error}</p>;
  } else if (points.length < 2) {
    body = <p className="hero-section__hint">{t('trend.notEnough')}</p>;
  } else {
    body = (
      <>
        <div className="trend-grid">
          <TrendChart points={points} valueOf={(p) => p.wr} formatValue={formatWinrate} label={t('trend.wr')} reference={0.5} />
          <TrendChart points={points} valueOf={(p) => p.pr} formatValue={formatPickrate} label={t('trend.pr')} />
        </div>
        <p className="hero-section__hint">{t('trend.note', { weeks: TREND_WEEKS, min: MIN_TREND_MATCHES })}</p>
        <details className="trend-numbers">
          <summary>{t('trend.showNumbers')}</summary>
          <table className="trend-table">
            <thead>
              <tr>
                <th scope="col">{t('trend.colWeek')}</th>
                <th scope="col" className="num">WR</th>
                <th scope="col" className="num">PR</th>
                <th scope="col" className="num">{t('heroPage.matches')}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.week}>
                  <td>{formatShortDate(point.week, language)}{point.partial ? ' *' : ''}</td>
                  <td className="num">{formatWinrate(point.wr)}</td>
                  <td className="num">{formatPickrate(point.pr)}</td>
                  <td className="num">{formatNumber(point.matches, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </>
    );
  }

  return (
    <section id="trends" ref={ref} className="section hero-section">
      <h2 className="section__title">{t('heroPage.trends')}</h2>
      {body}
    </section>
  );
}

export default HeroTrends;
