import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber, formatPoints, formatShortDate } from '../../services/format';
import { axisRange, scaleSeries, seriesPath } from '../../services/trendService';

const WIDTH = 320;
const HEIGHT = 104;

/**
 * Линия одного показателя по неделям. Пустая точка — неполная неделя. Ось Y подогнана под данные, поэтому
 * график показывает форму изменения, а не абсолютный уровень: уровень написан цифрами в заголовке.
 * @param {{
 *   points: Array<{ week: number, matches: number, partial: boolean }>,
 *   valueOf: (point: object) => number,
 *   formatValue: (value: number) => string,
 *   label: string,
 *   reference?: number
 * }} props reference — пунктирная линия (например, 50% винрейта), если она попадает в диапазон
 */
function TrendChart({ points, valueOf, formatValue, label, reference }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  const values = points.map(valueOf);
  const { min, max } = axisRange(values);
  const coords = scaleSeries(values, { width: WIDTH, height: HEIGHT, min, max });
  const showReference = reference != null && reference > min && reference < max;
  const referenceY = showReference ? scaleSeries([reference], { width: WIDTH, height: HEIGHT, min, max })[0].y : null;

  const first = values[0];
  const last = values[values.length - 1];
  const summary = `${formatValue(first)} → ${formatValue(last)} (${formatPoints(last - first)})`;

  return (
    <figure className="trend-chart">
      <figcaption className="trend-chart__caption">
        <span className="trend-chart__label">{label}</span>
        <span className="trend-chart__summary">{summary}</span>
      </figcaption>

      <svg
        className="trend-chart__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${label}: ${summary}`}
      >
        {showReference && <line className="trend-chart__ref" x1="0" x2={WIDTH} y1={referenceY} y2={referenceY} />}
        <path className="trend-chart__line" d={seriesPath(coords)} fill="none" />
        {coords.map((point, i) => (
          <circle
            key={points[i].week}
            className={`trend-chart__dot${points[i].partial ? ' is-partial' : ''}`}
            cx={point.x}
            cy={point.y}
            r="3.5"
          >
            <title>
              {t('trend.tooltip', {
                date: formatShortDate(points[i].week, language),
                value: formatValue(values[i]),
                count: formatNumber(points[i].matches, language),
              })}
              {points[i].partial ? ` · ${t('trend.partial')}` : ''}
            </title>
          </circle>
        ))}
      </svg>

      <div className="trend-chart__axis" aria-hidden="true">
        <span>{formatShortDate(points[0].week, language)}</span>
        <span>{formatShortDate(points[points.length - 1].week, language)}</span>
      </div>
    </figure>
  );
}

export default TrendChart;
