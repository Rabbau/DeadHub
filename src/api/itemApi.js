import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE } from './config.js';

const ITEMS_TTL_MS = 6 * 60 * 60 * 1000; // справочник меняется только вместе со сборкой игры

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Ключи свойств, на которые ссылается тултип предмета: остальные поля свойств сайту не нужны. */
function referencedPropertyKeys(sections) {
  const keys = new Set();
  (sections || []).forEach((section) => {
    (section.section_attributes || []).forEach((attr) => {
      [...(attr.properties || []), ...(attr.elevated_properties || [])].forEach((key) => keys.add(key));
    });
  });
  return keys;
}

/**
 * Предмет в том виде, в котором он нужен сайту и хранится в кеше.
 * Сырой ответ API — 5,7 МБ на 729 записей (способности и оружие тоже), после облегчения — сотни КБ.
 */
function slimItem(raw) {
  const sections = Array.isArray(raw.tooltip_sections) ? raw.tooltip_sections : null;
  const properties = {};
  referencedPropertyKeys(sections).forEach((key) => {
    const prop = raw.properties?.[key];
    if (prop) properties[key] = { value: prop.value, label: prop.label, prefix: prop.prefix, postfix: prop.postfix };
  });

  const shopImage = nonEmptyString(raw.shop_image);
  return {
    id: raw.id,
    name: raw.name ?? `Item ${raw.id}`,
    description: raw.description ? { desc: raw.description.desc ?? null, quip: raw.description.quip ?? null } : null,
    cost: raw.cost ?? null,
    image_url: shopImage ?? nonEmptyString(raw.image),
    shop_image: shopImage,
    type: raw.type ?? null,
    item_slot_type: raw.item_slot_type ?? null,
    item_tier: raw.item_tier ?? null,
    tooltip_sections: sections
      ? sections.map((section) => ({
          section_attributes: (section.section_attributes || []).map((attr) => ({
            properties: attr.properties || [],
            elevated_properties: attr.elevated_properties || [],
          })),
        }))
      : null,
    properties,
    // Предметы, выключенные в текущей сборке, остаются в данных, но в магазине их нет
    disabled: raw.disabled === true,
    shopable: raw.shopable !== false,
    // У предмета есть «испорченная» версия — её меняет торговец Broker
    corruptible: Boolean(raw.corrupted_info),
  };
}

function slimUpgrades(data) {
  const list = Array.isArray(data) ? data : data.data ?? data.items ?? [];
  return list.filter((item) => item.type === 'upgrade').map(slimItem);
}

/**
 * Все предметы-улучшения, включая отключённые (у них disabled / shopable = false).
 * Они нужны для названий в старой статистике; в магазине показывать их надо через isAvailableItem.
 */
export function fetchAllItems(language = 'english') {
  return httpGet(`${ASSETS_API_BASE}/v1/assets/items?language=${language}`, {
    cacheKey: `items_upgrades_${language}`,
    ttl: ITEMS_TTL_MS,
    transform: slimUpgrades,
  });
}

export async function fetchItemById(id, language = 'english') {
  const items = await fetchAllItems(language);
  return items.find((item) => item.id === Number(id)) ?? null;
}
