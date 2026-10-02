import { useHeroes } from '../hooks/useHeroes'
import { useHeroView } from '../hooks/useHeroView'
import HeroCard from '../components/hero/HeroCard'
import HeroTable from '../components/hero/HeroTable'
import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { usePageMeta } from '../hooks/usePageMeta'
import SkeletonGrid from '../components/ui/SkeletonGrid'
import StatsFilters from '../components/ui/StatsFilters'
import NewHeroes from '../components/hero/NewHeroes'
import DeltaNote from '../components/ui/DeltaNote'
import { isStreetBrawl } from '../services/statsFilters'

const VIEWS = [
  { id: 'cards', key: 'home.viewCards' },
  { id: 'table', key: 'home.viewTable' },
]

function HomePage() {
  const {
    heroes, allHeroes, loading, refreshing, error, search, setSearch, role, setRole, sort, setSort, dir, setDir, roles,
    statsFilters, hasDeltas, deltaWindow,
  } = useHeroes({ withDelta: true })
  const [view, setView] = useHeroView()
  const t = useTranslation()
  usePageMeta('home')

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('home.title')} <em>Deadlock</em></h1>
          </div>
        </div>
        <StatsFilters />
        <SkeletonGrid type="hero" count={16} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <StatsFilters />
        <div className="state-center state-error">
          {t('common.error')}: {error}
        </div>
      </div>
    )
  }

  // «Скрытые» — заготовки героев, недоступные игрокам (а не герои без матчей в выбранной выборке).
  // Герои из голосования, которых ещё нет в игре, показываются отдельной полосой «Новые герои» выше.
  const mainHeroes = heroes.filter(h => h.status === 'released')
  const hiddenHeroes = heroes.filter(h => h.status === 'hidden')

  // Щелчок по заголовку колонки таблицы: тот же столбец — меняем направление, другой — сортируем по нему
  const handleSort = (id, firstDir) => {
    if (sort === id) {
      setDir(dir === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(id)
      setDir(firstDir)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('home.title')} <em>Deadlock</em></h1>
          <div className="page-subtitle">{t('home.subtitle')}</div>
        </div>
        <div className="page-header__side">
          {isStreetBrawl(statsFilters) && <span className="count-badge count-badge--mode">{t('filters.modes.street_brawl')}</span>}
          <span className="count-badge">{mainHeroes.length} {t('home.heroCount')}</span>
          <div className="chip-group" role="group" aria-label={t('home.viewLabel')}>
            {VIEWS.map(({ id, key }) => (
              <button
                key={id}
                type="button"
                className={`chip ${view === id ? 'active' : ''}`}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <NewHeroes heroes={allHeroes} />

      <StatsFilters />

      <div className="filters">
        <div className="filters__search">
          <span className="filters__search-icon" aria-hidden="true">&gt;</span>
          <input
            type="text"
            className="input"
            placeholder={t('home.searchPlaceholder')}
            aria-label={t('home.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="select" aria-label={t('home.roleFilter')} value={role} onChange={e => setRole(e.target.value)}>
          <option value="all">{t('home.allRoles')}</option>
          {roles.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* В таблице сортировка — в заголовках колонок, отдельные элементы были бы лишними */}
        {view === 'cards' && (
          <>
            <select className="select" aria-label={t('home.sortLabel')} value={sort} onChange={e => setSort(e.target.value)}>
              <option value="winrate">{t('home.sortByWinrate')}</option>
              <option value="pickrate">{t('home.sortByPickrate')}</option>
              <option value="matches">{t('home.sortByMatches')}</option>
              <option value="kda">{t('home.sortByKda')}</option>
              {hasDeltas && <option value="delta">{t('home.sortByDelta')}</option>}
              <option value="name">{t('home.sortByName')}</option>
            </select>

            {/* Символ ▲/▼ скринридер читает как «чёрный треугольник»: даём кнопке настоящее имя */}
            <button
              type="button"
              className="btn btn-secondary"
              aria-label={t('home.sortDirection', { direction: t(dir === 'asc' ? 'home.dirAsc' : 'home.dirDesc') })}
              onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}
            >
              {dir === 'asc' ? '▲' : '▼'}
            </button>
          </>
        )}
      </div>

      <div className={refreshing ? 'is-refreshing' : undefined} aria-busy={refreshing}>
        {mainHeroes.length > 0 && (
          <div className="section">
            <h2 className="section__title">{t('home.mainHeroes')} ({mainHeroes.length})</h2>
            {hasDeltas && <DeltaNote window={deltaWindow} />}
            {view === 'table' ? (
              <HeroTable heroes={mainHeroes} sort={sort} dir={dir} onSort={handleSort} showDelta={hasDeltas} />
            ) : (
              <div className="hero-grid">
                {mainHeroes.map(hero => (
                  <Link to={`/hero/${hero.id}`} key={hero.id}>
                    <HeroCard hero={hero} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {hiddenHeroes.length > 0 && (
          <div className="section">
            <h2 className="section__title">{t('home.hiddenHeroes')} ({hiddenHeroes.length})</h2>
            {view === 'table' ? (
              <HeroTable heroes={hiddenHeroes} sort={sort} dir={dir} onSort={handleSort} showHeader={false} />
            ) : (
              <div className="hero-grid">
                {hiddenHeroes.map(hero => (
                  <Link to={`/hero/${hero.id}`} key={hero.id}>
                    <HeroCard hero={hero} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
