import { useRef } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { requestSearch } from '../layout/searchEvents';

/**
 * Баннер главной: название, одна фраза о сайте и большая кнопка поиска. Кнопка не содержит поля ввода:
 * она открывает то же окно поиска, что и кнопка в шапке и клавиша «/» (его код подгружается отдельно),
 * поэтому поиск на главной ищет по тем же героям, предметам, разделам и игрокам.
 */
function HomeHero() {
  const t = useTranslation();
  const buttonRef = useRef(null);

  return (
    <section className="home-hero">
      <span className="tag tag--role">{t('home.eyebrow')}</span>
      <h1 className="home-hero__title">
        {t('home.title')} <em>{t('home.titleAccent')}</em>
      </h1>
      <p className="home-hero__lead">{t('home.lead')}</p>
      <button
        ref={buttonRef}
        type="button"
        className="home-search"
        aria-haspopup="dialog"
        aria-keyshortcuts="/"
        onClick={() => requestSearch(buttonRef.current)}
      >
        <span className="home-search__prompt" aria-hidden="true">&gt;</span>
        <span className="home-search__text">
          <span className="sr-only">{t('search.open')}: </span>
          {t('search.placeholder')}
        </span>
        <kbd className="home-search__key" aria-hidden="true">/</kbd>
      </button>
    </section>
  );
}

export default HomeHero;
