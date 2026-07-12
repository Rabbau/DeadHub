import { Link } from 'react-router-dom';
import { useMetaDashboard } from '../hooks/useMetaDashboard';
import { useTranslation } from '../hooks/useTranslation';

function MetaPage() {
  const {
    loading,
    error,
    activeCount,
    topWinrate,
    topPickrate,
    heroOfWeek,
    formatWinrate,
    formatPickrate,
    winrateColor,
  } = useMetaDashboard();
  const t = useTranslation();

  if (loading) {
    return (
      <div className="page state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-center state-error">
        ⚠️ {t('common.error')}: {error}
      </div>
    );
  }

  const renderHeroRow = (hero, rank, value, valueClass) => (
    <Link to={`/hero/${hero.id}`} key={hero.id} className="meta-row">
      <span className="meta-row__rank">#{rank}</span>
      {hero.image_url ? (
        <img src={hero.image_url} alt={hero.name} className="meta-row__img" />
      ) : (
        <div className="meta-row__placeholder">{hero.name.slice(0, 2)}</div>
      )}
      <span className="meta-row__name">{hero.name}</span>
      <span className={`meta-row__value ${valueClass || ''}`}>{value}</span>
    </Link>
  );

  return (
    <div className="page meta-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('meta.title')}</h1>
          <div className="page-subtitle">{t('meta.subtitle', { count: activeCount })}</div>
        </div>
      </div>

      {heroOfWeek && (
        <div className="meta-hero-week">
          <h2 className="section__title">{t('meta.heroOfWeek')}</h2>
          <Link to={`/hero/${heroOfWeek.id}`} className="meta-hero-week__card">
            {heroOfWeek.image_url ? (
              <img src={heroOfWeek.image_url} alt={heroOfWeek.name} className="meta-hero-week__img" />
            ) : (
              <div className="meta-hero-week__placeholder">{heroOfWeek.name.slice(0, 2)}</div>
            )}
            <div>
              <div className="meta-hero-week__name">{heroOfWeek.name}</div>
              <div className="meta-hero-week__stats">
                <span className={`winrate-${winrateColor(heroOfWeek.stats.winrate)}`}>
                  WR {formatWinrate(heroOfWeek.stats.winrate)}
                </span>
                <span>PR {formatPickrate(heroOfWeek.stats.pickrate)}</span>
                <span>{heroOfWeek.stats.games_played.toLocaleString()} {t('meta.matches')}</span>
              </div>
            </div>
          </Link>
        </div>
      )}

      <div className="meta-grid">
        <div className="meta-panel">
          <h2 className="section__title">{t('meta.topWinrate')}</h2>
          <div className="meta-list">
            {topWinrate.map((hero, i) =>
              renderHeroRow(
                hero,
                i + 1,
                formatWinrate(hero.stats.winrate),
                `winrate-${winrateColor(hero.stats.winrate)}`,
              ),
            )}
          </div>
        </div>

        <div className="meta-panel">
          <h2 className="section__title">{t('meta.topPickrate')}</h2>
          <div className="meta-list">
            {topPickrate.map((hero, i) =>
              renderHeroRow(hero, i + 1, formatPickrate(hero.stats.pickrate)),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MetaPage;
