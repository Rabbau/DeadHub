import { useRandomBuild } from '../hooks/useRandomBuild'
import { formatWinrate } from '../services/heroService'

function BuildPage() {
  const { build, loading, generate } = useRandomBuild()

  return (
    <div className="page build-page">
      <h1 className="page-title">Случайный билд <em>дня</em></h1>
      <p className="build-page__intro">
        Нажми кнопку — получи героя и набор предметов для эксперимента.
      </p>

      <button className="btn btn-primary" onClick={generate} disabled={loading}>
        {loading ? 'Генерация...' : '🎲 Сгенерировать'}
      </button>

      {build && (
        <div className="build-card">
          <div className="build-card__hero">
            {build.hero.image_url ? (
              <img src={build.hero.image_url} alt={build.hero.name} className="build-card__hero-img" />
            ) : (
              <div className="build-card__hero-placeholder">{build.hero.name.slice(0, 2)}</div>
            )}
            <div>
              <div className="build-card__hero-name">{build.hero.name}</div>
              <div className="build-card__hero-role">{build.hero.role || '—'}</div>
            </div>
          </div>

          <div className="build-card__items">
            {build.items.map(item => (
              <div className="item-card" key={item.id}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="item-card__img" />
                ) : (
                  <div className="item-card__img-placeholder">🛡</div>
                )}
                <div className="item-card__name">{item.name}</div>
                {item.cost && <div className="item-card__cost">{item.cost} ₡</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BuildPage