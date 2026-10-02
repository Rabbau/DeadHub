import { Link } from 'react-router-dom';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber } from '../../services/format';
import { formatPickrate, formatWinrate, winrateColor } from '../../services/heroService';

/**
 * Карточка «героя периода»: портрет, имя, винрейт, пикрейт и число матчей. Общая для страницы меты и главной;
 * заголовок раздела выводит тот, кто её показывает.
 * @param {{ hero: { id: number, name: string, image_url?: string, stats: { winrate: number, pickrate: number, games_played: number } } }} props
 */
function HeroOfWeekCard({ hero }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  return (
    <Link to={`/hero/${hero.id}`} className="meta-hero-week__card">
      {hero.image_url ? (
        // Имя героя написано рядом, поэтому у картинки пустой alt: иначе скринридер прочтёт его дважды
        <img src={hero.image_url} alt="" className="meta-hero-week__img" />
      ) : (
        <div className="meta-hero-week__placeholder" aria-hidden="true">{hero.name.slice(0, 2)}</div>
      )}
      <div>
        <div className="meta-hero-week__name">{hero.name}</div>
        <div className="meta-hero-week__stats">
          <span className={`winrate-${winrateColor(hero.stats.winrate)}`}>WR {formatWinrate(hero.stats.winrate)}</span>
          <span>PR {formatPickrate(hero.stats.pickrate)}</span>
          <span>{formatNumber(hero.stats.games_played, language)} {t('meta.matches')}</span>
        </div>
      </div>
    </Link>
  );
}

export default HeroOfWeekCard;
