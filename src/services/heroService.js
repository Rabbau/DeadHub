/**
 * @fileoverview Hero service — бизнес-логика работы с героями.
 * Не знает ни про React, ни про API-структуру. Только доменная логика.
 */

// Числовые ключи сортировки: что именно сравниваем у героя
const SORT_VALUES = {
  winrate: (hero) => hero.stats.winrate,
  pickrate: (hero) => hero.stats.pickrate,
  matches: (hero) => hero.stats.games_played,
  kda: (hero) => hero.stats.kda ?? 0,
  delta: (hero) => hero.delta?.dWr ?? 0, // изменение винрейта к прошлому периоду (hero.delta подмешивает useHeroes)
}

/** Есть ли у героя значение для этой сортировки: герои без него всегда в конце списка. */
function hasSortValue(sort, hero) {
  return sort === 'delta' ? Boolean(hero.delta?.reliable) : hero.stats.games_played > 0
}

/**
 * Отфильтровать и отсортировать героев. sort: winrate | pickrate | matches | kda | delta | name.
 * @param {import('../types/index.js').Hero[]} heroes
 * @param {{ role?: string, sort?: import('../types/index.js').SortKey, dir?: import('../types/index.js').SortDir, search?: string }} params
 * @returns {import('../types/index.js').Hero[]}
 */
export function filterAndSort(heroes, { role, sort = 'winrate', dir = 'desc', search = '' } = {}) {
    let result = [...heroes]
  
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(h => h.name.toLowerCase().includes(q))
    }
  
    if (role && role !== 'all') {
      result = result.filter(h => h.role?.toLowerCase() === role.toLowerCase())
    }
  
    result.sort((a, b) => {
      if (sort === 'name') {
        const an = a.name.toLowerCase()
        const bn = b.name.toLowerCase()
        return dir === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an)
      }
      // Герои без матчей в выборке всегда в конце — иначе при сортировке «по возрастанию» они оказались бы первыми
      const aHas = hasSortValue(sort, a)
      const bHas = hasSortValue(sort, b)
      if (aHas !== bHas) return aHas ? -1 : 1
      const valueOf = SORT_VALUES[sort] ?? SORT_VALUES.winrate
      return dir === 'asc' ? valueOf(a) - valueOf(b) : valueOf(b) - valueOf(a)
    })
  
    return result
  }
  
  /**
   * Извлечь уникальные роли из списка героев.
   * @param {import('../types/index.js').Hero[]} heroes
   * @returns {string[]}
   */
  export function extractRoles(heroes) {
    const roles = new Set(heroes.map(h => h.role).filter(Boolean))
    return Array.from(roles).sort()
  }
  
  /**
   * Выбрать случайного героя.
   * @param {import('../types/index.js').Hero[]} heroes
   * @returns {import('../types/index.js').Hero|null}
   */
  export function pickRandomHero(heroes) {
    if (!heroes.length) return null
    return heroes[Math.floor(Math.random() * heroes.length)]
  }
  
  /**
   * Выбрать N случайных предметов из пула.
   * @param {import('../types/index.js').Item[]} items
   * @param {number} count
   * @returns {import('../types/index.js').Item[]}
   */
  export function pickRandomItems(items, count = 4) {
    const shuffled = [...items].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }
  
  /**
   * Форматировать винрейт в проценты.
   * @param {number} rate - 0..1
   * @returns {string}
   */
  export function formatWinrate(rate) {
    if (rate == null || isNaN(rate)) return '—'
    const pct = rate > 1 ? rate : rate * 100
    return `${pct.toFixed(1)}%`
  }
  
  /**
   * Форматировать пикрейт.
   * @param {number} rate - 0..1
   * @returns {string}
   */
  export function formatPickrate(rate) {
    return formatWinrate(rate)
  }
  
  /**
   * Цвет по винрейту (для UI-индикатора).
   * @param {number} rate
   * @returns {'good'|'neutral'|'bad'}
   */
  export function winrateColor(rate) {
    const pct = rate > 1 ? rate : rate * 100
    if (pct >= 52) return 'good'
    if (pct >= 48) return 'neutral'
    return 'bad'
  }

  // В строках hero-stats считаются игроки, а в матче их 12
  const PLAYERS_PER_MATCH = 12

  /**
   * Размер выборки в матчах: при узких фильтрах (высокие ранги, короткий период) статистика «шумит».
   * @param {import('../types/index.js').Hero[]} heroes
   * @returns {number}
   */
  export function estimateSampleMatches(heroes) {
    const picks = heroes.reduce((sum, hero) => sum + hero.stats.games_played, 0)
    return Math.round(picks / PLAYERS_PER_MATCH)
  }