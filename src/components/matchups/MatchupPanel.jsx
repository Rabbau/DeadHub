import { Link } from 'react-router-dom';
import HeroIcon from '../hero/HeroIcon';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatCompact } from '../../services/format';
import { formatWinrate, winrateColor } from '../../services/heroService';

/**
 * Список героев со статистикой пары: винрейт и число матчей.
 * entries — результат rankMatchups(); linkTo(id) задаёт, куда ведёт строка.
 */
function MatchupPanel({ title, hint, entries, heroMap, linkTo }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  return (
    <div className="meta-panel matchup-panel">
      <h3 className="section__title" title={hint}>{title}</h3>

      {entries.length === 0 ? (
        <p className="matchup-panel__empty">{t('matchups.noData')}</p>
      ) : (
        <div className="meta-list">
          {entries.map((entry) => {
            const hero = heroMap[entry.id];
            if (!hero) return null;
            return (
              <Link key={entry.id} to={linkTo(entry.id)} className="meta-row matchup-row">
                <HeroIcon hero={hero} size="sm" decorative />
                <span className="meta-row__name">{hero.name}</span>
                <span className="matchup-row__matches" title={t('matchups.matches')}>
                  {formatCompact(entry.matches, language)}
                </span>
                <span className={`meta-row__value winrate-${winrateColor(entry.wr)}`}>{formatWinrate(entry.wr)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MatchupPanel;
