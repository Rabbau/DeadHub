import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FavoritePlayerCard from '../components/favorites/FavoritePlayerCard';
import HeroIcon from '../components/hero/HeroIcon';
import { useHeroes } from '../hooks/useHeroes';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from '../hooks/useTranslation';
import { useFavoritesStore } from '../store/favoritesStore';
import { useHeroStore } from '../store/heroStore';
import { formatPickrate, formatWinrate, winrateColor } from '../services/heroService';

/**
 * Избранное (адрес /favorites): игроки со сводкой последних матчей и герои с текущей статистикой. Список хранится
 * только в браузере, поэтому страница личная: закрыта от индексации и не входит в sitemap.
 */
function FavoritesPage() {
  const t = useTranslation();
  usePageMeta('favorites', { noindex: true });
  const language = useHeroStore((state) => state.language);
  const { allHeroes } = useHeroes();
  const players = useFavoritesStore((state) => state.players);
  const heroIds = useFavoritesStore((state) => state.heroes);
  const removePlayer = useFavoritesStore((state) => state.removePlayer);
  const toggleHero = useFavoritesStore((state) => state.toggleHero);
  const clear = useFavoritesStore((state) => state.clear);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((hero) => [hero.id, hero])), [allHeroes]);
  const heroes = useMemo(() => heroIds.map((id) => ({ id, hero: heroMap[id] ?? null })), [heroIds, heroMap]);
  const empty = players.length === 0 && heroIds.length === 0;

  // Очистка в два нажатия: второе — подтверждение, а если его нет несколько секунд, кнопка возвращается
  const askClear = () => {
    if (confirming) {
      clear();
      setConfirming(false);
      return;
    }
    setConfirming(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setConfirming(false), 4000);
  };

  return (
    <div className="page favorites-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('favorites.title')} <em>{t('favorites.titleAccent')}</em></h1>
          <div className="page-subtitle">{t('favorites.subtitle')}</div>
        </div>
        {!empty && (
          <button type="button" className={`btn ${confirming ? 'btn-primary' : 'btn-secondary'}`} onClick={askClear}>
            {confirming ? t('favorites.clearConfirm') : t('favorites.clear')}
          </button>
        )}
      </div>

      {empty && (
        <div className="versus-empty-state">
          <h2>{t('favorites.emptyAll')}</h2>
          <p>{t('favorites.emptyPlayers')}</p>
          <p>{t('favorites.emptyHeroes')}</p>
          <div className="favorites-page__cta">
            <Link to="/players" className="btn btn-primary">{t('favorites.findPlayers')}</Link>
            <Link to="/heroes" className="btn btn-secondary">{t('favorites.findHeroes')}</Link>
          </div>
        </div>
      )}

      {players.length > 0 && (
        <section className="section" aria-labelledby="fav-players">
          <h2 className="section__title" id="fav-players">{t('favorites.players')} · {players.length}</h2>
          <div className="fav-grid">
            {players.map((player) => (
              <FavoritePlayerCard key={player.id} player={player} heroMap={heroMap} language={language} onRemove={() => removePlayer(player.id)} />
            ))}
          </div>
        </section>
      )}

      {heroes.length > 0 && (
        <section className="section" aria-labelledby="fav-heroes">
          <h2 className="section__title" id="fav-heroes">{t('favorites.heroes')} · {heroes.length}</h2>
          <ul className="fav-heroes">
            {heroes.map(({ id, hero }) => (
              <li key={id} className="fav-hero">
                <Link to={`/hero/${id}`} className="fav-hero__who">
                  <HeroIcon hero={hero} size="md" decorative />
                  <span className="fav-hero__body">
                    <span className="fav-hero__name">{hero?.name ?? `#${id}`}</span>
                    <span className="fav-hero__stat">
                      {hero && hero.stats.games_played > 0
                        ? t('favorites.heroStats', { pickrate: formatPickrate(hero.stats.pickrate) })
                        : t('favorites.heroNoStats')}
                    </span>
                  </span>
                </Link>
                {hero && hero.stats.games_played > 0 && (
                  <span className={`fav-hero__wr winrate-${winrateColor(hero.stats.winrate)}`} title={t('player.winrate')}>
                    <span className="sr-only">{t('player.winrate')}: </span>{formatWinrate(hero.stats.winrate)}
                  </span>
                )}
                <button type="button" className="fav-card__remove" onClick={() => toggleHero(id)} aria-label={`${t('favorites.remove')}: ${hero?.name ?? id}`} title={t('favorites.remove')}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="favorites-page__privacy">{t('favorites.privacy')}</p>
    </div>
  );
}

export default FavoritesPage;
