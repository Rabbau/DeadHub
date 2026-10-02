import { useMemo } from 'react';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatCompact, formatNumber } from '../../services/format';
import { teamTotals } from '../../services/matchService';

// Строки сравнения команд: key — поле teamTotals; compact — крупные числа сокращаем («412K»)
const ROWS = [
  { key: 'kills', label: 'match.kills' },
  { key: 'netWorth', label: 'match.souls', compact: true },
  { key: 'damage', label: 'match.damage', compact: true },
  { key: 'healing', label: 'match.healing', compact: true },
  { key: 'objectives', label: 'match.objectives' },
  { key: 'midBoss', label: 'match.midBoss', skipEmpty: true },
];

/**
 * Две команды в сравнении: числа по краям, между ними полоска доли каждой команды.
 * Строка без данных у обеих (например, босс середины в Street Brawl) не показывается.
 */
function MatchSummary({ match }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const totals = useMemo(() => teamTotals(match), [match]);
  const show = (value, row) => (row.compact ? formatCompact(value, language) : formatNumber(value, language));

  return (
    <section className="match-compare" aria-label={t('match.compareTitle')}>
      <div className="match-compare__head">
        <span className="match-compare__team match-compare__team--a">{t('match.teamN', { n: 1 })}</span>
        <span className="match-compare__team match-compare__team--b">{t('match.teamN', { n: 2 })}</span>
      </div>
      {ROWS.map((row) => {
        const [a, b] = totals.map((team) => team[row.key]);
        if (row.skipEmpty && a + b === 0) return null;
        const share = a + b > 0 ? (a / (a + b)) * 100 : 50;
        return (
          <div key={row.key} className="match-compare__row">
            <span className="match-compare__value">{show(a, row)}</span>
            <span className="match-compare__mid">
              <span className="match-compare__label">{t(row.label)}</span>
              <span className="match-compare__bar" aria-hidden="true">
                <span className="match-compare__fill match-compare__fill--a" style={{ width: `${share}%` }} />
                <span className="match-compare__fill match-compare__fill--b" style={{ width: `${100 - share}%` }} />
              </span>
            </span>
            <span className="match-compare__value match-compare__value--b">{show(b, row)}</span>
          </div>
        );
      })}
    </section>
  );
}

export default MatchSummary;
