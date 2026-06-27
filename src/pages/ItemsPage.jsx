import { useState, useEffect } from 'react';
import { fetchAllItems } from '../api/index.js';
import ItemCard from '../components/ui/ItemCard';
import { useHeroStore } from '../store/heroStore';
import { useTranslation } from '../hooks/useTranslation';

function ItemsPage() {
  const language = useHeroStore(state => state.language);
  const t = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="state-center">
        <div className="spinner" />
        <span>{t('common.loading')}</span>
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

  const groups = {
    t1: { label: t('itemsPage.t1'), items: [] },
    t2: { label: t('itemsPage.t2'), items: [] },
    t3: { label: t('itemsPage.t3'), items: [] },
    t4: { label: t('itemsPage.t4'), items: [] },
    t5: { label: t('itemsPage.t5'), items: [] },
    indev: { label: t('itemsPage.indev'), items: [] },
  };

  items.forEach(item => {
    const hasUnderscore = item.name && item.name.includes('_');
    const isInvalidCost = item.cost === 9999 || item.cost === null || item.cost === undefined;
    const hasShopImage = item.shop_image && item.shop_image.trim() !== '';

    if (!hasShopImage || isInvalidCost || hasUnderscore) {
      groups.indev.items.push(item);
      return;
    }

    const cost = item.cost;
    if (cost <= 800) groups.t1.items.push(item);
    else if (cost <= 1600) groups.t2.items.push(item);
    else if (cost <= 3200) groups.t3.items.push(item);
    else if (cost <= 6400) groups.t4.items.push(item);
    else groups.t5.items.push(item);
  });

  Object.values(groups).forEach(group => {
    group.items.sort((a, b) => (a.cost || 0) - (b.cost || 0));
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('itemsPage.title')}</h1>
        <span className="count-badge">{items.length} {t('itemsPage.count')}</span>
      </div>

      {Object.entries(groups).map(([key, group]) => (
        group.items.length > 0 && (
          <div className="section" key={key}>
            <h2 className="section__title">{group.label} ({group.items.length})</h2>
            <div className="items-grid">
              {group.items.map(item => <ItemCard key={item.id} item={item} />)}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

export default ItemsPage;