import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import MatchupPanel from './MatchupPanel';
import { useHeroes } from '../../hooks/useHeroes';
import { useMatchups } from '../../hooks/useMatchups';
import { useTranslation } from '../../hooks/useTranslation';
import { rankMatchups } from '../../services/matchupService';

const LIMIT = 5;

/** Блок на странице героя: против кого он силён и слаб и с кем лучше всего играет. */
function HeroMatchups({ heroId }) {
  const t = useTranslation();
  const { allHeroes } = useHeroes();
  const { counters, synergy, loading, error } = useMatchups();

  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((h) => [h.id, h])), [allHeroes]);

  const strong = useMemo(() => rankMatchups(counters?.get(heroId), { limit: LIMIT, order: 'desc' }), [counters, heroId]);
  const weak = useMemo(() => rankMatchups(counters?.get(heroId), { limit: LIMIT, order: 'asc' }), [counters, heroId]);
  const partners = useMemo(() => rankMatchups(synergy?.get(heroId), { limit: LIMIT, order: 'desc' }), [synergy, heroId]);

  // Блок вторичный: при сбое запроса страница героя просто обходится без него
  if (error && !counters) return null;

  const linkToHero = (id) => `/hero/${id}`;

  return (
    <div className="section hero-matchups">
      <h2 className="section__title">{t('heroPage.matchups')}</h2>

      {loading && !counters ? (
        <p className="hero-matchups__loading">{t('common.loading')}</p>
      ) : (
        <div className="hero-matchups__grid">
          <MatchupPanel title={t('matchups.strongAgainst')} hint={t('matchups.counterHint')} entries={strong} heroMap={heroMap} linkTo={linkToHero} />
          <MatchupPanel title={t('matchups.weakAgainst')} hint={t('matchups.counterHint')} entries={weak} heroMap={heroMap} linkTo={linkToHero} />
          <MatchupPanel title={t('matchups.bestPartners')} hint={t('matchups.synergyHint')} entries={partners} heroMap={heroMap} linkTo={linkToHero} />
        </div>
      )}

      <Link to={`/matchups?hero=${heroId}`} className="hero-matchups__more">{t('matchups.allMatchups')}</Link>
    </div>
  );
}

export default HeroMatchups;
