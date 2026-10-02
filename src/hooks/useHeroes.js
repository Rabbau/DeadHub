import { useEffect, useMemo } from 'react'
import { useHeroStore } from '../store/heroStore.js'
import { useHeroDeltas } from './useHeroDeltas.js'
import { filterAndSort, extractRoles, estimateSampleMatches } from '../services/heroService.js'

/**
 * Герои со статистикой за выбранные фильтры. `withDelta` подмешивает каждому герою `delta` — изменение к прошлому
 * периоду: это ещё один запрос к API (кешируется), поэтому включается только там, где Δ показывается.
 */
export function useHeroes({ withDelta = false } = {}) {
  const store = useHeroStore()
  const { loadHeroes, language } = store
  const { deltas, window: deltaWindow, loading: deltaLoading } = useHeroDeltas({ enabled: withDelta })

  useEffect(() => {
    loadHeroes()
  }, [language, loadHeroes])

  // Герои из стора остаются как были; с Δ — копии с полем delta
  const heroes = useMemo(
    () => (withDelta && deltas ? store.heroes.map((hero) => (deltas[hero.id] ? { ...hero, delta: deltas[hero.id] } : hero)) : store.heroes),
    [store.heroes, withDelta, deltas],
  )

  // Сортировка по Δ имеет смысл только пока Δ посчитана: иначе (сменили фильтры, сравнивать не с чем) — по винрейту
  const hasDeltas = withDelta && Boolean(deltas)
  const sort = store.sort === 'delta' && !hasDeltas ? 'winrate' : store.sort

  const filtered = useMemo(
    () => filterAndSort(heroes, {
      role: store.role,
      sort,
      dir: store.dir,
      search: store.search,
    }),
    [heroes, store.role, sort, store.dir, store.search],
  )

  const roles = useMemo(() => extractRoles(store.heroes), [store.heroes])

  const sampleMatches = useMemo(() => estimateSampleMatches(store.heroes), [store.heroes])

  const hasHeroes = store.heroes.length > 0

  return {
    heroes: filtered,
    allHeroes: heroes,
    // Δ к прошлому периоду: окно сравнения (для подписи) и признак, что оно ещё считается
    deltaWindow: withDelta ? deltaWindow : null,
    deltaLoading: withDelta && deltaLoading,
    hasDeltas,
    // loading — только первичная загрузка; при смене фильтров старый список остаётся на экране
    loading: store.loading && !hasHeroes,
    refreshing: store.loading && hasHeroes,
    error: store.error,
    roles,
    sampleMatches,
    language: store.language,
    setLanguage: store.setLanguage,

    // Период и диапазон рангов
    statsFilters: store.filters,
    setStatsFilters: store.setFilters,

    // Filters
    search: store.search,
    role: store.role,
    sort,
    dir: store.dir,
    setSearch: store.setSearch,
    setRole: store.setRole,
    setSort: store.setSort,
    setDir: store.setDir,
  }
}
