/**
 * @fileoverview Core domain types.
 * Эти типы отражают бизнес-сущности — не структуру API.
 * При переходе на бэкенд маппинг меняется только в api/ слое.
 */

/**
 * @typedef {Object} HeroAbility
 * @property {string} name
 * @property {string} description
 * @property {string|null} cooldown
 * @property {string|null} cast_range
 */

/**
 * @typedef {Object} HeroStats
 * @property {number} winrate       - 0..1
 * @property {number} pickrate      - 0..1
 * @property {number|null} kda
 * @property {number} games_played
 */

/**
 * @typedef {Object} Hero
 * @property {number} id
 * @property {string} name
 * @property {string} slug
 * @property {string|null} role
 * @property {string|null} complexity  - "Simple" | "Moderate" | "Hard"
 * @property {string|null} description
 * @property {string|null} image_url
 * @property {HeroStats} stats
 * @property {HeroAbility[]} abilities
 */

/**
 * @typedef {Object} Item
 * @property {number} id
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} category    - "Weapon" | "Vitality" | "Spirit"
 * @property {number|null} cost
 * @property {string|null} image_url
 */

/**
 * @typedef {'winrate'|'pickrate'|'name'} SortKey
 * @typedef {'asc'|'desc'} SortDir
 */

export {} // make this a module
