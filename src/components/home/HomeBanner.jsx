import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { CURRENT_UPDATE } from '../../data/updates';
import { formatShortDate } from '../../services/format';
import { bannerArt, updateDate } from '../../services/homeService';

/**
 * Баннер главной по мотивам страницы обновления на playdeadlock.com: ночной город, плакат с названием
 * обновления и постеры новых героев. Пока обновление свежее (data/updates.js), арты его; потом остаётся тот же
 * баннер без плаката и постеров. Поиск живёт в плитке ниже, а здесь — два главных действия: заметки к патчу
 * и срез меты. Постеры подгружаются лениво и на телефоне скрыты, чтобы не тратить трафик.
 */
function HomeBanner() {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const art = bannerArt();

  return (
    <section className={`home-banner${art ? '' : ' home-banner--plain'}`} aria-labelledby="home-title">
      <div className="home-banner__inner">
        {art && (
          <div className="home-banner__poster">
            <img className="home-banner__title" src={art.title} alt={CURRENT_UPDATE.name} width="1100" height="625" />
            <img className="home-banner__plate" src={art.plate} alt="" width="520" height="255" />
          </div>
        )}

        <div className="home-banner__copy">
          <span className="tag tag--yellow">
            {art ? t('home.updateKicker', { date: formatShortDate(updateDate(), language) }) : t('home.eyebrow')}
          </span>
          <h1 id="home-title" className="home-banner__h1">
            {t('home.title')} <em>{t('home.titleAccent')}</em>
          </h1>
          <p className="home-banner__lead">{t('home.lead')}</p>
          <div className="home-banner__cta">
            <Link to="/update" className="btn btn-primary">{t('home.patchNotes')}</Link>
            <Link to="/meta" className="btn btn-secondary">{t('home.ctaMeta')}</Link>
          </div>
        </div>

        {art && <img className="home-banner__heroes" src={art.heroes} alt="" loading="lazy" width="1400" height="656" />}
      </div>
    </section>
  );
}

export default HomeBanner;
