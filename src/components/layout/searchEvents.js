/**
 * Команда «открыть поиск» для любого места сайта (кнопка на главной). Окно поиска живёт в шапке (GlobalSearch)
 * и слушает это событие, поэтому остальным страницам не нужны ни его состояние, ни его код.
 */
export const OPEN_SEARCH_EVENT = 'dlhub:open-search';

/**
 * Открывает окно поиска. `origin` — элемент, откуда его открыли: после закрытия фокус вернётся к нему,
 * а не к кнопке в шапке.
 * @param {HTMLElement|null} [origin]
 */
export function requestSearch(origin = null) {
  window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT, { detail: { origin } }));
}
