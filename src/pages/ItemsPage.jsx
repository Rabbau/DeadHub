import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllItems } from '../api/index.js';
import ItemCard from '../components/ui/ItemCard';
import { useHeroStore } from '../store/heroStore';
import { useTranslation } from '../hooks/useTranslation';
import SkeletonGrid from '../components/ui/SkeletonGrid';
import { filterItems, groupItemsByPrice } from '../services/itemService';

function ItemsPage() {
  const language = useHeroStore(state => state.language);
  const t = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [slot, setSlot] = useState('all');
  const [priceTier, setPriceTier] = useState('all');

  useEffect(() => {
    setLoading(true);
    fetchAllItems(language)
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [language]);

  const filtered = useMemo(
    () => filterItems(items, { search, slot, priceTier }),
    [items, search, slot, priceTier],
  );

  const groups = useMemo(
    () => groupItemsByPrice(filtered, {
      t1: t('itemsPage.t1'),
      t2: t('itemsPage.t2'),
      t3: t('itemsPage.t3'),
      t4: t('itemsPage.t4'),
      t5: t('itemsPage.t5'),
      indev: t('itemsPage.indev'),
    }),
    [filtered, t],
  );

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
        ⚠️ {t('common.error')}: {error}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('itemsPage.title')}</h1>
        <span className="count-badge">{filtered.length} / {items.length} {t('itemsPage.count')}</span>
      </div>

      <div className="filters">
        <div className="filters__search">
          <span className="filters__search-icon">🔍</span>
          <input
            type="text"
            className="input"
            placeholder={t('itemsPage.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="select" value={slot} onChange={e => setSlot(e.target.value)}>
          <option value="all">{t('itemsPage.allSlots')}</option>
          <option value="weapon">{t('itemCard.slotWeapon')}</option>
          <option value="spirit">{t('itemCard.slotSpirit')}</option>
          <option value="vitality">{t('itemCard.slotVitality')}</option>
        </select>

        <select className="select" value={priceTier} onChange={e => setPriceTier(e.target.value)}>
          <option value="all">{t('itemsPage.allPrices')}</option>
          <option value="t1">{t('itemsPage.t1')}</option>
          <option value="t2">{t('itemsPage.t2')}</option>
          <option value="t3">{t('itemsPage.t3')}</option>
          <option value="t4">{t('itemsPage.t4')}</option>
          <option value="t5">{t('itemsPage.t5')}</option>
        </select>
      </div>

      {filtered.length === 0 && (
        <p className="state-center" style={{ color: 'var(--text-2)', marginTop: '2rem' }}>
          {t('itemsPage.noResults')}
        </p>
      )}

      {Object.entries(groups).map(([key, group]) => (
        group.items.length > 0 && (
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
        )
      ))}
    </div>
  );
}

export default ItemsPage;
