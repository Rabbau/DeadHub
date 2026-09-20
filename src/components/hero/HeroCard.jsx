import { formatWinrate, formatPickrate, winrateColor } from '../../services/heroService'

function HeroCard({ hero }) {
  const wr = hero.stats.winrate
  const wrColor = winrateColor(wr)
  // У героя может не быть матчей в выбранной выборке (узкий ранг/период) — тогда честный прочерк, а не 0%
  const hasStats = hero.stats.games_played > 0

  return (
    <div className="hero-card">
      <div className="hero-card__img-wrap">
        {hero.image_url ? (
          <img src={hero.image_url} alt={hero.name} className="hero-card__img" loading="lazy" />
        ) : (
          <div className="hero-card__img-placeholder">{hero.name.slice(0, 2)}</div>
        )}
        {hero.role && (
          <span className="hero-card__role-badge">{hero.role}</span>
        )}
      </div>
      <div className="hero-card__body">
        <div className="hero-card__name">{hero.name}</div>
        <div className="hero-card__stats">
          <span className="hero-card__stat">
            WR <strong className={hasStats ? `winrate-${wrColor}` : undefined}>{hasStats ? formatWinrate(wr) : '—'}</strong>
          </span>
          <span className="hero-card__stat">
            PR <strong>{hasStats ? formatPickrate(hero.stats.pickrate) : '—'}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

export default HeroCard
