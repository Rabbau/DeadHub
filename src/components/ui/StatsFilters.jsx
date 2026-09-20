import { useMemo } from 'react';
import { useHeroStore } from '../../store/heroStore';
import { useRanks } from '../../hooks/useRanks';
import { useTranslation } from '../../hooks/useTranslation';
import { estimateSampleMatches } from '../../services/heroService';
import { formatCompact } from '../../services/format';
import { findRank } from '../../services/rankService';
import {
  DEFAULT_FILTERS,
  MAX_TIER,
  MIN_TIER,
  PERIODS,
  isDefaultFilters,
} from '../../services/statsFilters';

// Меньше этого числа матчей в выборке цифры заметно «шумят»
const LOW_SAMPLE_MATCHES = 5000;

const TIERS = Array.from({ length: MAX_TIER - MIN_TIER + 1 }, (_, i) => MIN_TIER + i);

/**
 * Период и диапазон рангов для всей статистики сайта. Фильтры общие и переживают перезагрузку,
 * поэтому панель можно ставить на любую страницу — она управляет одним и тем же состоянием.
 */
function StatsFilters() {
  const t = useTranslation();
  const ranks = useRanks();
  const filters = useHeroStore((state) => state.filters);
  const setFilters = useHeroStore((state) => state.setFilters);
  const heroes = useHeroStore((state) => state.heroes);
  const loading = useHeroStore((state) => state.loading);
  const language = useHeroStore((state) => state.language);

  const sample = useMemo(() => estimateSampleMatches(heroes), [heroes]);
  const rankName = (tier) => findRank(ranks, tier)?.name ?? `#${tier}`;

  return (
    <section className="stats-filters" aria-busy={loading}>
      <div className="stats-filters__group" role="group" aria-label={t('filters.period')}>
        <span className="stats-filters__label" title={t('filters.hint')}>{t('filters.period')}</span>
        <div className="chip-group">
          {PERIODS.map((days) => (
            <button
              key={days}
              type="button"
              className={`chip ${filters.period === days ? 'active' : ''}`}
              aria-pressed={filters.period === days}
              onClick={() => setFilters({ period: days })}
            >
              {t('filters.days', { count: days })}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-filters__group">
        <span className="stats-filters__label" title={t('filters.hint')}>{t('filters.rank')}</span>
        <select
          className="select"
          aria-label={t('filters.rankFrom')}
          value={filters.rankMin}
          onChange={(e) => setFilters({ rankMin: Number(e.target.value) })}
        >
          {TIERS.filter((tier) => tier <= filters.rankMax).map((tier) => (
            <option key={tier} value={tier}>{rankName(tier)}</option>
          ))}
        </select>
        <span className="stats-filters__dash" aria-hidden="true">–</span>
        <select
          className="select"
          aria-label={t('filters.rankTo')}
          value={filters.rankMax}
          onChange={(e) => setFilters({ rankMax: Number(e.target.value) })}
        >
          {TIERS.filter((tier) => tier >= filters.rankMin).map((tier) => (
            <option key={tier} value={tier}>{rankName(tier)}</option>
          ))}
        </select>
      </div>

      <div className="stats-filters__meta">
        {sample > 0 && (
          <span className="stats-filters__sample">{t('filters.sample', { count: formatCompact(sample, language) })}</span>
        )}
        {sample > 0 && sample < LOW_SAMPLE_MATCHES && (
          <span className="stats-filters__warn">{t('filters.lowSample')}</span>
        )}
        {!isDefaultFilters(filters) && (
          <button type="button" className="stats-filters__reset" onClick={() => setFilters(DEFAULT_FILTERS)}>
            {t('filters.reset')}
          </button>
        )}
      </div>
    </section>
  );
}

export default StatsFilters;
