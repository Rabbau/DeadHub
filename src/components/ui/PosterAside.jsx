import { posterOfTheDay } from '../../data/heroArt';

/**
 * Украшение для почти пустых страниц (поиск игрока, «Мой профиль»): постер героя дня справа от формы.
 * Только на широком экране (см. .poster-aside в index.css); смысла в нём нет, поэтому скринридер его пропускает.
 */
function PosterAside() {
  return (
    <figure className="poster-aside" aria-hidden="true">
      <img src={posterOfTheDay()} alt="" width="640" height="640" loading="lazy" decoding="async" />
    </figure>
  );
}

export default PosterAside;
