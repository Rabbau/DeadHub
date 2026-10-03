import { useHeroStore } from '../../store/heroStore';
import { useRanks } from '../../hooks/useRanks';
import { useTranslation } from '../../hooks/useTranslation';
import { formatShortDate } from '../../services/format';
import { badgePosition } from '../../services/playerHistoryService';
import { formatBadge } from '../../services/rankService';

const WIDTH = 560;
const HEIGHT = 130;
const PAD = 10;
/** Запас по краям оси, в подрангах: ранг не прижат к границе рамки. */
const MARGIN = 2;

/**
 * Ранг по рейтинговым матчам ступенями: каждая ступень — смена бейджа, по горизонтали настоящее время. Ось Y — шкала
 * из 66 подрангов, подогнанная под данные; на краях подписаны самый низкий и самый высокий ранг, который был.
 * @param {{ steps: Array<{ at: number, badge: number }> }} props
 */
function RankChart({ steps }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const ranks = useRanks();

  const positions = steps.map((step) => badgePosition(step.badge));
  const lo = Math.min(...positions) - MARGIN;
  const hi = Math.max(...positions) + MARGIN;
  const span = hi - lo || 1;
  const first = steps[0].at;
  const lastAt = steps[steps.length - 1].at;
  const timeSpan = lastAt - first || 1;

  const coords = steps.map((step, i) => ({
    x: PAD + ((step.at - first) / timeSpan) * (WIDTH - 2 * PAD),
    y: PAD + (HEIGHT - 2 * PAD) * (1 - (positions[i] - lo) / span),
  }));
  const round = (n) => Math.round(n * 10) / 10;
  // Ступень: горизонтально до момента смены, затем вертикально к новому рангу
  const path = coords
    .map((point, i) => (i === 0 ? `M${round(point.x)} ${round(point.y)}` : `H${round(point.x)} V${round(point.y)}`))
    .join(' ');

  const bestIndex = positions.indexOf(Math.max(...positions));
  const worstIndex = positions.indexOf(Math.min(...positions));
  const labelOf = (step) => formatBadge(ranks, step.badge);
  const lastStep = steps[steps.length - 1];
  const summary = `${labelOf(steps[0])} → ${labelOf(lastStep)}`;

  return (
    <figure className="trend-chart form-chart">
      <figcaption className="trend-chart__caption">
        <span className="trend-chart__label">{t('player.form.rankTitle')}</span>
        <span className="trend-chart__summary">{summary}</span>
      </figcaption>
      <svg className="trend-chart__svg form-chart__svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${t('player.form.rankAlt')}: ${summary}`}>
        <path className="trend-chart__line form-chart__stroke" d={path} fill="none" />
        {[worstIndex, bestIndex, steps.length - 1].filter((index, i, all) => all.indexOf(index) === i).map((index) => (
          <path key={index} className="form-chart__dot" d={`M${round(coords[index].x)} ${round(coords[index].y)}h0`}>
            <title>{`${formatShortDate(steps[index].at, language)}: ${labelOf(steps[index])}`}</title>
          </path>
        ))}
      </svg>
      <div className="trend-chart__axis" aria-hidden="true">
        <span>{formatShortDate(first, language)} · {labelOf(steps[0])}</span>
        <span>{formatShortDate(lastAt, language)} · {labelOf(lastStep)}</span>
      </div>
      <p className="form-chart__note">{t('player.form.rankNote')}</p>
    </figure>
  );
}

export default RankChart;
