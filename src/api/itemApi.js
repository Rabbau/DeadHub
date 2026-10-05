import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE } from './config.js';

const ITEMS_TTL_MS = 6 * 60 * 60 * 1000; // справочник меняется только вместе со сборкой игры

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Описание без картинок: в тексте предмета встречаются значки-иконки (inline SVG), на весь список их набирается около
 * 100 КБ, а сайт показывает из описания только текст.
 */
function stripSvg(html) {
  return typeof html === 'string' ? html.replace(/<svg[\s\S]*?<\/svg>/gi, '') : null;
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
    description: raw.description
      ? {
          desc: stripSvg(raw.description.desc),
          quip: raw.description.quip ?? null,
          // Предметы с отдельным текстом для активной и пассивной части (их мало)
          active: stripSvg(raw.description.active),
          passive: stripSvg(raw.description.passive),
        }
      : null,
    // class_name и component_items связывают предметы: из каких собирается и во что улучшается
    class_name: nonEmptyString(raw.class_name),
    component_items: Array.isArray(raw.component_items) ? raw.component_items.filter((name) => typeof name === 'string') : [],
    // Активный предмет применяют кнопкой, пассивный работает сам
    is_active_item: raw.is_active_item === true,
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
    cacheKey: `items_upgrades_v2_${language}`,
    ttl: ITEMS_TTL_MS,
    transform: slimUpgrades,
  });
}

export async function fetchItemById(id, language = 'english') {
  const items = await fetchAllItems(language);
  return items.find((item) => item.id === Number(id)) ?? null;
}
