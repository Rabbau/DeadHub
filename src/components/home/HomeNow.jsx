import { Link } from 'react-router-dom';
import HeroRankRow from '../hero/HeroRankRow';
import { useStatsFilters } from '../../hooks/useStatsFilters';
import { useTranslation } from '../../hooks/useTranslation';
import { HOME_TOP_COUNT, summarizeFilters } from '../../services/homeService';

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
 * «Сейчас»: два коротких рейтинга героев. Цифры — те же, что на странице меты, с теми же общими фильтрами,
 * поэтому подпись называет период и ранги, а ссылка ведёт туда, где их можно сменить. Герой периода и последнее
 * обновление показаны плитками выше. Данные приходят от родителя: те же герои нужны полосе новых героев и плиткам.
 * @param {{ dashboard: ReturnType<typeof import('../../hooks/useMetaDashboard').useMetaDashboard> }} props
 */
function HomeNow({ dashboard }) {
  const t = useTranslation();
  const { filters, ready } = useStatsFilters();
  const { loading, error, topWinrate, topPickrate, formatWinrate, formatPickrate, winrateColor } = dashboard;

  return (
    <section className="section home-now" aria-busy={loading}>
      <h2 className="section__title">{t('home.nowTitle')}</h2>
      {/* Пока определяются фильтры (доли секунды при первом визите), подпись не показываем: она бы сменилась на ходу */}
      {ready && (
        <p className="home-now__caption">
          {t('home.nowCaption', { filters: summarizeFilters(filters, t) })} · <Link to="/meta">{t('home.metaLink')} →</Link>
        </p>
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
