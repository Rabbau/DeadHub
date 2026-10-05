import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAllItems } from '../api/index.js';
import ItemPanel from '../components/items/ItemPanel';
import ItemsGrid from '../components/items/ItemsGrid';
import ItemsToolbar from '../components/items/ItemsToolbar';
import ShopView from '../components/items/ShopView';
import TierTabs from '../components/items/TierTabs';
import SkeletonGrid from '../components/ui/SkeletonGrid';
import { useHeroes } from '../hooks/useHeroes';
import { useItemHeroUsage } from '../hooks/useItemHeroUsage';
import { useItemStatsTable } from '../hooks/useItemStatsTable';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePageMeta } from '../hooks/usePageMeta';
import { useScrollSpy } from '../hooks/useScrollSpy';
import { useStatsFilters } from '../hooks/useStatsFilters';
import { useStoredChoice } from '../hooks/useStoredChoice';
import { useTranslation } from '../hooks/useTranslation';
import { formatShortDate } from '../services/format';
import { summarizeFilters } from '../services/homeService';
import { buildItemGraph, filterItems, getPriceTierKey, isAvailableItem } from '../services/itemService';
import { OPEN_TIERS, SHOP_TIERS, buildShop, countBySlot, firstShopItem, groupByTier, tierSummary } from '../services/shopService';
import { useHeroStore } from '../store/heroStore';

// Таблица со статистикой нужна только тем, кто её открыл, — её код грузится отдельным файлом
const ItemsTable = lazy(() => import('../components/ui/ItemsTable'));

const VIEWS = ['shop', 'grid', 'table'];
const VIEW_KEYS = { shop: 'itemsPage.viewShop', grid: 'itemsPage.viewGrid', table: 'itemsPage.viewTable' };

// От этой ширины панель выбранного предмета приклеена справа от магазина; на более узком экране — выезжает снизу
const WIDE_QUERY = '(min-width: 1000px)';

const DEFAULT_FILTERS = { search: '', slot: 'all', kind: 'all', corruptible: false, showDisabled: false, sort: 'name' };

// Какие разделы магазина раскрыты, пока посетитель ничего не трогал: дешёвые тиры и отключённые предметы
const initialOpen = () => ({ ...Object.fromEntries(SHOP_TIERS.map((key) => [key, OPEN_TIERS.includes(key)])), indev: true });

const tierAnchor = (key) => `items-tier-${key}`;

function ItemsPage() {
  const language = useHeroStore((state) => state.language);
  const patch = useHeroStore((state) => state.patch);
  const t = useTranslation();
  usePageMeta('items');
  const [params] = useSearchParams();
  const { allHeroes } = useHeroes();
  const { filters: statsFilters, ready: statsReady } = useStatsFilters();

  const [view, setView] = useStoredChoice('dlhub_items_view_v2', VIEWS, 'shop');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Ссылка со страницы обновления (?corruptible=1) сразу открывает список предметов, которые меняет Broker
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, corruptible: params.get('corruptible') === '1' }));
  const [tierFilter, setTierFilter] = useState(null); // только в таблице: вкладки тиров там — фильтр
  const [open, setOpen] = useState(initialOpen);
  const [expandedColumns, setExpandedColumns] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef(null);
  const wide = useMediaQuery(WIDE_QUERY);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAllItems(language)
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [language]);

  // «/» на этой странице ведёт в поиск по предметам, а не в общий поиск сайта (он остаётся на кнопке в шапке и Ctrl+K).
  // Слушатель стоит на окне и срабатывает раньше слушателя общего поиска на document.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (typing || !searchRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      searchRef.current.focus();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // ── Что показываем ──
  const stats = useMemo(() => {
    const available = items.filter(isAvailableItem);
    return {
      available: available.length,
      corruptible: available.filter((item) => item.corruptible).length,
      disabled: items.length - available.length,
    };
  }, [items]);

  // Отключённые предметы нужны только магазину и сетке: в таблице у них нет статистики
  const pool = useMemo(() => (filters.showDisabled && view !== 'table' ? items : items.filter(isAvailableItem)), [items, filters.showDisabled, view]);
  const matched = useMemo(
    () => filterItems(pool, { search: filters.search, kind: filters.kind, corruptible: filters.corruptible }),
    [pool, filters.search, filters.kind, filters.corruptible],
  );
  const filtered = useMemo(
    () => (filters.slot === 'all' ? matched : matched.filter((item) => item.item_slot_type === filters.slot)),
    [matched, filters.slot],
  );
  const slotCounts = useMemo(() => countBySlot(matched), [matched]);
  const tiers = useMemo(() => tierSummary(filtered), [filtered]);

  // ── Статистика: нужна панели магазина, сортировке по цифрам и таблице; иначе запросов к API нет ──
  const selectedItem = useMemo(() => (selectedId == null ? null : items.find((item) => item.id === selectedId) ?? null), [items, selectedId]);
  const panelWanted = view === 'shop' && (wide || (sheetOpen && selectedItem != null));
  const needStats = view === 'table' || panelWanted || filters.sort !== 'name';
  const { statsById, loading: statsLoading } = useItemStatsTable(null, { enabled: needStats });

  const heroIds = useMemo(() => allHeroes.filter((hero) => hero.released).map((hero) => hero.id), [allHeroes]);
  const heroById = useMemo(() => new Map(allHeroes.map((hero) => [hero.id, hero])), [allHeroes]);
  // Доля покупок — от всех пиков героев за выбранный период, как в таблице
  const base = useMemo(() => allHeroes.reduce((sum, hero) => sum + hero.stats.games_played, 0), [allHeroes]);

  // Порядок предметов: по алфавиту или по цифрам (пока цифры не пришли — по алфавиту)
  const shop = useMemo(
    () => (view === 'shop' ? buildShop(filtered, { sort: filters.sort, language, statsById, base }) : null),
    [view, filtered, filters.sort, language, statsById, base],
  );
  const groups = useMemo(
    () => (view === 'grid' ? groupByTier(filtered, { sort: filters.sort, language, statsById, base }) : []),
    [view, filtered, filters.sort, language, statsById, base],
  );
  const tableItems = useMemo(
    () => (view === 'table' && tierFilter ? filtered.filter((item) => getPriceTierKey(item.cost) === tierFilter) : filtered),
    [view, filtered, tierFilter],
  );

  // ── Панель выбранного предмета ──
  const graph = useMemo(() => buildItemGraph(items), [items]);
  const panelItem = selectedItem ?? (view === 'shop' && wide && shop ? firstShopItem(shop) : null);
  const showPanel = view === 'shop' && filtered.length > 0 && panelItem != null && (wide || sheetOpen);
  const { usage: heroUsage, loading: heroUsageLoading } = useItemHeroUsage(panelItem?.id ?? null, heroIds, showPanel);
  const panelStat = panelItem ? statsById?.[panelItem.id] ?? null : null;
  const panelUsage = panelStat && base > 0 ? panelStat.matches / base : null;

  // ── Вкладки тиров: в магазине и сетке подсвечен раздел, который сейчас на экране ──
  const spyIds = useMemo(() => (view === 'table' ? [] : tiers.filter((tier) => tier.count > 0).map((tier) => tierAnchor(tier.key))), [view, tiers]);
  const spyActive = useScrollSpy(spyIds);
  const firstTier = tiers.find((tier) => tier.count > 0)?.key ?? null;
  const activeTier = view === 'table' ? tierFilter : (spyActive?.replace('items-tier-', '') ?? firstTier);

  // ── Действия ──
  const patchFilters = useCallback((change) => setFilters((prev) => ({ ...prev, ...change })), []);
  const resetFilters = () => { setFilters(DEFAULT_FILTERS); setTierFilter(null); };
  const selectItem = useCallback((id) => { setSelectedId(id); setSheetOpen(true); }, []);
  const toggleTier = useCallback((key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] })), []);
  const expandColumn = useCallback((key) => setExpandedColumns((prev) => new Set(prev).add(key)), []);

  const pickTier = (key) => {
    if (view === 'table') {
      setTierFilter((prev) => (prev === key ? null : key));
      return;
    }
    setOpen((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Раздел мог быть свёрнут: прокручиваем на следующем кадре, когда он уже раскрыт
    requestAnimationFrame(() => document.getElementById(tierAnchor(key))?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }));
  };

  const showFilters = () => {
    setView('table');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // На узком экране панель выезжает снизу и закрывается Esc
  useEffect(() => {
    if (wide || !sheetOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [wide, sheetOpen]);

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{t('itemsPage.title')}</h1>
        </div>
        <SkeletonGrid type="item" count={18} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-center state-error">
        {t('common.error')}: {error}
      </div>
    );
  }

  const empty = filtered.length === 0;

  return (
    <div className="page items-page">
      <header className="items-head">
        <div>
          <h1 className="page-title">{t('itemsPage.title')}</h1>
          <p className="items-head__sub">
            <span>{t.plural('itemsPage.inShop', stats.available)}</span>
            {patch && (
              <>
                <i aria-hidden="true">·</i>
                <span>{t('itemsPage.patchOf', { date: formatShortDate(patch.at, language) })}</span>
              </>
            )}
            {stats.corruptible > 0 && (
              <>
                <i aria-hidden="true">·</i>
                <button
                  type="button"
                  className="items-head__link"
                  aria-pressed={filters.corruptible}
                  title={t('itemsPage.corruptibleHint')}
                  onClick={() => patchFilters({ corruptible: !filters.corruptible })}
                >
                  {t('itemsPage.withCorrupted', { count: stats.corruptible })}
                </button>
              </>
            )}
          </p>
        </div>

        <div className="items-views" role="group" aria-label={t('itemsPage.viewLabel')}>
          {VIEWS.map((id) => (
            <button
              key={id}
              type="button"
              className={view === id ? 'is-on' : undefined}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {t(VIEW_KEYS[id])}
            </button>
          ))}
        </div>
      </header>

      <ItemsToolbar
        value={filters}
        onChange={patchFilters}
        slotCounts={slotCounts}
        corruptibleCount={stats.corruptible}
        disabledCount={view === 'table' ? 0 : stats.disabled}
        showSort={view !== 'table'}
        searchRef={searchRef}
      />

      <TierTabs summary={tiers} active={activeTier} mode={view === 'table' ? 'filter' : 'jump'} onPick={pickTier} />

      {empty && (
        <div className="items-empty" role="status">
          <p>{t('itemsPage.noResults')}</p>
          <button type="button" className="btn btn-secondary" onClick={resetFilters}>{t('itemsPage.resetFilters')}</button>
        </div>
      )}

      {!empty && view === 'shop' && shop && (
        <div className="shop-layout">
          <ShopView
            shop={shop}
            open={open}
            expandedColumns={expandedColumns}
            forceAll={Boolean(filters.search.trim())}
            selectedId={panelItem?.id ?? null}
            onSelect={selectItem}
            onToggleTier={toggleTier}
            onExpandColumn={expandColumn}
          />
          {showPanel && (
            <ItemPanel
              item={panelItem}
              graph={graph}
              stat={panelStat}
              usage={panelUsage}
              statsLoading={statsLoading}
              basis={statsReady ? summarizeFilters(statsFilters, t) : ''}
              heroUsage={heroUsage}
              heroUsageLoading={heroUsageLoading}
              heroById={heroById}
              onSelect={selectItem}
              onClose={() => setSheetOpen(false)}
              onChangeFilters={showFilters}
              sheet={!wide}
            />
          )}
        </div>
      )}

      {!empty && view === 'grid' && <ItemsGrid groups={groups} />}

      {!empty && view === 'table' && (
        // В таблице только то, что продаётся: у отключённых предметов статистики нет
        <Suspense fallback={<SkeletonGrid type="item" count={12} />}>
          <ItemsTable items={tableItems} />
        </Suspense>
      )}
    </div>
  );
}

export default ItemsPage;
