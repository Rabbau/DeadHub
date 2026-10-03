import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { HOME_SECTIONS, tileNumber } from '../../services/homeService';

/**
 * Оглавление сайта: номер, название и одна строка о том, что внутри. Половина инструментов спрятана в меню под
 * «Ещё», а в оглавлении видны все; плитки выше показывают лишь часть из них.
 */
function HomeSections() {
  const t = useTranslation();

  return (
    <section className="section">
      <h2 className="section__title">{t('home.sectionsTitle')}</h2>
      <ol className="home-index">
        {HOME_SECTIONS.map((section, index) => (
          <li key={section.id}>
            <Link to={section.to} className="home-index__item">
              <span className="home-index__num" aria-hidden="true">{tileNumber(index)}</span>
              <span className="home-index__name">{t(section.nameKey)}</span>
              <span className="home-index__text">{t(`home.sections.${section.id}`)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default HomeSections;
