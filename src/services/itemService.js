export const SLOT_TYPES = ['weapon', 'spirit', 'vitality'];

// Цены тиров: T1 800, T2 1600, T3 3200, T4 6400. T5 — легендарные предметы, их цена в данных 9999.
export const PRICE_TIERS = [
  { key: 'all', min: 0, max: Infinity },
  { key: 't1', min: 0, max: 800 },
  { key: 't2', min: 801, max: 1600 },
  { key: 't3', min: 1601, max: 3200 },
  { key: 't4', min: 3201, max: 6400 },
  { key: 't5', min: 6401, max: Infinity },
];

/**
 * Предмет реально продаётся: включён, виден в магазине, у него есть цена, название и картинка.
 * Цена 9999 — это нормально: так в данных записаны легендарные предметы (раньше сайт считал её заглушкой).
 */
export function isAvailableItem(item) {
  const hasName = Boolean(item.name) && !item.name.includes('_'); // «upgrade_xxx» — служебные заготовки
  const hasShopImage = Boolean(item.shop_image) && item.shop_image.trim() !== '';
  return item.shopable !== false && item.disabled !== true && item.cost != null && hasName && hasShopImage;
}

/** Всё, что не продаётся: отключённые предметы и служебные заготовки. */
export function isIndevItem(item) {
  return !isAvailableItem(item);
}

export function getPriceTierKey(cost) {
  if (cost == null) return 'indev';
  if (cost <= 800) return 't1';
  if (cost <= 1600) return 't2';
  if (cost <= 3200) return 't3';
  if (cost <= 6400) return 't4';
  return 't5';
}

/** Тип предмета: активный применяют кнопкой, пассивный работает сам. */
export function itemKind(item) {
  return item.is_active_item === true ? 'active' : 'passive';
}

/** Текст без разметки. Описания приходят с <span> и <br>; обходимся без DOM, чтобы работало и в тестах. */
export function stripTags(html) {
  if (!html) return '';
  const entities = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
  return String(html)
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, name) => entities[name])
    .replace(/\s+/g, ' ')
    .trim();
}

function formatPropertyValue(prop) {
  if (!prop || prop.value === undefined) return null;
  const num = parseFloat(prop.value);
  if (isNaN(num) || num === 0) return null;

  const sign = prop.prefix === '{s:sign}' && num > 0 ? '+' : '';
  const postfix = prop.postfix || '';
  // Расстояния приходят как «10m» (метры), и обычно единица стоит ещё и в postfix (« м»): оставляем её одну.
  // Без postfix метры остаются в самом значении.
  const value = postfix ? String(prop.value).replace(/^(-?\d+(?:\.\d+)?)m$/, '$1') : String(prop.value);
  return {
    label: prop.label || '',
    text: `${sign}${value}${postfix}`,
  };
}

/**
 * Строки характеристик предмета в порядке тултипа: подпись, значение и признак «главной» (elevated) характеристики.
 * @param {object} item
 * @returns {Array<{ label: string, text: string, elevated: boolean }>}
 */
export function getItemStats(item) {
  const sections = item.tooltip_sections;
  if (!sections || !Array.isArray(sections)) return [];

  const stats = [];
  const seen = new Set();

  sections.forEach(section => {
    (section.section_attributes || []).forEach(attr => {
      const allKeys = [
        ...(attr.properties || []),
        ...(attr.elevated_properties || []),
      ];
      allKeys.forEach(key => {
        if (seen.has(key)) return;
        seen.add(key);
        const prop = item.properties?.[key];
        const formatted = formatPropertyValue(prop);
        if (formatted) {
          stats.push({
            ...formatted,
            elevated: (attr.elevated_properties || []).includes(key),
          });
        }
      });
    });
  });

  return stats;
}

// «Ё» и «е» в поиске не различаем: так пишет большинство
const foldText = (text) => text.toLowerCase().replace(/ё/g, 'е');

// Текст для поиска считается один раз на предмет: название, описание и подписи характеристик
const searchTexts = new WeakMap();

function searchTextOf(item) {
  let text = searchTexts.get(item);
  if (text === undefined) {
    const description = item.description;
    text = foldText([
      item.name,
      stripTags(description?.desc),
      stripTags(description?.active),
      stripTags(description?.passive),
      ...getItemStats(item).map(stat => stat.label),
    ].filter(Boolean).join(' '));
    searchTexts.set(item, text);
  }
  return text;
}

// Слово короче этого ищется только в названии: по одной-двум буквам совпадёт полтекста описаний
const MIN_EFFECT_WORD = 3;

// У слов от шести букв отбрасываем два последних: так «лечения» находит «лечение», а «здоровья» — «здоровье»
const STEM_FROM = 6;
const STEM_CUT = 2;
const stemOf = (word) => (word.length >= STEM_FROM ? word.slice(0, -STEM_CUT) : word);

/**
 * Подходит ли предмет под запрос: каждое слово запроса должно встретиться в названии, а слова от трёх букв —
 * ещё и в описании и подписях характеристик («лечение», «замедление»). Окончания длинных слов не важны.
 */
export function matchesSearch(item, query) {
  const words = foldText(String(query ?? '')).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const name = foldText(item.name ?? '');
  return words.every(word => (word.length >= MIN_EFFECT_WORD ? searchTextOf(item) : name).includes(stemOf(word)));
}

export function filterItems(items, { search = '', slot = 'all', priceTier = 'all', corruptible = false, kind = 'all' } = {}) {
  let result = [...items];

  if (search.trim()) {
    result = result.filter(item => matchesSearch(item, search));
  }

  if (slot && slot !== 'all') {
    result = result.filter(item => item.item_slot_type === slot);
  }

  if (kind && kind !== 'all') {
    result = result.filter(item => itemKind(item) === kind);
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

  if (corruptible) {
    result = result.filter(item => item.corruptible);
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
    group.items.sort((a, b) => (a.cost || 0) - (b.cost || 0) || a.name.localeCompare(b.name));
  });

  return groups;
}

/**
 * Связи между предметами. component_items у предмета — class_name тех, из кого он собирается; обратная связь
 * («во что улучшается») считается здесь. Учитываются только продающиеся предметы.
 * @param {object[]} items
 * @returns {{ components: (item: object) => object[], upgradesInto: (item: object) => object[] }}
 */
export function buildItemGraph(items) {
  const byClass = new Map();
  items.forEach(item => { if (item.class_name && isAvailableItem(item)) byClass.set(item.class_name, item); });

  const order = (a, b) => (a.cost ?? 0) - (b.cost ?? 0) || a.name.localeCompare(b.name);
  const into = new Map();
  items.forEach(item => {
    if (!isAvailableItem(item)) return;
    (item.component_items || []).forEach(className => {
      const base = byClass.get(className);
      if (!base) return;
      if (!into.has(base.id)) into.set(base.id, []);
      into.get(base.id).push(item);
    });
  });
  into.forEach(list => list.sort(order));

  return {
    components: item => (item.component_items || []).map(className => byClass.get(className)).filter(Boolean).sort(order),
    upgradesInto: item => into.get(item.id) ?? [],
  };
}

export function pickUniqueRandom(items, count) {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
