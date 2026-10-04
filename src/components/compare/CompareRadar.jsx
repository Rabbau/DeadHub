import { useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { COMPARE_COLORS, radarAxes, radarLevel, radarPoint } from '../../services/compareService';

const VIEW = { width: 470, height: 420 };
const CENTER = { cx: VIEW.width / 2, cy: 214, radius: 142 };
const RINGS = [0.25, 0.5, 0.75, 1];

const fmt = (n) => n.toFixed(1);
const pointsOf = (count, levelAt) => Array.from({ length: count }, (_, index) => radarPoint(index, count, levelAt(index), CENTER).map(fmt).join(',')).join(' ');

/**
 * Профиль героев на радаре. Шкала каждой оси — от самого слабого до самого сильного героя игры (по `roster`),
 * а не только среди выбранных: фигура одного героя показывает, где он силён вообще, а не «относительно себя».
 * Для скринридера под рисунком — таблица тех же значений.
 * @param {{ heroes: any[], roster: any[] }} props heroes — выбранные герои, roster — все доступные
 */
function CompareRadar({ heroes, roster }) {
  const t = useTranslation();
  const axes = useMemo(() => radarAxes(roster), [roster]);
  const count = axes.length;
  const ready = count >= 3;

  return (
    <section className="cmp-chart" aria-labelledby="cmp-chart-title">
      <h2 id="cmp-chart-title" className="section__title">{t('compare.chartTitle')}</h2>

      {ready ? (
        <div className="cmp-chart__body">
          <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label={t('compare.chartLabel')}>
            {RINGS.map((level) => <polygon key={level} className={level === 1 ? 'cmp-ring cmp-ring--rim' : 'cmp-ring'} points={pointsOf(count, () => level)} />)}
            {axes.map((axis, index) => {
              const [x, y] = radarPoint(index, count, 1, CENTER);
              return <line key={axis.id} className="cmp-spoke" x1={CENTER.cx} y1={CENTER.cy} x2={fmt(x)} y2={fmt(y)} />;
            })}
            {heroes.map((hero, heroIndex) => (
              <g key={hero.id} className="cmp-shape" style={{ '--c': COMPARE_COLORS[heroIndex] }}>
                <polygon points={pointsOf(count, (index) => radarLevel(axes[index], hero))} />
                {axes.map((axis, index) => {
                  const [x, y] = radarPoint(index, count, radarLevel(axis, hero), CENTER);
                  return <circle key={axis.id} cx={fmt(x)} cy={fmt(y)} r="4" />;
                })}
              </g>
            ))}
            {axes.map((axis, index) => {
              const [x, y] = radarPoint(index, count, 1.2, CENTER);
              const anchor = Math.abs(x - CENTER.cx) < 6 ? 'middle' : x > CENTER.cx ? 'start' : 'end';
              return <text key={axis.id} className="cmp-axis" x={fmt(x)} y={fmt(y + 4)} textAnchor={anchor}>{t(axis.label)}</text>;
            })}
          </svg>
          {heroes.length === 0 && <p className="cmp-chart__empty"><span>{t('compare.chartEmpty')}</span></p>}

          <table className="sr-only">
            <caption>{t('compare.chartLabel')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('compare.heroColumn')}</th>
                {axes.map((axis) => <th key={axis.id} scope="col">{t(axis.label)}</th>)}
              </tr>
            </thead>
            <tbody>
              {heroes.map((hero) => (
                <tr key={hero.id}>
                  <th scope="row">{hero.name}</th>
                  {axes.map((axis) => <td key={axis.id}>{axis.get(hero) ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="cmp-chart__empty cmp-chart__empty--static">{t('compare.chartUnavailable')}</p>
      )}

      {heroes.length > 0 && (
        <ul className="cmp-legend">
          {heroes.map((hero, index) => (
            <li key={hero.id} className="cmp-key" style={{ '--c': COMPARE_COLORS[index] }}>
              <i aria-hidden="true" />
              {hero.name}
            </li>
          ))}
        </ul>
      )}
      <p className="cmp-chart__note">{t('compare.chartNote')}</p>
    </section>
  );
}

export default CompareRadar;
