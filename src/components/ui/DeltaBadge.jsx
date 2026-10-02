import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { deltaDirection } from '../../services/deltaService';
import { formatNumber, formatPoints } from '../../services/format';
import { formatWinrate } from '../../services/heroService';

const ARROWS = { up: '▲', down: '▼', flat: '' };

/**
 * Изменение винрейта героя к прошлому периоду в процентных пунктах. Цвет и стрелка — только у значимых
 * изменений: остальное в пределах случайного разброса, и подсвечивать его значило бы обманывать.
 * Когда у героя слишком мало матчей для сравнения, показывается прочерк.
 * @param {{ delta?: ReturnType<import('../../services/deltaService').computeHeroDeltas>[number] }} props
 */
function DeltaBadge({ delta }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  if (!delta || !delta.reliable) return <span className="delta delta--none">—</span>;

  const direction = deltaDirection(delta);
  const text = `${delta.significant ? ARROWS[direction] : ''}${formatPoints(delta.dWr)}`;
  const note = t(delta.significant ? 'delta.significant' : 'delta.noise');
  const details = t('delta.tooltip', { was: formatWinrate(delta.wr0), count: formatNumber(delta.matches0, language), note });

  return (
    <span
      className={`delta delta--${direction}${delta.significant ? ' is-significant' : ''}`}
      title={details}
      aria-label={`${formatPoints(delta.dWr)} — ${details}`}
    >
      {text}
    </span>
  );
}

export default DeltaBadge;
