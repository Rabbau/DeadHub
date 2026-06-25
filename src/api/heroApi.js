import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE, ANALYTICS_API_BASE } from './config.js';

const IMG_BASE = 'https://assets.deadlock-api.com/images/heroes';

function normalizeHero(heroData, statsData = []) {
  // Логируем, что пришло
  console.log(`Hero ${heroData.id} (${heroData.name}) stats:`, statsData);

  const stats = Array.isArray(statsData) ? statsData[0] : statsData;
  const winrate = stats?.win_rate ?? stats?.winrate ?? 0;
  const pickrate = stats?.pick_rate ?? stats?.pickrate ?? 0;
  const games = stats?.matches ?? stats?.total_games ?? 0;
  const kda = stats?.kda ?? null;

  const abilities = (heroData.abilities ?? []).map((a) => ({
    name: a.name ?? '',
    description: a.description ?? '',
    cooldown: a.cooldown ?? null,
    cast_range: a.cast_range ?? null,
  }));

  let description = null;
  if (heroData.description) {
    if (typeof heroData.description === 'string') {
      description = heroData.description;
    } else if (heroData.description.lore) {
      description = heroData.description.lore;
    }
  }

  return {
    id: heroData.id ?? heroData.hero_id,
    name: heroData.name ?? `Hero ${heroData.id}`,
    slug: heroData.name?.toLowerCase().replace(/\s+/g, '-') ?? String(heroData.id),
    role: heroData.role ?? heroData.player_role ?? null,
    complexity: heroData.complexity ?? null,
    description,
    image_url:
      heroData.images?.icon_hero_card ??
      heroData.images?.minimap_image ??
      `${IMG_BASE}/${heroData.id}_card.png`,
    stats: {
      winrate: winrate > 1 ? winrate / 100 : winrate,
      pickrate: pickrate > 1 ? pickrate / 100 : pickrate,
      kda,
      games_played: games,
    },
    abilities,
  };
}

export async function fetchHeroes() {
  const heroesUrl = `${ASSETS_API_BASE}/v2/heroes?only_active=true`;
  const heroesData = await httpGet(heroesUrl, { cacheKey: 'heroes_list_v2' });
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
  return results.map(({ hero, stats }) => normalizeHero(hero, stats));
}

export async function fetchHeroDetail(id) {
  const heroUrl = `${ASSETS_API_BASE}/v2/heroes/${id}`;
  const statsUrl = `${ANALYTICS_API_BASE}/v1/analytics/hero-build-stats/${id}`;

  const [heroResult, statsResult] = await Promise.allSettled([
    httpGet(heroUrl, { cacheKey: `hero_${id}` }),
    httpGet(statsUrl, { cacheKey: `hero_stats_${id}` }),
  ]);

  const hero = heroResult.status === 'fulfilled' ? heroResult.value : { id: Number(id) };
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : [];

  return normalizeHero(hero, stats);
}