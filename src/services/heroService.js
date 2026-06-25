/**
 * @fileoverview Hero service — бизнес-логика работы с героями.
 * Не знает ни про React, ни про API-структуру. Только доменная логика.
 */

/**
 * Отфильтровать и отсортировать героев.
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
      let av, bv
      if (sort === 'name') {
        av = a.name.toLowerCase()
        bv = b.name.toLowerCase()
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      av = sort === 'winrate' ? a.stats.winrate : a.stats.pickrate
      bv = sort === 'winrate' ? b.stats.winrate : b.stats.pickrate
      return dir === 'asc' ? av - bv : bv - av
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