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

function normalizeHero(heroData, statsData = [], abilitiesDetails = {}) {
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

      return {
        name: displayName || class_name,
        description: description,
        cooldown: details.cooldown ?? null,
        cast_range: details.cast_range ?? null,
        image_url: abilityImageUrl,
        class_name: class_name,
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

  // Стартовые статы
  const startingStats = heroData.starting_stats || {};
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
  };

  // Приросты за уровень
  const levelUpgrades = heroData.standard_level_up_upgrades || {};
  const levelScaling = {
    healthPerLevel: levelUpgrades.MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL ?? null,
    meleeDamagePerLevel: levelUpgrades.MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL ?? null,
  };

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
    levelScaling, // <-- добавлено
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
  return results.map(({ hero, stats }) => normalizeHero(hero, stats, {}));
}

export async function fetchHeroDetail(id, language = 'english') {
  const heroUrl = `${ASSETS_API_BASE}/v1/assets/heroes/${id}?language=${language}`;
  const statsUrl = `${ANALYTICS_API_BASE}/v1/analytics/hero-build-stats/${id}`;

  const [heroResult, statsResult] = await Promise.allSettled([
    httpGet(heroUrl, { cacheKey: `hero_${id}_${language}` }),
    httpGet(statsUrl, { cacheKey: `hero_stats_${id}` }),
  ]);

  const hero = heroResult.status === 'fulfilled' ? heroResult.value : { id: Number(id) };
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : [];

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

  return normalizeHero(hero, stats, abilitiesDetails);
}