import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE } from './config.js';

const ITEM_IMG_BASE = 'https://assets.deadlock-api.com/images/items';

function normalizeItem(raw) {
  let imageUrl = null;

  // 1️⃣ ПРИОРИТЕТ: shop_image — цветная иконка из магазина
  if (raw.shop_image) {
    if (raw.shop_image.startsWith('http://') || raw.shop_image.startsWith('https://')) {
      imageUrl = raw.shop_image;
    } else {
      // Если относительный путь — добавляем базовый URL
      imageUrl = `${ITEM_IMG_BASE}/${raw.shop_image}`;
    }
  }

  // 2️⃣ Если нет shop_image, пробуем image
  if (!imageUrl && raw.image) {
    if (raw.image.startsWith('http://') || raw.image.startsWith('https://')) {
      imageUrl = raw.image;
    } else {
      imageUrl = `${ITEM_IMG_BASE}/${raw.image}`;
    }
  }

  // 3️⃣ Если ничего нет — пробуем images.icon_image_small
  if (!imageUrl && raw.images && typeof raw.images === 'object') {
    const icon = raw.images.icon_image_small ?? raw.images.icon_image ?? null;
    if (icon) {
      if (icon.startsWith('http://') || icon.startsWith('https://')) {
        imageUrl = icon;
      } else {
        imageUrl = `${ITEM_IMG_BASE}/${icon}`;
      }
    }
  }

  return {
    id: raw.id ?? raw.item_id,
    name: raw.name ?? `Item ${raw.id}`,
    description: raw.description ?? null,
    category: raw.tier_name ?? raw.type ?? raw.category ?? null,
    cost: raw.cost ?? raw.item_cost ?? null,
    image_url: imageUrl,
    shop_image: raw.shop_image ?? null, // сохраняем на всякий случай
    winrate: raw.win_rate ?? raw.winrate ?? null,
    pickrate: raw.purchase_rate ?? raw.pickrate ?? null,
    type: raw.type ?? null,
    slot_type: raw.slot_type ?? raw.item_slot_type ?? null,
  };
}

// Фильтр для "чистых" предметов
function isValidItem(item) {
  if (item.cost === 9999 || item.cost === null) return false;
  if (item.name && item.name.includes('_')) return false;
  if (!item.type) return false;
  return true;
}

export async function fetchItems() {
  const data = await httpGet(`${ASSETS_API_BASE}/v2/items`, {
    cacheKey: 'items_all_v2',
  });
  const list = Array.isArray(data) ? data : data.data ?? data.items ?? [];
  return list.map(normalizeItem).filter(isValidItem);
}

export async function fetchBuyableItems() {
  const allItems = await fetchItems();
  return allItems.filter(item => item.type === 'upgrade');
}

export async function fetchItemsBySlot(slotType) {
  try {
    const data = await httpGet(`${ASSETS_API_BASE}/v2/items/by-slot-type/${slotType}`, {
      cacheKey: `items_slot_${slotType}`,
    });
    const list = Array.isArray(data) ? data : data.data ?? data.items ?? [];
    return list.map(normalizeItem).filter(isValidItem);
  } catch {
    return [];
  }
}

export async function fetchItemsByHero(heroId) {
  try {
    const allItems = await fetchBuyableItems();
    const shuffled = [...allItems].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  } catch {
    return [];
  }
}

export async function fetchAllItems() {
  const data = await httpGet(`${ASSETS_API_BASE}/v2/items`, {
    cacheKey: 'items_all_raw',
  });
  const list = Array.isArray(data) ? data : data.data ?? data.items ?? [];
  return list.map(normalizeItem);
}