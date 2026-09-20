import { useEffect, useMemo } from 'react'
import { useHeroStore } from '../store/heroStore.js'
import { filterAndSort, extractRoles, estimateSampleMatches } from '../services/heroService.js'

export function useHeroes() {
  const store = useHeroStore()

  useEffect(() => {
    store.loadHeroes()
  }, [store.language])

  const filtered = useMemo(
    () => filterAndSort(store.heroes, {
      role: store.role,
      sort: store.sort,
      dir: store.dir,
      search: store.search,
    }),
    [store.heroes, store.role, store.sort, store.dir, store.search],
  )

  const roles = useMemo(() => extractRoles(store.heroes), [store.heroes])

  const sampleMatches = useMemo(() => estimateSampleMatches(store.heroes), [store.heroes])

  const hasHeroes = store.heroes.length > 0

  return {
    heroes: filtered,
    allHeroes: store.heroes,
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
    sort: store.sort,
    dir: store.dir,
    setSearch: store.setSearch,
    setRole: store.setRole,
    setSort: store.setSort,
    setDir: store.setDir,
  }
}
