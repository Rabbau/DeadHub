import { useParams, Link } from 'react-router-dom';
import { useHeroDetail } from '../hooks/useHeroDetail';
import { formatWinrate, formatPickrate, winrateColor } from '../services/heroService';
import { useHeroStore } from '../store/heroStore';
import { useTranslation } from '../hooks/useTranslation';
import SkeletonGrid from '../components/ui/SkeletonGrid';

function getAbilityDescription(ability) {
  const desc = ability.description;
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (typeof desc === 'object') {
    return desc.desc || desc.active || desc.passive || '';
  }
  return '';
}

function HeroPage() {
  const { id } = useParams();
  const language = useHeroStore(state => state.language);
  const { hero, loading, error } = useHeroDetail(id, language);
  const t = useTranslation();

  if (loading) {
    return (
      <div className="page">
        <div className="hero-detail">
          <div className="skeleton skeleton-portrait" />
          <div>
            <div className="skeleton" style={{ height: 40, width: '50%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 24, width: '25%', marginBottom: 24 }} />
            <div className="skeleton" style={{ height: 80, width: '100%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !hero) {
    return (
      <div className="state-center state-error">
        ⚠️ {t('common.error')}: {error || t('heroPage.noHeroFound')}
      </div>
    );
  }

  const wrColor = winrateColor(hero.stats.winrate);

  return (
    <div className="page">
      <Link to="/" className="back-link">{t('heroPage.back')}</Link>

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
              <div className="stat-card__label">{t('heroPage.winrate')}</div>
              <div className={`stat-card__value winrate-${wrColor}`}>
                {hero.stats.games_played > 0 ? formatWinrate(hero.stats.winrate) : '—'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">{t('heroPage.pickrate')}</div>
              <div className="stat-card__value">
                {hero.stats.games_played > 0 ? formatPickrate(hero.stats.pickrate) : '—'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">{t('heroPage.matches')}</div>
              <div className="stat-card__value">{hero.stats.games_played.toLocaleString()}</div>
            </div>
          </div>

          {hero.description && (
            <p className="hero-detail__description">{hero.description}</p>
          )}

          <div className="section">
            <h2 className="section__title">{t('heroPage.abilities')}</h2>
            {hero.abilities && hero.abilities.length > 0 ? (
              <div className="abilities-list">
                {hero.abilities.map((ability, idx) => {
                  const descText = getAbilityDescription(ability);
                  return (
                    <div className="ability-card" key={idx}>
                      {ability.image_url ? (
                        <img
                          src={ability.image_url}
                          alt={ability.name}
                          className="ability-card__icon-img"
                        />
                      ) : (
                        <div className="ability-card__icon">{ability.name.slice(0, 2)}</div>
                      )}
                      <div>
                        <div className="ability-card__name">{ability.name}</div>
                        {descText && (
                          <div
                            className="ability-card__desc"
                            dangerouslySetInnerHTML={{ __html: descText }}
                          />
                        )}
                        {(ability.cooldown || ability.cast_range) && (
                          <div className="ability-card__meta">
                            {ability.cooldown && <span>⏱ {ability.cooldown}</span>}
                            {ability.cast_range && <span>📏 {ability.cast_range}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>
                {t('heroPage.noAbilities')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroPage;