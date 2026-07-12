import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE } from './config.js';

function normalizeItem(raw) {
  let imageUrl = null;

  if (raw.shop_image && typeof raw.shop_image === 'string' && raw.shop_image.trim() !== '') {
    imageUrl = raw.shop_image;
  }
  else if (raw.image && typeof raw.image === 'string' && raw.image.trim() !== '') {
    imageUrl = raw.image;
  }

  return {
    id: raw.id ?? raw.item_id,
    name: raw.name ?? `Item ${raw.id}`,
    description: raw.description ?? null,
    category: raw.tier_name ?? raw.type ?? raw.category ?? null,
    cost: raw.cost ?? raw.item_cost ?? null,
    image_url: imageUrl,
    shop_image: raw.shop_image ?? null,
    image: raw.image ?? null,
    winrate: raw.win_rate ?? raw.winrate ?? null,
    pickrate: raw.purchase_rate ?? raw.pickrate ?? null,
    type: raw.type ?? null,
    slot_type: raw.slot_type ?? raw.item_slot_type ?? null,
    item_slot_type: raw.item_slot_type ?? raw.slot_type ?? null,
    item_tier: raw.item_tier ?? null,
    tooltip_sections: raw.tooltip_sections ?? null,
    properties: raw.properties ?? null,
  };
}

function isValidItem(item) {
  if (item.cost === 9999 || item.cost === null) return false;
  if (item.name && item.name.includes('_')) return false;
  if (!item.type) return false;
  return true;
}

export async function fetchItems(language = 'english') {
  const data = await httpGet(`${ASSETS_API_BASE}/v1/assets/items?language=${language}`, {
    cacheKey: `items_all_${language}`,
  });
  const list = Array.isArray(data) ? data : data.data ?? data.items ?? [];
  return list.map(normalizeItem).filter(isValidItem);
}

export async function fetchBuyableItems(language = 'english') {
  const allItems = await fetchItems(language);
  return allItems.filter(item => item.type === 'upgrade');
}

export async function fetchItemsBySlot(slotType, language = 'english') {
  try {
    const data = await httpGet(`${ASSETS_API_BASE}/v1/assets/items/by-slot-type/${slotType}?language=${language}`, {
      cacheKey: `items_slot_${slotType}_${language}`,
    });
    const list = Array.isArray(data) ? data : data.data ?? data.items ?? [];
    return list.map(normalizeItem).filter(isValidItem);
  } catch {
    return [];
  }
}

export async function fetchItemsByHero(heroId, language = 'english') {
  try {
    const allItems = await fetchBuyableItems(language);
    const shuffled = [...allItems].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  } catch {
    return [];
  }
}

export async function fetchAllItems(language = 'english') {
  const data = await httpGet(`${ASSETS_API_BASE}/v1/assets/items?language=${language}`, {
    cacheKey: `items_all_raw_${language}`,
  });
  const list = Array.isArray(data) ? data : data.data ?? data.items ?? [];
  return list
    .map(normalizeItem)
    .filter(item => item.type === 'upgrade');
}

export async function fetchItemById(id, language = 'english') {
  const items = await fetchAllItems(language);
  return items.find(item => item.id === Number(id)) ?? null;
}