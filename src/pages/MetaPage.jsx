import { useMetaDashboard } from '../hooks/useMetaDashboard';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import StatsFilters from '../components/ui/StatsFilters';
import WinnersLosers from '../components/ui/WinnersLosers';
import HeroOfWeekCard from '../components/hero/HeroOfWeekCard';
import HeroRankRow from '../components/hero/HeroRankRow';

function MetaPage() {
  const {
    loading,
    refreshing,
    error,
    allHeroes,
    deltas,
    deltaWindow,
    deltaLoading,
    activeCount,
    topWinrate,
    topPickrate,
    heroOfWeek,
    formatWinrate,
    formatPickrate,
    winrateColor,
  } = useMetaDashboard();
  const t = useTranslation();
  usePageMeta('meta');

  if (loading) {
    return (
      <div className="page state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page meta-page">
        <StatsFilters />
        <div className="state-center state-error">
          {t('common.error')}: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="page meta-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('meta.title')}</h1>
          <div className="page-subtitle">{t('meta.subtitle', { count: activeCount })}</div>
        </div>
      </div>

      <StatsFilters />

      <div className={refreshing ? 'is-refreshing' : undefined} aria-busy={refreshing}>
        {heroOfWeek && (
          <div className="meta-hero-week">
            <h2 className="section__title">{t('meta.heroOfWeek')}</h2>
            <HeroOfWeekCard hero={heroOfWeek} />
          </div>
        )}

        <div className="meta-grid">
          <div className="meta-panel">
            <h2 className="section__title">{t('meta.topWinrate')}</h2>
            <div className="meta-list">
              {topWinrate.map((hero, i) => (
                <HeroRankRow
                  key={hero.id}
                  hero={hero}
                  rank={i + 1}
                  value={formatWinrate(hero.stats.winrate)}
                  valueClass={`winrate-${winrateColor(hero.stats.winrate)}`}
                />
              ))}
            </div>
          </div>

          <div className="meta-panel">
            <h2 className="section__title">{t('meta.topPickrate')}</h2>
            <div className="meta-list">
              {topPickrate.map((hero, i) => (
                <HeroRankRow key={hero.id} hero={hero} rank={i + 1} value={formatPickrate(hero.stats.pickrate)} />
              ))}
            </div>
          </div>
        </div>

        <WinnersLosers heroes={allHeroes} deltas={deltas} window={deltaWindow} loading={deltaLoading} />
      </div>
    </div>
  );
}

export default MetaPage;
