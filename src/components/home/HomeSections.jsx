import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { HOME_SECTIONS, tileNumber } from '../../services/homeService';

/**
 * Плитки разделов сайта: название, одна строка о том, что внутри, и номер для оформления. Половина инструментов
 * спрятана в меню под «Ещё», а на плитках видны все.
 */
function HomeSections() {
  const t = useTranslation();

  return (
    <section className="section">
      <h2 className="section__title">{t('home.sectionsTitle')}</h2>
      <div className="home-tiles">
        {HOME_SECTIONS.map((section, index) => (
          <Link key={section.id} to={section.to} className="home-tile">
            <span className="home-tile__num" aria-hidden="true">{tileNumber(index)}</span>
            <span className="home-tile__name">{t(section.nameKey)}</span>
            <span className="home-tile__text">{t(`home.sections.${section.id}`)}</span>
            <span className="home-tile__go" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default HomeSections;
