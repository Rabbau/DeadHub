import { useEffect, useMemo } from 'react'
import { useHeroStore } from '../store/heroStore.js'
import { filterAndSort, extractRoles } from '../services/heroService.js'

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

  return {
    heroes: filtered,
    allHeroes: store.heroes,
    loading: store.loading,
    error: store.error,
    roles,
    language: store.language,
    setLanguage: store.setLanguage,

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