import { useId, useMemo } from 'react';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatCompact, formatDuration } from '../../services/format';
import { leadRange, soulsLead } from '../../services/matchService';

const W = 640;
const H = 200;
const PAD_X = 8;
const PAD_Y = 16;

/** Шаг подписей оси времени: 5, 10 или 15 минут — не больше восьми подписей. */
function tickStep(duration) {
  const minutes = duration / 60;
  if (minutes <= 40) return 300;
  if (minutes <= 80) return 600;
  return 900;
}

/**
 * Перевес по душам: сумма души команды 1 минус сумма души команды 2 по срезам статистики (раз в 3–5 минут).
 * Выше нулевой линии — впереди команда 1, ниже — команда 2. На линии — разрушенные объекты (цвет — кто разрушил)
 * и убийства босса середины. Срезов мало, поэтому это форма игры, а не поминутная хронология.
 * @param {{ match: ReturnType<typeof import('../../services/matchService').slimMatch> }} props
 */
function SoulsChart({ match }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const id = useId();

  const points = useMemo(() => soulsLead(match), [match]);
  const duration = Math.max(match.duration, points[points.length - 1]?.time ?? 0, 1);
  const peak = points.reduce((best, point) => (Math.abs(point.lead) > Math.abs(best.lead) ? point : best), points[0]);
  const { up, down } = useMemo(() => leadRange(points), [points]);

  const x = (time) => PAD_X + (time / duration) * (W - 2 * PAD_X);
  const y = (lead) => PAD_Y + ((up - lead) / (up + down)) * (H - 2 * PAD_Y);
  // Нулевая линия не посередине: если матч вёл один соперник, пустая сторона сжата (см. leadRange)
  const mid = y(0);

  const line = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.time).toFixed(1)} ${y(point.lead).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points[points.length - 1].time).toFixed(1)} ${mid.toFixed(1)} L${x(0).toFixed(1)} ${mid.toFixed(1)} Z`;

  const ticks = [];
  for (let time = 0; time <= duration; time += tickStep(duration)) ticks.push(time);

  const teamName = (team) => t('match.teamN', { n: team + 1 });
  const peakText = peak.lead === 0
    ? t('match.leadEven')
    : t('match.leadPeak', { team: teamName(peak.lead > 0 ? 0 : 1), souls: formatCompact(Math.abs(peak.lead), language), time: formatDuration(peak.time) });

  return (
    <figure className="match-chart">
      <figcaption className="match-chart__caption">
        <span className="match-chart__title">{t('match.leadTitle')}</span>
        <span className="match-chart__peak">{peakText}</span>
      </figcaption>

      <svg className="match-chart__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t('match.leadTitle')}: ${peakText}`}>
        <defs>
          <clipPath id={`${id}-above`}><rect x="0" y="0" width={W} height={mid} /></clipPath>
          <clipPath id={`${id}-below`}><rect x="0" y={mid} width={W} height={H - mid} /></clipPath>
        </defs>

        {ticks.map((time) => <line key={time} className="match-chart__grid" x1={x(time)} x2={x(time)} y1={PAD_Y / 2} y2={H - PAD_Y / 2} />)}
        <line className="match-chart__zero" x1="0" x2={W} y1={mid} y2={mid} />

        <path className="match-chart__area match-chart__area--a" d={area} clipPath={`url(#${id}-above)`} />
        <path className="match-chart__area match-chart__area--b" d={area} clipPath={`url(#${id}-below)`} />
        <path className="match-chart__line" d={line} fill="none" />

        {points.map((point) => (
          <circle key={point.time} className="match-chart__dot" cx={x(point.time)} cy={y(point.lead)} r="3.5">
            <title>
              {t('match.leadPoint', {
                time: formatDuration(point.time),
                a: formatCompact(point.teams[0], language),
                b: formatCompact(point.teams[1], language),
              })}
            </title>
          </circle>
        ))}

        {match.objectives.map((objective, i) => (
          <circle
            key={`o${i}`}
            className={`match-chart__mark match-chart__mark--${objective.team === 0 ? 'b' : 'a'}`}
            cx={x(objective.time)}
            cy={mid}
            r="3"
          >
            <title>{t('match.objectiveMark', { team: teamName(objective.team === 0 ? 1 : 0), time: formatDuration(objective.time) })}</title>
          </circle>
        ))}
        {match.midBoss.filter((event) => event.team === 0 || event.team === 1).map((event, i) => (
          <rect
            key={`b${i}`}
            className={`match-chart__boss match-chart__boss--${event.team === 0 ? 'a' : 'b'}`}
            x={x(event.time) - 5}
            y={mid - 5}
            width="10"
            height="10"
            transform={`rotate(45 ${x(event.time)} ${mid})`}
          >
            <title>{t('match.bossMark', { team: teamName(event.team), time: formatDuration(event.time) })}</title>
          </rect>
        ))}
      </svg>

      <div className="match-chart__axis" aria-hidden="true">
        {ticks.map((time) => (
          <span key={time} style={{ left: `${(x(time) / W) * 100}%` }}>{formatDuration(time)}</span>
        ))}
      </div>
      <p className="match-chart__legend">
        <span className="match-chart__swatch match-chart__swatch--a" /> {teamName(0)}
        <span className="match-chart__swatch match-chart__swatch--b" /> {teamName(1)}
        <span className="match-chart__legend-note">{t('match.leadLegend')}</span>
      </p>
    </figure>
  );
}

export default SoulsChart;
