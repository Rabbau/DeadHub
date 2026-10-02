import { Link } from 'react-router-dom';
import HeroIcon from './HeroIcon';
import DeltaBadge from '../ui/DeltaBadge';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatNumber } from '../../services/format';
import { formatPickrate, formatWinrate, winrateColor } from '../../services/heroService';

// Колонки таблицы: id совпадает с ключом сортировки в filterAndSort; firstDir — в какую сторону
// сортируем при первом щелчке по колонке (имена — от А, числа — от большего)
const COLUMNS = [
  { id: 'name', className: 'hero-table__hero', firstDir: 'asc' },
  { id: 'winrate', className: 'num', firstDir: 'desc', label: 'WR', titleKey: 'heroPage.winrate' },
  { id: 'delta', className: 'num hero-table__delta', firstDir: 'desc', label: 'Δ WR', titleKey: 'delta.columnTitle', onlyWithDelta: true },
  { id: 'pickrate', className: 'num', firstDir: 'desc', label: 'PR', titleKey: 'heroPage.pickrate' },
  { id: 'matches', className: 'num hero-table__matches', firstDir: 'desc', titleKey: 'heroPage.matches' },
  { id: 'kda', className: 'num hero-table__kda', firstDir: 'desc', label: 'KDA' },
];

/**
 * Герои таблицей: сравнивать цифры в таблице гораздо удобнее, чем в карточках, особенно на телефоне.
 * Заголовок колонки — кнопка сортировки; строка целиком ведёт на страницу героя.
 * showHeader=false — компактная таблица без заголовка и сортировки (для вспомогательных списков).
 * showDelta — добавляет колонку «Δ WR» (изменение к прошлому периоду): у героев должно быть поле `delta`.
 * @param {{ heroes: Array<object>, sort: string, dir: 'asc'|'desc', onSort: (id: string, firstDir: 'asc'|'desc') => void, showHeader?: boolean, showDelta?: boolean }} props
 */
function HeroTable({ heroes, sort, dir, onSort, showHeader = true, showDelta = false }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const columns = COLUMNS.filter((column) => !column.onlyWithDelta || showDelta);

  return (
    <div className="hero-table-wrap">
      <table className={`hero-table${showDelta ? ' hero-table--delta' : ''}`}>
        {showHeader && (
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort === column.id;
                const text = column.id === 'name'
                  ? t('heroesPage.colHero')
                  : column.label ?? t(column.titleKey);
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={column.className}
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      className={`hero-table__sort${active ? ' is-active' : ''}`}
                      title={column.titleKey ? t(column.titleKey) : undefined}
                      onClick={() => onSort(column.id, column.firstDir)}
                    >
                      {text}
                      <span className="hero-table__arrow" aria-hidden="true">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody>
          {heroes.map((hero) => {
            // У героя может не быть матчей в выбранной выборке — тогда честный прочерк, а не 0%
            const hasStats = hero.stats.games_played > 0;
            return (
              <tr key={hero.id}>
                <td className="hero-table__hero">
                  <Link to={`/hero/${hero.id}`} className="hero-table__link">
                    <HeroIcon hero={hero} size="sm" decorative />
                    <span className="hero-table__name">{hero.name}</span>
                    {hero.role && <span className="tag tag--role hero-table__role">{hero.role}</span>}
                  </Link>
                </td>
                <td className={`num${hasStats ? ` winrate-${winrateColor(hero.stats.winrate)}` : ''}`}>
                  {hasStats ? formatWinrate(hero.stats.winrate) : '—'}
                </td>
                {showDelta && (
                  <td className="num hero-table__delta">
                    {hasStats ? <DeltaBadge delta={hero.delta} /> : '—'}
                  </td>
                )}
                <td className="num">{hasStats ? formatPickrate(hero.stats.pickrate) : '—'}</td>
                <td className="num hero-table__matches">{hasStats ? formatNumber(hero.stats.games_played, language) : '—'}</td>
                <td className="num hero-table__kda">{hero.stats.kda != null ? hero.stats.kda.toFixed(2) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default HeroTable;
