import { useHeroes } from '../hooks/useHeroes'
import HeroCard from '../components/hero/HeroCard'
import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import SkeletonGrid from '../components/ui/SkeletonGrid'
import StatsFilters from '../components/ui/StatsFilters'

function HomePage() {
  const { heroes, loading, refreshing, error, search, setSearch, role, setRole, sort, setSort, dir, setDir, roles } = useHeroes()
  const t = useTranslation()

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

  // «Скрытые» — заготовки героев, недоступные игрокам (а не герои без матчей в выбранной выборке)
  const mainHeroes = heroes.filter(h => h.released)
  const hiddenHeroes = heroes.filter(h => !h.released)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('home.title')} <em>Deadlock</em></h1>
          <div className="page-subtitle">{t('home.subtitle')}</div>
        </div>
        <span className="count-badge">{heroes.length} {t('home.heroCount')}</span>
      </div>

      <StatsFilters />

      <div className="filters">
        <div className="filters__search">
          <span className="filters__search-icon" aria-hidden="true">&gt;</span>
          <input
            type="text"
            className="input"
            placeholder={t('home.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="select" value={role} onChange={e => setRole(e.target.value)}>
          <option value="all">{t('home.allRoles')}</option>
          {roles.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select className="select" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="winrate">{t('home.sortByWinrate')}</option>
          <option value="pickrate">{t('home.sortByPickrate')}</option>
          <option value="name">{t('home.sortByName')}</option>
        </select>

        <button className="btn btn-secondary" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>
          {dir === 'asc' ? '▲' : '▼'}
        </button>
      </div>

      <div className={refreshing ? 'is-refreshing' : undefined} aria-busy={refreshing}>
        {mainHeroes.length > 0 && (
          <div className="section">
            <h2 className="section__title">{t('home.mainHeroes')} ({mainHeroes.length})</h2>
            <div className="hero-grid">
              {mainHeroes.map(hero => (
                <Link to={`/hero/${hero.id}`} key={hero.id}>
                  <HeroCard hero={hero} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {hiddenHeroes.length > 0 && (
          <div className="section">
            <h2 className="section__title">{t('home.hiddenHeroes')} ({hiddenHeroes.length})</h2>
            <div className="hero-grid">
              {hiddenHeroes.map(hero => (
                <Link to={`/hero/${hero.id}`} key={hero.id}>
                  <HeroCard hero={hero} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
