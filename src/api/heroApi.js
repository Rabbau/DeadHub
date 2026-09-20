import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE, ANALYTICS_API_BASE } from './config.js';
import { DEFAULT_FILTERS, toQueryString, toStatsParams } from '../services/statsFilters.js';

const ITEM_IMG_BASE = 'https://assets.deadlock-api.com/images/items';
const STATS_TTL_MS = 10 * 60 * 1000; // на стороне API ответы тоже кешируются на 10 минут
const EMPTY_STATS = { total: 0, byHero: {} };

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

  // Герой доступен игрокам; остальные в assets — заготовки в разработке
  const released =
    heroData.player_selectable === true && heroData.disabled !== true && heroData.in_development !== true;

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

  const imageUrl = heroData.images?.icon_hero_card ||
                   heroData.images?.minimap_image ||
                   heroData.images?.icon_image_small ||
                   null;

  // Маленькая иконка (~10 КБ) — для списков и таблиц, где большая карточка (~100 КБ) избыточна
  const iconUrl = heroData.images?.icon_image_small_webp ||
                  heroData.images?.icon_image_small ||
                  imageUrl;

  const startingStats = heroData.starting_stats || {};
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

  const levelUpgrades = heroData.standard_level_up_upgrades || {};
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
    released,
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
  const [heroesData, stats] = await Promise.all([
    httpGet(heroesUrl, { cacheKey: `heroes_list_${language}` }),
    // Без статистики список героев всё равно показываем — просто с нулями
    fetchHeroStats(filters).catch((err) => {
      console.warn('Failed to load hero stats:', err);
      return EMPTY_STATS;
    }),
  ]);
  const heroes = Array.isArray(heroesData) ? heroesData : heroesData.data ?? heroesData.heroes ?? [];

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
    httpGet(heroUrl, { cacheKey: `hero_${id}_${language}` }),
    fetchHeroStats(filters),
    httpGet(abilitiesUrl, { cacheKey: `hero_abilities_${id}_${language}` }),
  ]);

  const hero = heroResult.status === 'fulfilled' ? heroResult.value : { id: Number(id) };
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : EMPTY_STATS;
  const abilitiesData = abilitiesResult.status === 'fulfilled' ? abilitiesResult.value : [];

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

    if (abilityClassNames.length > 0) {
      const detailsPromises = abilityClassNames.map((className) =>
        fetchAbilityDetails(className, language)
      );
      const detailsResults = await Promise.allSettled(detailsPromises);
      detailsResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const className = abilityClassNames[index];
          abilitiesDetails[className] = result.value;
        }
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