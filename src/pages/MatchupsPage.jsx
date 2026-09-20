import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHeroes } from '../hooks/useHeroes';
import { useMatchups } from '../hooks/useMatchups';
import { useTranslation } from '../hooks/useTranslation';
import StatsFilters from '../components/ui/StatsFilters';
import HeroIcon from '../components/hero/HeroIcon';
import MatchupPanel from '../components/matchups/MatchupPanel';
import MatchupMatrix from '../components/matchups/MatchupMatrix';
import { rankMatchups } from '../services/matchupService';
import { formatWinrate, formatPickrate, winrateColor } from '../services/heroService';

const LIMIT = 8;

function MatchupsPage() {
  const t = useTranslation();
  const [params, setParams] = useSearchParams();
  const { allHeroes, loading: heroesLoading, error: heroesError } = useHeroes();
  const { counters, synergy, loading: matchupsLoading, error: matchupsError } = useMatchups();

  const released = useMemo(
    () => allHeroes.filter((h) => h.released).sort((a, b) => a.name.localeCompare(b.name)),
    [allHeroes],
  );
  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((h) => [h.id, h])), [allHeroes]);

  const view = params.get('view') === 'matrix' ? 'matrix' : 'hero';

  // Без выбранного героя открываем самого играемого — сразу есть что показать
  const defaultHero = useMemo(
    () => [...released].sort((a, b) => b.stats.pickrate - a.stats.pickrate)[0] ?? null,
    [released],
  );
  const requested = heroMap[Number(params.get('hero'))];
  const selected = requested?.released ? requested : defaultHero;

  // Сетка выбора занимает много места — после клика показываем результат выбранного героя
  const heroCardRef = useRef(null);
  const pickHero = (id) => {
    setParams({ hero: id });
    heroCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const changeView = (next) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === 'matrix') p.set('view', 'matrix');
      else p.delete('view');
      return p;
    });
  };

  const lists = useMemo(() => {
    if (!selected) return null;
    return {
      strong: rankMatchups(counters?.get(selected.id), { limit: LIMIT, order: 'desc' }),
      weak: rankMatchups(counters?.get(selected.id), { limit: LIMIT, order: 'asc' }),
      best: rankMatchups(synergy?.get(selected.id), { limit: LIMIT, order: 'desc' }),
      worst: rankMatchups(synergy?.get(selected.id), { limit: LIMIT, order: 'asc' }),
    };
  }, [selected, counters, synergy]);

  const header = (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('matchups.title')}</h1>
          <div className="page-subtitle">{t('matchups.subtitle')}</div>
        </div>
      </div>
      <StatsFilters />
    </>
  );

  if (heroesLoading || (matchupsLoading && !counters)) {
    return (
      <div className="page matchups-page">
        {header}
        <div className="state-center">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const error = heroesError || (!counters && matchupsError);
  if (error) {
    return (
      <div className="page matchups-page">
        {header}
        <div className="state-center state-error">
          {t('common.error')}: {error}
        </div>
      </div>
    );
  }

  // Клик по строке переключает страницу на этого героя (и остаётся в истории браузера)
  const linkTo = (id) => `/matchups?hero=${id}`;

  return (
    <div className="page matchups-page">
      {header}

      <div className="chip-group matchups-tabs" role="group">
        {['hero', 'matrix'].map((key) => (
          <button
            key={key}
            type="button"
            className={`chip ${view === key ? 'active' : ''}`}
            aria-pressed={view === key}
            onClick={() => changeView(key)}
          >
            {t(key === 'hero' ? 'matchups.viewHero' : 'matchups.viewMatrix')}
          </button>
        ))}
      </div>

      {view === 'matrix' ? (
        <MatchupMatrix heroes={released} counters={counters} />
      ) : (
        <>
          <div className="matchup-picker" role="group" aria-label={t('matchups.pickHero')}>
            {released.map((hero) => (
              <button
                key={hero.id}
                type="button"
                className={`matchup-pick ${selected?.id === hero.id ? 'selected' : ''}`}
                aria-pressed={selected?.id === hero.id}
                aria-label={hero.name}
                title={hero.name}
                onClick={() => pickHero(hero.id)}
              >
                <HeroIcon hero={hero} size="md" decorative />
                <span>{hero.name}</span>
              </button>
            ))}
          </div>

          {selected && (
            <>
              <div className="matchup-hero" ref={heroCardRef}>
                {selected.image_url && <img src={selected.image_url} alt="" className="matchup-hero__img" />}
                <div>
                  <div className="matchup-hero__name">{selected.name}</div>
                  <div className="matchup-hero__stats">
                    <span className={`winrate-${winrateColor(selected.stats.winrate)}`}>
                      {t('matchups.overall')} {formatWinrate(selected.stats.winrate)}
                    </span>
                    <span>PR {formatPickrate(selected.stats.pickrate)}</span>
                  </div>
                </div>
              </div>

              <div className="matchups-grid">
                <MatchupPanel title={t('matchups.strongAgainst')} hint={t('matchups.counterHint')} entries={lists.strong} heroMap={heroMap} linkTo={linkTo} />
                <MatchupPanel title={t('matchups.weakAgainst')} hint={t('matchups.counterHint')} entries={lists.weak} heroMap={heroMap} linkTo={linkTo} />
                <MatchupPanel title={t('matchups.bestPartners')} hint={t('matchups.synergyHint')} entries={lists.best} heroMap={heroMap} linkTo={linkTo} />
                <MatchupPanel title={t('matchups.worstPartners')} hint={t('matchups.synergyHint')} entries={lists.worst} heroMap={heroMap} linkTo={linkTo} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default MatchupsPage;
