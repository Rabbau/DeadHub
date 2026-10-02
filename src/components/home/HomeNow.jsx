import { Link } from 'react-router-dom';
import HeroOfWeekCard from '../hero/HeroOfWeekCard';
import HeroRankRow from '../hero/HeroRankRow';
import { useStatsFilters } from '../../hooks/useStatsFilters';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatAge, formatShortDate } from '../../services/format';
import { HOME_TOP_COUNT, summarizeFilters } from '../../services/homeService';
import { patchName } from '../../services/patchService';

/** Последнее обновление игры. Список обновлений грузит шапка на любой странице, поэтому лишних запросов нет. */
function LatestUpdate({ patch }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  return (
    <div className="home-block">
      <h3 className="home-block__label">{t('home.latestUpdate')}</h3>
      <Link to="/update" className="home-update">
        <span className="home-update__name">{patchName(patch.title)}</span>
        <span className="home-update__meta">{formatShortDate(patch.at, language)} · {formatAge(patch.at, language)}</span>
        <span className="home-update__go">{t('home.patchNotes')} →</span>
      </Link>
    </div>
  );
}

/** Пока статистика грузится, на месте рейтингов — серые строки той же высоты: страница не прыгает. */
function ListsSkeleton() {
  return (
    <div className="meta-grid" aria-hidden="true">
      {[0, 1].map((panel) => (
        <div key={panel} className="meta-panel">
          {Array.from({ length: HOME_TOP_COUNT }, (_, index) => <div key={index} className="skeleton home-skeleton-row" />)}
        </div>
      ))}
    </div>
  );
}

/**
 * «Сейчас»: герой периода, последнее обновление и два коротких рейтинга. Цифры — те же, что на странице меты,
 * с теми же общими фильтрами, поэтому подпись называет период и ранги, а ссылка ведёт туда, где их можно сменить.
 * Данные приходят от родителя: тот же список героев нужен и полосе новых героев.
 * @param {{ dashboard: ReturnType<typeof import('../../hooks/useMetaDashboard').useMetaDashboard> }} props
 */
function HomeNow({ dashboard }) {
  const t = useTranslation();
  const { filters, ready } = useStatsFilters();
  const patch = useHeroStore((state) => state.patch);
  const { loading, error, topWinrate, topPickrate, heroOfWeek, formatWinrate, formatPickrate, winrateColor } = dashboard;

  return (
    <section className="section home-now" aria-busy={loading}>
      <h2 className="section__title">{t('home.nowTitle')}</h2>
      {/* Пока определяются фильтры (доли секунды при первом визите), подпись не показываем: она бы сменилась на ходу */}
      {ready && (
        <p className="home-now__caption">
          {t('home.nowCaption', { filters: summarizeFilters(filters, t) })} · <Link to="/meta">{t('home.metaLink')} →</Link>
        </p>
      )}

      {(heroOfWeek || patch) && (
        <div className="home-feature">
          {heroOfWeek && (
            <div className="home-block">
              <h3 className="home-block__label">{t('meta.heroOfWeek')}</h3>
              <HeroOfWeekCard hero={heroOfWeek} />
            </div>
          )}
          {patch && <LatestUpdate patch={patch} />}
        </div>
      )}

      {loading && <ListsSkeleton />}
      {!loading && error && (
        <div className="state-center state-error">
          {t('common.error')}: {error}
        </div>
      )}
      {!loading && !error && (
        <div className="meta-grid">
          <div className="meta-panel">
            <h3 className="section__title">{t('meta.topWinrate')}</h3>
            <div className="meta-list">
              {topWinrate.slice(0, HOME_TOP_COUNT).map((hero, index) => (
                <HeroRankRow
                  key={hero.id}
                  hero={hero}
                  rank={index + 1}
                  value={formatWinrate(hero.stats.winrate)}
                  valueClass={`winrate-${winrateColor(hero.stats.winrate)}`}
                />
              ))}
            </div>
          </div>

          <div className="meta-panel">
            <h3 className="section__title">{t('meta.topPickrate')}</h3>
            <div className="meta-list">
              {topPickrate.slice(0, HOME_TOP_COUNT).map((hero, index) => (
                <HeroRankRow key={hero.id} hero={hero} rank={index + 1} value={formatPickrate(hero.stats.pickrate)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default HomeNow;
