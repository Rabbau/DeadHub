import { memo, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroIcon from '../hero/HeroIcon';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber } from '../../services/format';
import { formatWinrate } from '../../services/heroService';
import { matchupColor } from '../../services/matchupService';

// В ячейке число показываем, только если матчей достаточно, чтобы ему можно было верить
const MIN_CELL_MATCHES = 20;

/** Тело матрицы вынесено в memo: наведение на ячейку меняет только строку с описанием, а не 1400 ячеек. */
const MatrixTable = memo(function MatrixTable({ heroes, counters, onHover }) {
  return (
    <table className="matrix__table">
      <thead>
        <tr>
          <th className="matrix__corner" aria-hidden="true" />
          {heroes.map((hero) => (
            <th key={hero.id} scope="col" className="matrix__col" title={hero.name}>
              <HeroIcon hero={hero} size="xs" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {heroes.map((row) => (
          <tr key={row.id}>
            <th scope="row" className="matrix__row">
              <Link to={`/matchups?hero=${row.id}`}>
                <HeroIcon hero={row} size="xs" decorative />
                <span>{row.name}</span>
              </Link>
            </th>
            {heroes.map((col) => {
              if (row.id === col.id) return <td key={col.id} className="matrix__cell matrix__cell--self" />;
              const cell = counters?.get(row.id)?.get(col.id);
              const reliable = cell && cell.matches >= MIN_CELL_MATCHES;
              return (
                <td
                  key={col.id}
                  className="matrix__cell"
                  style={cell ? { background: matchupColor(cell.wr, cell.matches) } : undefined}
                  onMouseEnter={cell ? () => onHover({ row, col, cell }) : undefined}
                >
                  {reliable ? Math.round(cell.wr * 100) : ''}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

/** Тепловая карта «строка против столбца» по всем героям. */
function MatchupMatrix({ heroes, counters }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const [hovered, setHovered] = useState(null);
  const onHover = useCallback((value) => setHovered(value), []);

  const info = useMemo(() => {
    if (!hovered) return null;
    const { row, col, cell } = hovered;
    return t('matchups.matrixCell', {
      hero: row.name,
      enemy: col.name,
      wr: formatWinrate(cell.wr),
      count: formatNumber(cell.matches, language),
    });
  }, [hovered, language, t]);

  return (
    <div className="matrix">
      <p className="matrix__hint">{t('matchups.matrixHint')}</p>
      <div className="matrix__info" aria-live="polite">{info ?? ' '}</div>
      <div className="matrix__scroll">
        <MatrixTable heroes={heroes} counters={counters} onHover={onHover} />
      </div>
    </div>
  );
}

export default MatchupMatrix;
