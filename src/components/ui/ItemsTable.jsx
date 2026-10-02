import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StatsFilters from './StatsFilters';
import { useHeroes } from '../../hooks/useHeroes';
import { useItemStatsTable } from '../../hooks/useItemStatsTable';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatNumber } from '../../services/format';
import { formatPickrate, formatWinrate, winrateColor } from '../../services/heroService';
import { buildItemRows, formatBuyTime, sortItemRows } from '../../services/itemStatsService';

const SLOT_KEYS = {
  weapon: 'itemCard.slotWeapon',
  vitality: 'itemCard.slotVitality',
  spirit: 'itemCard.slotSpirit',
};

// Колонки: id — ключ сортировки в sortItemRows; firstDir — в какую сторону сортируем при первом щелчке
const COLUMNS = [
  { id: 'name', className: 'item-table__item', firstDir: 'asc', labelKey: 'itemsPage.colItem' },
  { id: 'slot', className: 'item-table__slot', labelKey: 'itemsPage.colSlot', sortable: false },
  { id: 'cost', className: 'num item-table__cost', firstDir: 'asc', labelKey: 'itemsPage.colCost' },
  { id: 'winrate', className: 'num', firstDir: 'desc', label: 'WR', titleKey: 'heroPage.winrate' },
  { id: 'usage', className: 'num', firstDir: 'desc', labelKey: 'itemsPage.colUsage', titleKey: 'itemsPage.usageHint' },
  { id: 'matches', className: 'num item-table__matches', firstDir: 'desc', labelKey: 'heroPage.matches' },
  { id: 'buyTime', className: 'num item-table__time', firstDir: 'asc', labelKey: 'itemsPage.colBuyTime', titleKey: 'itemsPage.buyTimeHint' },
];

/**
 * Предметы таблицей со статистикой: винрейт, частота покупки, число покупок, среднее время покупки.
 * Фильтры слота, тира и названия приходят от страницы (`items` — уже отфильтрованный список); здесь —
 * период, ранги и режим (общие фильтры сайта), выбор героя и сортировка по колонкам.
 * Статистика запрашивается только когда эта таблица открыта.
 * @param {{ items: Array<object> }} props
 */
function ItemsTable({ items }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const { allHeroes } = useHeroes();
  const [heroId, setHeroId] = useState(null);
  const [sort, setSort] = useState('usage');
  const [dir, setDir] = useState('desc');
  const { statsById, loading, error } = useItemStatsTable(heroId);

  const heroes = useMemo(
    () => allHeroes.filter((hero) => hero.released).sort((a, b) => a.name.localeCompare(b.name)),
    [allHeroes],
  );

  // Частота покупки — доля матчей, в которых предмет купили: у героя — от его матчей, иначе — от всех пиков выборки
  const base = useMemo(() => {
    if (heroId) return allHeroes.find((hero) => hero.id === heroId)?.stats.games_played ?? 0;
    return allHeroes.reduce((sum, hero) => sum + hero.stats.games_played, 0);
  }, [allHeroes, heroId]);

  const rows = useMemo(
    () => sortItemRows(buildItemRows(items, statsById, base), sort, dir),
    [items, statsById, base, sort, dir],
  );

  const handleSort = (id, firstDir) => {
    if (sort === id) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setSort(id); setDir(firstDir); }
  };

  return (
    <div className="items-table">
      <StatsFilters />

      <div className="filters items-table__controls">
        <label className="items-table__hero">
          <span className="stats-filters__label">{t('itemsPage.forHero')}</span>
          <select className="select" value={heroId ?? ''} onChange={(e) => setHeroId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('itemsPage.allHeroes')}</option>
            {heroes.map((hero) => <option key={hero.id} value={hero.id}>{hero.name}</option>)}
          </select>
        </label>
        <p className="delta-note items-table__note">{t('itemsPage.tableNote')}</p>
      </div>

      {error && <div className="state-center state-error">{t('common.error')}: {error}</div>}

      <div className={`hero-table-wrap${loading ? ' is-refreshing' : ''}`} aria-busy={loading}>
        <table className="hero-table item-table">
          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const active = sort === column.id;
                const text = column.label ?? t(column.labelKey);
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={column.className}
                    aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {column.sortable === false ? (
                      <span className="hero-table__sort">{text}</span>
                    ) : (
                      <button
                        type="button"
                        className={`hero-table__sort${active ? ' is-active' : ''}`}
                        title={column.titleKey ? t(column.titleKey) : undefined}
                        onClick={() => handleSort(column.id, column.firstDir)}
                      >
                        {text}
                        <span className="hero-table__arrow" aria-hidden="true">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, matches, winrate, usage, buyTimeS, reliable }) => {
              const hasStats = matches > 0;
              return (
                <tr key={item.id} className={hasStats && !reliable ? 'is-low-sample' : undefined}>
                  <td className="item-table__item">
                    <Link to={`/items/${item.id}`} className="hero-table__link">
                      {item.image_url
                        ? <img src={item.image_url} alt="" className="item-table__img" loading="lazy" decoding="async" />
                        : <span className="item-table__img item-table__img--empty" aria-hidden="true" />}
                      <span className="hero-table__name">{item.name}</span>
                    </Link>
                  </td>
                  <td className="item-table__slot">
                    {item.item_slot_type && (
                      <span className={`tag item-table__tag item-table__tag--${item.item_slot_type}`}>
                        {t(SLOT_KEYS[item.item_slot_type] || 'itemCard.slotWeapon')}
                      </span>
                    )}
                  </td>
                  <td className="num item-table__cost">{item.cost != null ? formatNumber(item.cost, language) : '—'}</td>
                  <td className={`num${hasStats ? ` winrate-${winrateColor(winrate)}` : ''}`}>{hasStats ? formatWinrate(winrate) : '—'}</td>
                  <td className="num">{hasStats && usage != null ? formatPickrate(usage) : '—'}</td>
                  <td className="num item-table__matches">{hasStats ? formatNumber(matches, language) : '—'}</td>
                  <td className="num item-table__time">{hasStats ? formatBuyTime(buyTimeS) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ItemsTable;
