import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE, ANALYTICS_API_BASE } from './config.js';

const ITEM_IMG_BASE = 'https://assets.deadlock-api.com/images/items';

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

function normalizeHero(heroData, statsData = [], abilitiesDetails = {}, weaponStats = {}, abilityExtras = {}) {
  let totalWins = 0;
  let totalMatches = 0;
  let totalPicks = 0;

  if (Array.isArray(statsData) && statsData.length > 0) {
    statsData.forEach((build) => {
      const wins = build.wins ?? 0;
      const losses = build.losses ?? 0;
      const matches = build.matches ?? 0;
      const picks = build.players ?? 0;
      totalWins += wins;
      totalMatches += matches;
      totalPicks += picks;
    });
  }

  const winrate = totalMatches > 0 ? totalWins / totalMatches : 0;
  const games = totalMatches > 0 ? totalMatches : heroData.matches ?? 0;
  const pickrate = games > 0 ? totalPicks / games : 0;

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

  const startingStats = heroData.starting_stats || {};
  const staminaRegen = startingStats.stamina_regen_per_second?.value ?? null;
  const staminaCooldown = staminaRegen ? 1 / staminaRegen : null;

  const stats = {
    winrate: winrate > 1 ? winrate / 100 : winrate,
    pickrate: pickrate > 1 ? pickrate / 100 : pickrate,
    kda: null,
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
    stats,
    abilities,
    levelScaling,
    color,
  };
}

export async function fetchHeroes(language = 'english') {
  const heroesUrl = `${ASSETS_API_BASE}/v1/assets/heroes?language=${language}`;
  const heroesData = await httpGet(heroesUrl, { cacheKey: `heroes_list_${language}` });
  const heroes = Array.isArray(heroesData) ? heroesData : heroesData.data ?? heroesData.heroes ?? [];

  if (!heroes.length) {
    console.warn('No heroes received from API');
    return [];
  }

  const statsPromises = heroes.map((hero) => {
    const statsUrl = `${ANALYTICS_API_BASE}/v1/analytics/hero-build-stats/${hero.id}`;
    return httpGet(statsUrl, { cacheKey: `hero_stats_${hero.id}` })
      .then((data) => ({ hero, stats: data }))
      .catch((err) => {
        console.warn(`Failed to load stats for hero ${hero.id}:`, err);
        return { hero, stats: [] };
      });
  });

  const results = await Promise.all(statsPromises);
  return results.map(({ hero, stats }) => normalizeHero(hero, stats, {}, {}));
}

export async function fetchHeroDetail(id, language = 'english') {
  const heroUrl = `${ASSETS_API_BASE}/v1/assets/heroes/${id}?language=${language}`;
  const statsUrl = `${ANALYTICS_API_BASE}/v1/analytics/hero-build-stats/${id}`;
  const abilitiesUrl = `${ASSETS_API_BASE}/v1/assets/items/by-hero-id/${id}?language=${language}`;

  const [heroResult, statsResult, abilitiesResult] = await Promise.allSettled([
    httpGet(heroUrl, { cacheKey: `hero_${id}_${language}` }),
    httpGet(statsUrl, { cacheKey: `hero_stats_${id}` }),
    httpGet(abilitiesUrl, { cacheKey: `hero_abilities_${id}_${language}` }),
  ]);

  const hero = heroResult.status === 'fulfilled' ? heroResult.value : { id: Number(id) };
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : [];
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
        console.log(`[DEBUG] Weapon data for ${weaponClass}:`, weaponData);
        
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

  return normalizeHero(hero, stats, abilitiesDetails, weaponStats, abilityExtras);
}