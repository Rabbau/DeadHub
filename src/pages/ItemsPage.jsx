import { useState, useEffect } from 'react';
import { fetchAllItems } from '../api/index.js';
import ItemCard from '../components/ui/ItemCard';

function ItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllItems()
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="state-center">
        <div className="spinner" />
        <span>Загрузка предметов...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-center state-error">
        ⚠️ Ошибка: {error}
      </div>
    );
  }

  const groups = {
    t1: { label: 'T1 (≤ 800)', items: [] },
    t2: { label: 'T2 (801–1600)', items: [] },
    t3: { label: 'T3 (1601–3200)', items: [] },
    t4: { label: 'T4 (3201–6400)', items: [] },
    t5: { label: 'T5 (> 6400)', items: [] },
    indev: { label: 'InDev (скрытые)', items: [] },
  };

  items.forEach(item => {
    const hasUnderscore = item.name && item.name.includes('_');
    const hasValidCost = item.cost !== null && item.cost !== undefined && item.cost !== 9999;

    if (hasUnderscore && hasValidCost) {
      groups.indev.items.push(item);
      return;
    }
    if (hasUnderscore) return;
    if (!hasValidCost) return;

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
        <h1 className="page-title">Все <em>предметы</em></h1>
        <span className="count-badge">{items.length} предметов</span>
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