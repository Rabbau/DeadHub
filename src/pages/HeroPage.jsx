import { useParams, Link } from 'react-router-dom';
import { useHeroDetail } from '../hooks/useHeroDetail';
import { formatWinrate, formatPickrate, winrateColor } from '../services/heroService';

function HeroPage() {
  const { id } = useParams();
  const { hero, items, loading, error } = useHeroDetail(id);

  if (loading) {
    return (
      <div className="state-center">
        <div className="spinner" />
        <span>Загрузка героя...</span>
      </div>
    );
  }

  if (error || !hero) {
    return (
      <div className="state-center state-error">
        ⚠️ {error || 'Герой не найден'}
      </div>
    );
  }

  const wrColor = winrateColor(hero.stats.winrate);

  return (
    <div className="page">
      <Link to="/" className="back-link">← Назад к списку</Link>

      <div className="hero-detail">
        <div className="hero-detail__portrait">
          {hero.image_url ? (
            <img src={hero.image_url} alt={hero.name} />
          ) : (
            <div className="hero-detail__portrait-placeholder">{hero.name.slice(0, 2)}</div>
          )}
        </div>

        <div className="hero-detail__info">
          <h1 className="hero-detail__name">{hero.name}</h1>
          <div className="hero-detail__meta">
            {hero.role && <span className="tag tag--role">{hero.role}</span>}
            {hero.complexity && <span className="tag tag--complexity">{hero.complexity}</span>}
          </div>

          <div className="hero-detail__stats-row">
            <div className="stat-card">
              <div className="stat-card__label">Винрейт</div>
              <div className={`stat-card__value winrate-${wrColor}`}>
                {hero.stats.games_played > 0 ? formatWinrate(hero.stats.winrate) : '—'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Пикрейт</div>
              <div className="stat-card__value">
                {hero.stats.games_played > 0 ? formatPickrate(hero.stats.pickrate) : '—'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Матчей</div>
              <div className="stat-card__value">{hero.stats.games_played.toLocaleString()}</div>
            </div>
          </div>

          {hero.description && (
            <p className="hero-detail__description">{hero.description}</p>
          )}

          {hero.abilities?.length > 0 && (
            <div className="section">
              <h2 className="section__title">Способности</h2>
              <div className="abilities-list">
                {hero.abilities.map((ability, idx) => (
                  <div className="ability-card" key={idx}>
                    <div className="ability-card__icon">{ability.name.slice(0, 2)}</div>
                    <div>
                      <div className="ability-card__name">{ability.name}</div>
                      <div className="ability-card__desc">{ability.description}</div>
                      {(ability.cooldown || ability.cast_range) && (
                        <div className="ability-card__meta">
                          {ability.cooldown && <span>⏱ {ability.cooldown}</span>}
                          {ability.cast_range && <span>📏 {ability.cast_range}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="section">
              <h2 className="section__title">Популярные предметы</h2>
              <div className="items-grid">
                {items.map((item) => (
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
      </div>
    </div>
  );
}

export default HeroPage;