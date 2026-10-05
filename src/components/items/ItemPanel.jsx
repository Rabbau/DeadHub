import { Link } from 'react-router-dom';
import HeroIcon from '../hero/HeroIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatNumber } from '../../services/format';
import { formatPickrate, formatWinrate, winrateColor } from '../../services/heroService';
import { getItemStats, getPriceTierKey, itemKind } from '../../services/itemService';
import { MIN_RELIABLE_MATCHES } from '../../services/itemStatsService';
import { CloseIcon, SoulMark } from './ItemIcons';
import ItemTile from './ItemTile';
import { SLOT_KEYS, tierLabel } from './labels';

// Столько строк характеристик помещается в панель; остальное — на странице предмета
const MAX_STAT_ROWS = 6;
const TOP_HEROES = 4;

/** Список предметов-ссылок («Собирается из», «Улучшается в»): щелчок выбирает предмет, не уходя со страницы. */
function ItemLinks({ title, items, onSelect }) {
  const language = useHeroStore((state) => state.language);
  if (items.length === 0) return null;

  return (
    <section className="shop-panel__sec">
      <h3>{title}</h3>
      <ul className="shop-links">
        {items.map((entry) => (
          <li key={entry.id}>
            <button type="button" className={`shop-link shop-link--${entry.item_slot_type}`} onClick={() => onSelect(entry.id)}>
              <ItemTile item={entry} size="sm" />
              <span className="shop-link__name">{entry.name}</span>
              {entry.cost != null && (
                <span className="shop-link__cost">
                  {formatNumber(entry.cost, language)}
                  <SoulMark />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Панель выбранного предмета: название, слот · тир · тип, цена, характеристики, винрейт и доля покупок (по общим
 * фильтрам сайта), из чего собирается и во что улучшается, герои, которые берут его чаще всех, ссылка на страницу
 * предмета. На широком экране приклеена справа, на узком выезжает снизу (sheet) и закрывается крестиком.
 * @param {{
 *   item: object, graph: ReturnType<typeof import('../../services/itemService').buildItemGraph>,
 *   stat: { matches: number, wins: number }|null, usage: number|null, statsLoading: boolean, basis: string,
 *   heroUsage: Array<{ heroId: number, matches: number, winrate: number }>, heroUsageLoading: boolean, heroById: Map<number, any>,
 *   onSelect: (id: number) => void, onClose: () => void, onChangeFilters: () => void, sheet: boolean,
 * }} props
 */
function ItemPanel({ item, graph, stat, usage, statsLoading, basis, heroUsage, heroUsageLoading, heroById, onSelect, onClose, onChangeFilters, sheet }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  const lines = getItemStats(item).slice(0, MAX_STAT_ROWS);
  const tierKey = item.cost != null ? getPriceTierKey(item.cost) : null;
  const winrate = stat && stat.matches > 0 ? stat.wins / stat.matches : null;
  const lowSample = stat != null && stat.matches > 0 && stat.matches < MIN_RELIABLE_MATCHES;
  const heroes = heroUsage.map((entry) => ({ entry, hero: heroById.get(entry.heroId) })).filter(({ hero }) => hero).slice(0, TOP_HEROES);

  return (
    <aside className={`shop-panel shop-panel--${item.item_slot_type ?? 'none'}${sheet ? ' is-sheet' : ''}`} aria-label={t('itemsPage.panelLabel')}>
      {sheet && (
        <button type="button" className="shop-panel__close" aria-label={t('itemsPage.panelClose')} onClick={onClose}>
          <CloseIcon />
        </button>
      )}

      <header className="shop-panel__head">
        <ItemTile item={item} size="lg" />
        <div className="shop-panel__title">
          <h2 className="shop-panel__name">{item.name}</h2>
          <p className="shop-panel__meta">
            {item.item_slot_type && <span className="shop-panel__slot">{t(SLOT_KEYS[item.item_slot_type])}</span>}
            {tierKey && <span>{tierLabel(t, tierKey)}</span>}
            <span>{t(`itemsPage.kinds.${itemKind(item)}`)}</span>
          </p>
        </div>
        {item.cost != null && (
          <div className="shop-panel__cost">
            {formatNumber(item.cost, language)}
            <SoulMark />
          </div>
        )}
      </header>

      {lines.length > 0 && (
        <ul className="shop-panel__stats">
          {lines.map((line, index) => (
            <li key={`${line.label}-${index}`} className={line.elevated ? 'is-key' : undefined}>
              <span>{line.label}</span>
              <b>{line.text}</b>
            </li>
          ))}
        </ul>
      )}

      <div className="shop-panel__numbers" aria-busy={statsLoading}>
        <div>
          <span>{t('itemsPage.winrate')}</span>
          <b className={winrate != null ? `winrate-${winrateColor(winrate)}` : 'is-empty'}>{winrate != null ? formatWinrate(winrate) : '—'}</b>
        </div>
        <div>
          <span>{t('itemsPage.usage')}</span>
          <b className={usage == null ? 'is-empty' : undefined}>{usage != null ? formatPickrate(usage) : '—'}</b>
        </div>
      </div>
      <p className="shop-panel__basis">
        {basis}
        <button type="button" onClick={onChangeFilters}>{t('itemsPage.changeFilters')}</button>
        {lowSample && <span className="shop-panel__warn">{t('itemsPage.lowSample')}</span>}
        {!statsLoading && !stat && <span className="shop-panel__warn">{t('itemsPage.noStats')}</span>}
      </p>

      <ItemLinks title={t('itemsPage.builtFrom')} items={graph.components(item)} onSelect={onSelect} />
      <ItemLinks title={t('itemsPage.upgradesInto')} items={graph.upgradesInto(item)} onSelect={onSelect} />

      {(heroes.length > 0 || heroUsageLoading) && (
        <section className="shop-panel__sec">
          <h3>{t('itemsPage.topHeroes')}</h3>
          <ul className="shop-heroes" aria-busy={heroUsageLoading}>
            {heroes.length > 0
              ? heroes.map(({ entry, hero }) => (
                <li key={hero.id}>
                  <Link
                    to={`/hero/${hero.id}`}
                    className="shop-hero"
                    title={`${hero.name} · ${formatWinrate(entry.winrate)} · ${formatNumber(entry.matches, language)} ${t('itemPage.matchesShort')}`}
                  >
                    <HeroIcon hero={hero} size="md" />
                  </Link>
                </li>
              ))
              : Array.from({ length: TOP_HEROES }, (_, index) => <li key={index} className="shop-hero shop-hero--blank" aria-hidden="true" />)}
          </ul>
        </section>
      )}

      <Link to={`/items/${item.id}`} className="shop-panel__open">{t('itemsPage.openItem')}</Link>
    </aside>
  );
}

export default ItemPanel;
