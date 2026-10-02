import { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAllItems } from '../api/index.js';
import ItemCard from '../components/ui/ItemCard';
import { useHeroStore } from '../store/heroStore';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import SkeletonGrid from '../components/ui/SkeletonGrid';
import { useStoredChoice } from '../hooks/useStoredChoice';
import { filterItems, groupItemsByPrice, isAvailableItem } from '../services/itemService';

// Таблица со статистикой нужна только тем, кто её открыл, — её код грузится отдельным файлом
const ItemsTable = lazy(() => import('../components/ui/ItemsTable'));

const VIEWS = [
  { id: 'catalog', key: 'itemsPage.viewCatalog' },
  { id: 'table', key: 'itemsPage.viewTable' },
];

function ItemsPage() {
  const language = useHeroStore(state => state.language);
  const t = useTranslation();
  usePageMeta('items');
  const [params] = useSearchParams();
  // Каталог не требует статистики; таблица со статистикой — отдельный вид, и запросы к API идут только в нём
  const [view, setView] = useStoredChoice('dlhub_items_view', ['catalog', 'table'], 'catalog');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [slot, setSlot] = useState('all');
  const [priceTier, setPriceTier] = useState('all');
  // Ссылка со страницы обновления (?corruptible=1) сразу открывает список предметов, которые меняет Broker
  const [corruptibleOnly, setCorruptibleOnly] = useState(params.get('corruptible') === '1');
  const [showDisabled, setShowDisabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAllItems(language)
      .then(data => {
        if (cancelled) return;
        setItems(data);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [language]);

  const stats = useMemo(() => {
    const available = items.filter(isAvailableItem);
    return {
      available: available.length,
      corruptible: available.filter(item => item.corruptible).length,
      disabled: items.length - available.length,
    };
  }, [items]);

  const filtered = useMemo(
    () => filterItems(items, { search, slot, priceTier, corruptible: corruptibleOnly }),
    [items, search, slot, priceTier, corruptibleOnly],
  );

  // Подписи групп зависят только от языка, поэтому в зависимостях он, а не функция t
  const groups = useMemo(
    () => groupItemsByPrice(filtered, {
      t1: t('itemsPage.t1'),
      t2: t('itemsPage.t2'),
      t3: t('itemsPage.t3'),
      t4: t('itemsPage.t4'),
      t5: t('itemsPage.t5'),
      indev: t('itemsPage.indev'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, language],
  );

  const visibleGroups = Object.entries(groups).filter(
    ([key, group]) => group.items.length > 0 && (key !== 'indev' || showDisabled),
  );
  const shownCount = filtered.filter(isAvailableItem).length;

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

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('itemsPage.title')}</h1>
        <div className="page-header__side">
          <span className="count-badge">{shownCount} / {stats.available} {t('itemsPage.count')}</span>
          <div className="chip-group" role="group" aria-label={t('itemsPage.viewLabel')}>
            {VIEWS.map(({ id, key }) => (
              <button
                key={id}
                type="button"
                className={`chip ${view === id ? 'active' : ''}`}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="filters">
        <div className="filters__search">
          <span className="filters__search-icon" aria-hidden="true">&gt;</span>
          <input
            type="text"
            className="input"
            placeholder={t('itemsPage.searchPlaceholder')}
            aria-label={t('itemsPage.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="select" aria-label={t('itemsPage.slotFilter')} value={slot} onChange={e => setSlot(e.target.value)}>
          <option value="all">{t('itemsPage.allSlots')}</option>
          <option value="weapon">{t('itemCard.slotWeapon')}</option>
          <option value="spirit">{t('itemCard.slotSpirit')}</option>
          <option value="vitality">{t('itemCard.slotVitality')}</option>
        </select>

        <select className="select" aria-label={t('itemsPage.priceFilter')} value={priceTier} onChange={e => setPriceTier(e.target.value)}>
          <option value="all">{t('itemsPage.allPrices')}</option>
          <option value="t1">{t('itemsPage.t1')}</option>
          <option value="t2">{t('itemsPage.t2')}</option>
          <option value="t3">{t('itemsPage.t3')}</option>
          <option value="t4">{t('itemsPage.t4')}</option>
          <option value="t5">{t('itemsPage.t5')}</option>
        </select>

        <div className="chip-group">
          <button
            type="button"
            className={`chip ${corruptibleOnly ? 'active' : ''}`}
            aria-pressed={corruptibleOnly}
            title={t('itemsPage.corruptibleHint')}
            onClick={() => setCorruptibleOnly(value => !value)}
          >
            {t('itemsPage.corruptible')} ({stats.corruptible})
          </button>
          {stats.disabled > 0 && view === 'catalog' && (
            <button
              type="button"
              className={`chip ${showDisabled ? 'active' : ''}`}
              aria-pressed={showDisabled}
              onClick={() => setShowDisabled(value => !value)}
            >
              {t('itemsPage.showDisabled')} ({stats.disabled})
            </button>
          )}
        </div>
      </div>

      {view === 'table' ? (
        // В таблице только то, что продаётся: у отключённых предметов статистики нет
        <Suspense fallback={<SkeletonGrid type="item" count={12} />}>
          <ItemsTable items={filtered.filter(isAvailableItem)} />
        </Suspense>
      ) : (
        <>
          {visibleGroups.length === 0 && (
            <p className="state-center" style={{ color: 'var(--muted)', marginTop: '2rem' }}>
              {t('itemsPage.noResults')}
            </p>
          )}

          {visibleGroups.map(([key, group]) => (
            <div className="section" key={key}>
              <h2 className="section__title">{group.label} ({group.items.length})</h2>
              <div className="items-grid">
                {group.items.map(item => (
                  <Link to={`/items/${item.id}`} key={item.id} className="item-card-link">
                    <ItemCard item={item} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default ItemsPage;
