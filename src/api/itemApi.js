import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE } from './config.js';

const IMG_BASE = 'https://assets.deadlock-api.com/images/items';

function normalizeItem(raw) {
  return {
    id: raw.id ?? raw.item_id,
    name: raw.name ?? `Item ${raw.id}`,
    description: raw.description ?? null,
    category: raw.tier_name ?? raw.type ?? raw.category ?? null,
    cost: raw.cost ?? raw.item_cost ?? null,
    image_url: raw.images?.icon_image_small ?? `${IMG_BASE}/${raw.id}.png`,
    winrate: raw.win_rate ?? raw.winrate ?? null,
    pickrate: raw.purchase_rate ?? raw.pickrate ?? null,
  };
}

export async function fetchItems() {
  const data = await httpGet(`${ASSETS_API_BASE}/v1/assets/items`, {
    cacheKey: 'items_all',
  });
  const list = Array.isArray(data) ? data : data.data ?? data.items ?? [];
  return list.map(normalizeItem);
}

export async function fetchItemsByHero(heroId) {
  try {
    const data = await httpGet(`${ASSETS_API_BASE}/v1/assets/items/by-hero-id/${heroId}`, {
      cacheKey: `items_hero_${heroId}`,
    });
    const list = Array.isArray(data) ? data : data.data ?? data.items ?? [];
    return list.slice(0, 6).map(normalizeItem);
  } catch {
    return [];
  }
}