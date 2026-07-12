export const SLOT_TYPES = ['weapon', 'spirit', 'vitality'];

export const PRICE_TIERS = [
  { key: 'all', min: 0, max: Infinity },
  { key: 't1', min: 0, max: 800 },
  { key: 't2', min: 801, max: 1600 },
  { key: 't3', min: 1601, max: 3200 },
  { key: 't4', min: 3201, max: 6400 },
  { key: 't5', min: 6401, max: Infinity },
];

export function isIndevItem(item) {
  const hasUnderscore = item.name && item.name.includes('_');
  const isInvalidCost = item.cost === 9999 || item.cost == null;
  const hasShopImage = item.shop_image && item.shop_image.trim() !== '';
  return !hasShopImage || isInvalidCost || hasUnderscore;
}

export function getPriceTierKey(cost) {
  if (cost == null) return 'indev';
  if (cost <= 800) return 't1';
  if (cost <= 1600) return 't2';
  if (cost <= 3200) return 't3';
  if (cost <= 6400) return 't4';
  return 't5';
}

export function filterItems(items, { search = '', slot = 'all', priceTier = 'all' } = {}) {
  let result = [...items];

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(item => item.name?.toLowerCase().includes(q));
  }

  if (slot && slot !== 'all') {
    result = result.filter(item => item.item_slot_type === slot);
  }

  if (priceTier && priceTier !== 'all') {
    const tier = PRICE_TIERS.find(t => t.key === priceTier);
    if (tier) {
      result = result.filter(item => {
        const cost = item.cost ?? 0;
        return cost >= tier.min && cost <= tier.max;
      });
    }
  }

  return result;
}

export function groupItemsByPrice(items, labels) {
  const groups = {
    t1: { label: labels.t1, items: [] },
    t2: { label: labels.t2, items: [] },
    t3: { label: labels.t3, items: [] },
    t4: { label: labels.t4, items: [] },
    t5: { label: labels.t5, items: [] },
    indev: { label: labels.indev, items: [] },
  };

  items.forEach(item => {
    if (isIndevItem(item)) {
      groups.indev.items.push(item);
      return;
    }
    const key = getPriceTierKey(item.cost);
    groups[key].items.push(item);
  });

  Object.values(groups).forEach(group => {
    group.items.sort((a, b) => (a.cost || 0) - (b.cost || 0));
  });

  return groups;
}

export function pickUniqueRandom(items, count) {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
