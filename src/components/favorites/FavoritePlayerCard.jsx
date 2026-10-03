import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroIcon from '../hero/HeroIcon';
import Avatar from '../ui/Avatar';
import RankBadge from '../ui/RankBadge';
import { fetchPlayerCard } from '../../api/index.js';
import { useInView } from '../../hooks/useInView';
import { useTranslation } from '../../hooks/useTranslation';
import { CARD_STRIP } from '../../services/favoritesCardService';
import { formatAge, formatMatchDate } from '../../services/format';
import { formatWinrate, winrateColor } from '../../services/heroService';

/**
 * Карточка избранного игрока: ранг, когда играл, последние пять результатов, форма за двадцать матчей, серия и
 * любимые герои. Сводка загружается, когда карточка подошла к экрану: это один запрос на игрока, и для списка из
 * двенадцати человек не все они нужны сразу.
 * @param {{ player: { id: number, name: string|null, avatar: string|null }, heroMap: Record<number, any>, language: string, onRemove: () => void }} props
 */
function FavoritePlayerCard({ player, heroMap, language, onRemove }) {
  const t = useTranslation();
  const ref = useRef(null);
  const seen = useInView(ref);
  const [card, setCard] = useState({ state: 'idle', data: null });

  useEffect(() => {
    if (!seen) return undefined;
    let cancelled = false;
    setCard({ state: 'loading', data: null });
    fetchPlayerCard(player.id)
      .then((data) => { if (!cancelled) setCard({ state: 'ready', data }); })
      .catch(() => { if (!cancelled) setCard({ state: 'error', data: null }); });
    return () => { cancelled = true; };
  }, [seen, player.id]);

  const data = card.data;
  const name = player.name ?? `#${player.id}`;

  return (
    <article ref={ref} className="fav-card" aria-label={name}>
      <header className="fav-card__head">
        <Link to={`/player/${player.id}`} className="fav-card__who">
          <Avatar src={player.avatar} name={name} size="lg" />
          <span className="fav-card__name">{name}</span>
        </Link>
        <button type="button" className="fav-card__remove" onClick={onRemove} aria-label={`${t('favorites.remove')}: ${name}`} title={t('favorites.remove')}>✕</button>
      </header>

      {card.state === 'error' ? (
        <p className="fav-card__hint">{t('favorites.cardError')}</p>
      ) : !data ? (
        <p className="fav-card__hint">{t('favorites.loading')}</p>
      ) : data.lastMatchAt == null ? (
        <p className="fav-card__hint">{t('favorites.noMatches')}</p>
      ) : (
        <>
          {data.badge && <div className="fav-card__rank"><RankBadge badge={data.badge} /></div>}
          <p className="fav-card__last" title={formatMatchDate(data.lastMatchAt, language)}>
            {t('favorites.lastMatch', { date: formatAge(data.lastMatchAt, language) })}
          </p>
          <ol className="form-strip form-strip--small" aria-label={t('favorites.results')}>
            {data.results.slice(0, CARD_STRIP).map((win, index) => (
              <li key={index} className={`form-strip__cell ${win ? 'is-win' : 'is-loss'}`}>
                <span className="sr-only">{win ? t('favorites.win') : t('favorites.loss')}</span>
                <span aria-hidden="true">{win ? t('player.win') : t('player.loss')}</span>
              </li>
            ))}
          </ol>
          {data.recent.matches > 0 && (
            <p className={`fav-card__form winrate-${winrateColor(data.recent.winrate)}`}>
              {t('favorites.form', { count: data.recent.matches, winrate: formatWinrate(data.recent.winrate) })}
            </p>
          )}
          {data.streak && data.streak.length >= 3 && (
            <span className={`tag ${data.streak.win ? 'tag--green' : 'tag--bad'}`}>
              {t(data.streak.win ? 'favorites.streakWin' : 'favorites.streakLoss', { count: data.streak.length })}
            </span>
          )}
          {data.heroes.length > 0 && (
            <div className="fav-card__heroes">
              {data.heroes.map((heroId) => (
                <Link key={heroId} to={`/hero/${heroId}`} title={heroMap[heroId]?.name ?? `#${heroId}`}>
                  <HeroIcon hero={heroMap[heroId]} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <footer className="fav-card__foot">
        <Link to={`/player/${player.id}`} className="cx-link">{t('favorites.openProfile')}</Link>
        <Link to={`/versus?a=${player.id}`} className="cx-link">{t('favorites.compare')}</Link>
      </footer>
    </article>
  );
}

export default FavoritePlayerCard;
