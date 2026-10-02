import { Link } from 'react-router-dom';
import ReleaseCountdown from './ReleaseCountdown';
import { useTranslation } from '../../hooks/useTranslation';
import { CURRENT_UPDATE, OFFICIAL_UPDATE_URL } from '../../data/updates';

/**
 * Страница героя, которого ещё нет в игре. В данных у таких героев стоят заглушки (одинаковые 780 HP
 * и оружие Infernus), поэтому характеристики, способности и статистику не показываем вовсе.
 */
function UpcomingHero({ hero }) {
  const t = useTranslation();
  // Для героя, которого ещё нет в игре, image_url — это стикер голосования
  const art = hero.image_url;

  return (
    <div className="hero-page-wrapper" style={{ position: 'relative', minHeight: '100vh' }}>
      <div
        className="hero-page-bg"
        style={{
          position: 'absolute',
          inset: 0,
          background: hero.color ? `radial-gradient(ellipse at 30% 20%, ${hero.color} 0%, transparent 70%)` : 'none',
          opacity: 0.08,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="page" style={{ position: 'relative', zIndex: 1 }}>
        <Link to="/heroes" className="back-link">{t('heroPage.back')}</Link>

        <div className="hero-detail">
          <div
            className="hero-detail__portrait hero-detail__portrait--sticker"
            style={hero.color ? { '--hero-color': hero.color } : undefined}
          >
            {art ? <img src={art} alt={hero.name} /> : <div className="hero-detail__portrait-placeholder">{hero.name.slice(0, 2)}</div>}
          </div>

          <div className="hero-detail__info">
            <h1 className="hero-detail__name">{hero.name}</h1>
            <div className="hero-detail__meta">
              <span className="tag tag--complexity">{t('newHeroes.soon')}</span>
              <span className="tag">{CURRENT_UPDATE.name}</span>
            </div>

            <div className="upcoming-box">
              <h2 className="section__title">{t('newHeroes.notOutTitle')}</h2>
              <p className="upcoming-box__text">{t('newHeroes.notOutText')}</p>
              <ReleaseCountdown />
              <div className="update-hero__actions">
                <Link className="btn btn-secondary" to="/update">{t('newHeroes.aboutUpdate')}</Link>
                <a className="btn btn-secondary" href={OFFICIAL_UPDATE_URL} target="_blank" rel="noopener noreferrer">
                  {t('update.openOfficial')} ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpcomingHero;
