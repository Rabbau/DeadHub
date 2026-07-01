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
 * @property {number} winrate
 * @property {number} pickrate
 * @property {number|null} kda
 * @property {number} games_played
 * @property {number|null} maxHealth
 * @property {number|null} maxMoveSpeed
 * @property {number|null} sprintSpeed
 * @property {number|null} stamina
 * @property {number|null} healthRegen
 * @property {number|null} lightMeleeDamage
 * @property {number|null} heavyMeleeDamage
 * @property {number|null} groundDashDistance
 * @property {number|null} airDashDistance
 * @property {string|null} heroType
 * @property {string[]} tags
 * @property {string|null} gunTag
 * @property {number|null} bulletDamage
 * @property {number|null} clipSize
 * @property {number|null} roundsPerSecond
 * @property {number|null} reloadTime
 * @property {number|null} staminaCooldown
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
