import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE, ANALYTICS_API_BASE } from './config.js';
import { DEFAULT_FILTERS, toQueryString, toStatsParams } from '../services/statsFilters.js';
import { isReleaseWindow } from '../services/releaseService.js';
import { CURRENT_UPDATE } from '../data/updates.js';

const ITEM_IMG_BASE = 'https://assets.deadlock-api.com/images/items';
const STATS_TTL_MS = 10 * 60 * 1000; // на стороне API ответы тоже кешируются на 10 минут
// Список героев меняется главным образом в момент выхода нового героя: тогда меняются его флаги и картинки.
// Вокруг релиза по расписанию Valve (минуты) список перепроверяется у сервера часто — посетитель должен
// увидеть выход героя в течение минут, а не часа. В остальное время — раз в полчаса: API бесплатный
// и с лимитом запросов, лишние проверки ему ни к чему.
const HEROES_NEAR_RELEASE_TTL_MS = 4 * 60 * 1000;
const HEROES_IDLE_TTL_MS = 30 * 60 * 1000;
const heroesTtl = () => (isReleaseWindow(CURRENT_UPDATE.releases) ? HEROES_NEAR_RELEASE_TTL_MS : HEROES_IDLE_TTL_MS);
const EMPTY_STATS = { total: 0, byHero: {} };

// Поля героя, которые сайт реально читает. Сырой список — 1,8 МБ на 65 героев, с этими полями — ~150 КБ.
const HERO_FIELDS = [
  'id', 'hero_id', 'name', 'hero_type', 'complexity', 'tags', 'gun_tag',
  'player_selectable', 'disabled', 'in_development', 'prerelease_only', 'needs_testing',
];
const HERO_IMAGE_KEYS = [
  'icon_hero_card', 'icon_image_small', 'icon_image_small_webp', 'minimap_image',
  'top_bar_vertical_image_webp', 'vote_sticker_webp',
];
const HERO_ITEM_KEYS = ['signature1', 'signature2', 'signature3', 'signature4', 'weapon_primary'];
const HERO_STAT_KEYS = [
  'max_health', 'max_move_speed', 'sprint_speed', 'stamina', 'base_health_regen', 'light_melee_damage',
  'heavy_melee_damage', 'ground_dash_distance_in_meters', 'air_dash_distance_in_meters', 'stamina_regen_per_second',
];
const LEVEL_UP_KEYS = [
  'MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL', 'MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL',
  'MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL', 'MODIFIER_VALUE_TECH_POWER',
];

/** Копия объекта только с перечисленными ключами (отсутствующие пропускаются). */
function pick(source, keys, map = (value) => value) {
  const result = {};
  if (!source || typeof source !== 'object') return result;
  keys.forEach((key) => {
    if (source[key] !== undefined && source[key] !== null) result[key] = map(source[key]);
  });
  return result;
}

function slimHero(raw) {
  const slim = pick(raw, HERO_FIELDS);
  // Лор приходит строкой или объектом { lore }: хранить достаточно текста
  slim.description = typeof raw.description === 'string' ? raw.description : raw.description?.lore ?? null;
  slim.images = pick(raw.images, HERO_IMAGE_KEYS);
  slim.items = pick(raw.items, HERO_ITEM_KEYS);
  slim.starting_stats = pick(raw.starting_stats, HERO_STAT_KEYS, (stat) => ({ value: stat?.value }));
  slim.standard_level_up_upgrades = pick(raw.standard_level_up_upgrades, LEVEL_UP_KEYS);
  slim.colors = { style_hex: raw.colors?.style_hex ?? null };
  return slim;
}

function slimHeroList(data) {
  const list = Array.isArray(data) ? data : data.data ?? data.heroes ?? [];
  return list.map(slimHero);
}

/**
 * released — играют все; upcoming — новый герой из голосования (prerelease_only), ещё не вышел;
 * hidden — заготовки в разработке и отключённые герои.
 * Флаги в assets обновляются вместе со сборкой игры и могут отставать от матчей, поэтому
 * герой с реальными матчами считается вышедшим, даже если флаги ещё не переключились.
 */
function heroStatus(heroData, games) {
  if (heroData.disabled === true || heroData.in_development === true) return 'hidden';
  if (games > 0) return 'released';
  if (heroData.prerelease_only === true) return 'upcoming';
  return heroData.player_selectable === true ? 'released' : 'hidden';
}

function capitalize(str) {
  if (!str || typeof str !== 'string') return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function fetchAbilityDetails(class_name, language = 'english') {
  try {
    const url = `${ASSETS_API_BASE}/v1/assets/items/${class_name}?language=${language}`;
    const data = await httpGet(url, { cacheKey: `ability_${class_name}_${language}` });
    return data;
  } catch (e) {
    console.warn(`Failed to fetch ability details for ${class_name}:`, e);
    return null;
  }
}

/**
 * Строка hero-stats нужна только для статистики; всё остальное берётся из assets API.
 * @param {object} heroData — герой из assets API
 * @param {{ matches: number, wins: number, kills: number, deaths: number, assists: number }|undefined} statsRow
 * @param {number} totalMatches — сумма matches по всем героям выборки (для пикрейта)
 */
function normalizeHero(heroData, statsRow, totalMatches = 0, abilitiesDetails = {}, weaponStats = {}, abilityExtras = {}) {
  const games = statsRow?.matches ?? 0;
  const winrate = games > 0 ? statsRow.wins / games : 0;
  // Пикрейт — доля героя среди всех пиков выборки (у всех героев в сумме 100%)
  const pickrate = totalMatches > 0 ? games / totalMatches : 0;
  const kda = games > 0 ? (statsRow.kills + statsRow.assists) / Math.max(1, statsRow.deaths) : null;

  const status = heroStatus(heroData, games);
  // У героев, которые ещё не вышли, в данных стоят заглушки (одинаковые 780 HP и оружие Infernus) —
  // показывать их как настоящие характеристики нельзя
  const upcoming = status === 'upcoming';

  let abilities = [];

  if (heroData.items && typeof heroData.items === 'object') {
    const entries = Object.entries(heroData.items);
    const abilityKeys = ['signature1', 'signature2', 'signature3', 'signature4'];
    const filteredEntries = entries.filter(([key]) => abilityKeys.includes(key));

    abilities = filteredEntries.map(([key, class_name]) => {
      let displayName = class_name
        .replace(/^citadel_ability_/, '')
        .replace(/^ability_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      const details = abilitiesDetails[class_name] || {};
      const image = details.image || details.shop_image || null;
      const description = details.description?.desc || details.description || '';

      let abilityImageUrl = null;
      if (image) {
        if (image.startsWith('http')) {
          abilityImageUrl = image;
        } else {
          abilityImageUrl = `${ITEM_IMG_BASE}/${image}`;
        }
      }

      // Дополнительные данные из abilityExtras
      const extra = abilityExtras[class_name] || {};

      return {
        name: displayName || class_name,
        description: description,
        cooldown: details.cooldown ?? null,
        cast_range: details.cast_range ?? null,
        image_url: abilityImageUrl,
        class_name: class_name,
        // Новые поля
        properties: extra.properties || {},
        upgrades: extra.upgrades || [],
        tooltip_details: extra.tooltip_details || null,
        ability_type: extra.ability_type || null,
      };
    });
  }

  if (abilities.length === 0 && heroData.abilities && Array.isArray(heroData.abilities)) {
    abilities = heroData.abilities.map((a) => ({
      name: a.name ?? 'Unknown',
      description: a.description ?? '',
      cooldown: a.cooldown ?? null,
      cast_range: a.cast_range ?? null,
      image_url: null,
      properties: {},
      upgrades: [],
      tooltip_details: null,
      ability_type: null,
    }));
  }

  let description = null;
  if (heroData.description) {
    if (typeof heroData.description === 'string') {
      description = heroData.description;
    } else if (heroData.description.lore) {
      description = heroData.description.lore;
    }
  }

  // Настоящий портрет героя. У героев из голосования он появляется в данных только к релизу.
  const realArt = heroData.images?.icon_hero_card ||
                  heroData.images?.minimap_image ||
                  heroData.images?.icon_image_small ||
                  null;

  // Пока героя нет в игре, у него есть только круглый стикер голосования и вертикальная картинка
  const voteImage = heroData.images?.vote_sticker_webp || heroData.images?.vote_sticker || null;
  const placeholderArt = voteImage || heroData.images?.top_bar_vertical_image_webp || null;

  // Герой, которого ещё нет в игре, всегда показывается стикером, даже если часть картинок уже
  // попала в данные. Как только он вышел (появились матчи или переключились флаги) и у него есть
  // настоящий портрет, стикер сам заменяется на него — вручную ничего отмечать не нужно.
  const hasArt = !upcoming && Boolean(realArt);
  const imageUrl = hasArt ? realArt : placeholderArt || realArt;

  // Маленькая иконка (~10 КБ) — для списков и таблиц, где большая карточка (~100 КБ) избыточна
  const iconUrl = hasArt
    ? heroData.images?.icon_image_small_webp || heroData.images?.icon_image_small || imageUrl
    : imageUrl;

  const startingStats = upcoming ? {} : heroData.starting_stats || {};
  const staminaRegen = startingStats.stamina_regen_per_second?.value ?? null;
  const staminaCooldown = staminaRegen ? 1 / staminaRegen : null;

  const stats = {
    winrate,
    pickrate,
    kda,
    games_played: games,
    maxHealth: startingStats.max_health?.value ?? null,
    maxMoveSpeed: startingStats.max_move_speed?.value ?? null,
    sprintSpeed: startingStats.sprint_speed?.value ?? null,
    stamina: startingStats.stamina?.value ?? null,
    healthRegen: startingStats.base_health_regen?.value ?? null,
    lightMeleeDamage: startingStats.light_melee_damage?.value ?? null,
    heavyMeleeDamage: startingStats.heavy_melee_damage?.value ?? null,
    groundDashDistance: startingStats.ground_dash_distance_in_meters?.value ?? null,
    airDashDistance: startingStats.air_dash_distance_in_meters?.value ?? null,
    heroType: heroData.hero_type ?? null,
    tags: heroData.tags || [],
    gunTag: heroData.gun_tag ?? null,
    bulletDamage: weaponStats.bulletDamage ?? null,
    clipSize: weaponStats.clipSize ?? null,
    roundsPerSecond: weaponStats.roundsPerSecond ?? null,
    reloadTime: weaponStats.reloadTime ?? null,
    staminaCooldown: staminaCooldown,
  };

  const levelUpgrades = upcoming ? {} : heroData.standard_level_up_upgrades || {};
  const levelScaling = {
    healthPerLevel: levelUpgrades.MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL ?? null,
    bulletDamagePerLevel: levelUpgrades.MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL ?? null,
    meleeDamagePerLevel: levelUpgrades.MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL ?? null,
    techPowerPerLevel: levelUpgrades.MODIFIER_VALUE_TECH_POWER ?? null,
  };

  const color = heroData.colors?.style_hex || null;

  return {
    id: heroData.id ?? heroData.hero_id,
    name: heroData.name ?? `Hero ${heroData.id}`,
    slug: heroData.name?.toLowerCase().replace(/\s+/g, '-') ?? String(heroData.id),
    role: capitalize(heroData.hero_type) ?? heroData.role ?? heroData.player_role ?? null,
    complexity: heroData.complexity ?? null,
    description,
    image_url: imageUrl,
    icon_url: iconUrl,
    vote_image: voteImage,
    has_art: hasArt, // true — вместо стикера голосования показывается настоящий портрет
    status,
    released: status === 'released',
    upcoming,
    stats,
    abilities,
    levelScaling,
    color,
  };
}

/** В кеш и в память попадает только нужное: ответ hero-stats — 20 полей на героя. */
function slimHeroStats(rows) {
  const byHero = {};
  let total = 0;
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const matches = row.matches ?? 0;
    total += matches;
    byHero[row.hero_id] = {
      matches,
      wins: row.wins ?? 0,
      kills: row.total_kills ?? 0,
      deaths: row.total_deaths ?? 0,
      assists: row.total_assists ?? 0,
    };
  });
  return { total, byHero };
}

/**
 * Статистика всех героев одним запросом с учётом периода и диапазона рангов.
 * @param {import('../services/statsFilters.js').DEFAULT_FILTERS} [filters]
 * @returns {Promise<{ total: number, byHero: Record<number, { matches: number, wins: number, kills: number, deaths: number, assists: number }> }>}
 */
export function fetchHeroStats(filters = DEFAULT_FILTERS) {
  const url = `${ANALYTICS_API_BASE}/v1/analytics/hero-stats?${toQueryString(toStatsParams(filters))}`;
  return httpGet(url, { ttl: STATS_TTL_MS, transform: slimHeroStats });
}

export async function fetchHeroes(language = 'english', filters = DEFAULT_FILTERS) {
  const heroesUrl = `${ASSETS_API_BASE}/v1/assets/heroes?language=${language}`;
  const [heroes, stats] = await Promise.all([
    httpGet(heroesUrl, {
      cacheKey: `heroes_slim_${language}`,
      ttl: heroesTtl(),
      revalidate: true,
      transform: slimHeroList,
    }),
    // Без статистики список героев всё равно показываем — просто с нулями
    fetchHeroStats(filters).catch((err) => {
      console.warn('Failed to load hero stats:', err);
      return EMPTY_STATS;
    }),
  ]);

  if (!heroes.length) {
    console.warn('No heroes received from API');
    return [];
  }

  return heroes.map((hero) => normalizeHero(hero, stats.byHero[hero.id], stats.total));
}

export async function fetchHeroDetail(id, language = 'english', filters = DEFAULT_FILTERS) {
  const heroUrl = `${ASSETS_API_BASE}/v1/assets/heroes/${id}?language=${language}`;
  const abilitiesUrl = `${ASSETS_API_BASE}/v1/assets/items/by-hero-id/${id}?language=${language}`;

  const [heroResult, statsResult, abilitiesResult] = await Promise.allSettled([
    httpGet(heroUrl, { cacheKey: `hero_slim_${id}_${language}`, ttl: heroesTtl(), revalidate: true, transform: slimHero }),
    fetchHeroStats(filters),
    httpGet(abilitiesUrl, { cacheKey: `hero_abilities_${id}_${language}` }),
  ]);

  const hero = heroResult.status === 'fulfilled' ? heroResult.value : { id: Number(id) };
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : EMPTY_STATS;
  const abilitiesData = abilitiesResult.status === 'fulfilled' ? abilitiesResult.value : [];

  // Герой из голосования, которого ещё нет в игре: способностей и статистики у него нет,
  // а характеристики в данных — заглушки, поэтому дальше (оружие, способности) не идём.
  if (heroStatus(hero, stats.byHero[hero.id]?.matches ?? 0) === 'upcoming') {
    return normalizeHero(hero, undefined, 0);
  }

  // Превращаем массив способностей в объект по class_name
  const abilityExtras = {};
  if (Array.isArray(abilitiesData)) {
    abilitiesData.forEach(item => {
      if (item.class_name) {
        abilityExtras[item.class_name] = {
          properties: item.properties || {},
          upgrades: item.upgrades || [],
          tooltip_details: item.tooltip_details || null,
          ability_type: item.ability_type || null,
        };
      }
    });
  }

  // Загружаем детали способностей для иконок и описаний
  let abilitiesDetails = {};
  if (hero.items && typeof hero.items === 'object') {
    const entries = Object.entries(hero.items);
    const abilityKeys = ['signature1', 'signature2', 'signature3', 'signature4'];
    const abilityClassNames = entries
      .filter(([key]) => abilityKeys.includes(key))
      .map(([key, value]) => value)
      .filter(Boolean);

    // Список способностей героя (by-hero-id) уже содержит полные данные каждой: название, описание, картинки,
    // свойства. Отдельный запрос на способность давал тот же ответ — это четыре запроса к бесплатному API
    // (и ~60 КБ кеша) на каждый просмотр героя, поэтому по одной догружаем только то, чего в списке нет.
    const byClassName = new Map(
      (Array.isArray(abilitiesData) ? abilitiesData : []).filter((item) => item?.class_name).map((item) => [item.class_name, item]),
    );
    abilityClassNames.forEach((className) => {
      if (byClassName.has(className)) abilitiesDetails[className] = byClassName.get(className);
    });

    const missing = abilityClassNames.filter((className) => !abilitiesDetails[className]);
    if (missing.length > 0) {
      const detailsResults = await Promise.allSettled(missing.map((className) => fetchAbilityDetails(className, language)));
      detailsResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) abilitiesDetails[missing[index]] = result.value;
      });
    }
  }

  // Загружаем оружие
    // Загружаем оружие
    let weaponStats = {};
    const weaponClass = hero.items?.weapon_primary;
    if (weaponClass) {
      try {
        const weaponData = await httpGet(`${ASSETS_API_BASE}/v1/assets/items/${weaponClass}?language=${language}`, {
          cacheKey: `weapon_${weaponClass}_${language}`,
        });
        
        // Берём данные из weapon_info
        const info = weaponData.weapon_info || {};
        weaponStats = {
          bulletDamage: info.bullet_damage ?? null,
          clipSize: info.clip_size ?? null,
          roundsPerSecond: info.shots_per_second ?? null,
          reloadTime: info.reload_duration ?? null,
        };
      } catch (e) {
        console.warn(`Failed to load weapon stats for ${weaponClass}:`, e);
      }
    }

  return normalizeHero(hero, stats.byHero[hero.id], stats.total, abilitiesDetails, weaponStats, abilityExtras);
}