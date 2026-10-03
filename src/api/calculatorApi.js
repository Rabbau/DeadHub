import { httpGet } from './httpClient.js';
import { ASSETS_API_BASE } from './config.js';
import { heroesTtl, slimHero } from './heroApi.js';
import { slimCalcItems, toHeroBase } from '../services/calculatorService.js';

// Запросы калькулятора билда лежат отдельно от heroApi и itemApi: их тянут главная, герои и предметы, а расчёт нужен
// только странице калькулятора и скачивается вместе с ней.

const ITEMS_TTL_MS = 6 * 60 * 60 * 1000; // справочник меняется только вместе со сборкой игры

/**
 * Основа героя для калькулятора билда: здоровье, прирост за уровень и оружие. Два небольших запроса (сам герой и его
 * оружие) с теми же ключами кеша, что у страницы героя, поэтому после неё запросов нет вовсе.
 * @param {number|string} id
 * @returns {Promise<ReturnType<typeof toHeroBase>>}
 */
export async function fetchHeroCalcBase(id, language = 'english') {
  const hero = await httpGet(`${ASSETS_API_BASE}/v1/assets/heroes/${id}?language=${language}`, {
    cacheKey: `hero_slim_${id}_${language}`,
    ttl: heroesTtl(),
    revalidate: true,
    transform: slimHero,
  });
  const weaponClass = hero.items?.weapon_primary;
  // Без оружия калькулятор всё равно посчитает здоровье: сбой второго запроса не должен ломать страницу
  const weapon = weaponClass
    ? await httpGet(`${ASSETS_API_BASE}/v1/assets/items/${weaponClass}?language=${language}`, { cacheKey: `weapon_${weaponClass}_${language}` }).catch(() => null)
    : null;
  return toHeroBase(hero, weapon);
}

/**
 * Предметы для калькулятора билда: только то, что продаётся, с бонусами к здоровью, урону, скорострельности и магазину
 * (см. slimCalcItems). Запрос тот же, что у страницы предметов, а в localStorage попадает отдельная лёгкая запись:
 * несколько десятков КБ вместо полного списка.
 * @returns {Promise<ReturnType<typeof slimCalcItems>>}
 */
export function fetchCalcItems(language = 'english') {
  return httpGet(`${ASSETS_API_BASE}/v1/assets/items?language=${language}`, {
    cacheKey: `items_calc_${language}`,
    ttl: ITEMS_TTL_MS,
    transform: slimCalcItems,
  });
}
