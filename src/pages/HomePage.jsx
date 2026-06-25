import { useHeroes } from '../hooks/useHeroes'
import HeroCard from '../components/hero/HeroCard'
import { Link } from 'react-router-dom'

function HomePage() {
  const { heroes, loading, error, search, setSearch, role, setRole, sort, setSort, dir, setDir, roles } = useHeroes()

  if (loading) {
    return (
      <div className="state-center">
        <div className="spinner" />
        <span>Загрузка героев...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="state-center state-error">
        ⚠️ Ошибка: {error}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Мета-хаб <em>Deadlock</em></h1>
          <div className="page-subtitle">Актуальная статистика героев и билдов</div>
        </div>
        <span className="count-badge">{heroes.length} героев</span>
      </div>

      {/* Фильтры */}
      <div className="filters">
        <div className="filters__search">
          <span className="filters__search-icon">🔍</span>
          <input
            type="text"
            className="input"
            placeholder="Поиск героя..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="select" value={role} onChange={e => setRole(e.target.value)}>
          <option value="all">Все роли</option>
          {roles.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select className="select" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="winrate">По винрейту</option>
          <option value="pickrate">По пикрейту</option>
          <option value="name">По имени</option>
        </select>

        <button className="btn btn-secondary" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>
          {dir === 'asc' ? '▲' : '▼'}
        </button>
      </div>

      {/* Сетка героев */}
      <div className="hero-grid">
        {heroes.map(hero => (
          <Link to={`/hero/${hero.id}`} key={hero.id}>
            <HeroCard hero={hero} />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default HomePage