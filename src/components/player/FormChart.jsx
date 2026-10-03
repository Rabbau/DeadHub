import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatShortDate } from '../../services/format';
import { formatWinrate } from '../../services/heroService';
import { axisRange, scaleSeries, seriesPath } from '../../services/trendService';

const WIDTH = 560;
const HEIGHT = 130;

/**
 * Скользящий винрейт по последним матчам: линия от старых матчей к новым, пунктир — 50%. Ось Y подогнана под
 * данные (видна форма, а не уровень); уровень написан в подписи.
 * @param {{ points: Array<{ at: number, winrate: number }>, window: number }} props
 */
function FormChart({ points, window }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  const values = points.map((point) => point.winrate);
  const { min, max } = axisRange(values);
  const coords = scaleSeries(values, { width: WIDTH, height: HEIGHT, min, max });
  const showReference = 0.5 > min && 0.5 < max;
  const referenceY = showReference ? scaleSeries([0.5], { width: WIDTH, height: HEIGHT, min, max })[0].y : null;

  const last = points[points.length - 1];
  const lastCoord = coords[coords.length - 1];
  const summary = `${formatWinrate(values[0])} → ${formatWinrate(last.winrate)}`;

  return (
    <figure className="trend-chart form-chart">
      <figcaption className="trend-chart__caption">
        <span className="trend-chart__label">{t('player.form.chartTitle', { window })}</span>
        <span className="trend-chart__summary">{summary}</span>
      </figcaption>
      {/* Рамка растягивается по ширине страницы, а линии и точка не должны: их толщина задана в экранных пикселях (vector-effect) */}
      <svg className="trend-chart__svg form-chart__svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${t('player.form.chartAlt', { count: points.length + window - 1 })}: ${summary}`}>
        {showReference && <line className="trend-chart__ref form-chart__stroke" x1="0" x2={WIDTH} y1={referenceY} y2={referenceY} />}
        <path className="trend-chart__line form-chart__stroke" d={seriesPath(coords)} fill="none" />
        <path className="form-chart__dot" d={`M${lastCoord.x} ${lastCoord.y}h0`}>
          <title>{`${formatShortDate(last.at, language)}: ${formatWinrate(last.winrate)}`}</title>
        </path>
      </svg>
      <div className="trend-chart__axis" aria-hidden="true">
        <span>{t('player.form.older')} · {formatShortDate(points[0].at, language)}</span>
        <span>{t('player.form.newer')} · {formatShortDate(last.at, language)}</span>
      </div>
    </figure>
  );
}

export default FormChart;
