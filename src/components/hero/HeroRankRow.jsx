import { Link } from 'react-router-dom';

/**
 * Строка рейтинга героев: место, портрет, имя и значение (винрейт или пикрейт).
 * Общая для страницы меты и главной.
 * @param {{ hero: { id: number, name: string, image_url?: string }, rank: number, value: string, valueClass?: string }} props
 */
function HeroRankRow({ hero, rank, value, valueClass = '' }) {
  return (
    <Link to={`/hero/${hero.id}`} className="meta-row">
      <span className="meta-row__rank">#{rank}</span>
      {hero.image_url ? (
        // Имя героя написано рядом, поэтому у картинки пустой alt: иначе скринридер прочтёт его дважды
        <img src={hero.image_url} alt="" className="meta-row__img" />
      ) : (
        <div className="meta-row__placeholder" aria-hidden="true">{hero.name.slice(0, 2)}</div>
      )}
      <span className="meta-row__name">{hero.name}</span>
      <span className={`meta-row__value ${valueClass}`}>{value}</span>
    </Link>
  );
}

export default HeroRankRow;
