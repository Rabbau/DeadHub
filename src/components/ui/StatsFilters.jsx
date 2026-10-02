import { useMemo } from 'react';
import { useHeroStore } from '../../store/heroStore';
import { useRanks } from '../../hooks/useRanks';
import { useStatsFilters } from '../../hooks/useStatsFilters';
import { useTranslation } from '../../hooks/useTranslation';
import { estimateSampleMatches } from '../../services/heroService';
import { formatCompact, formatShortDate } from '../../services/format';
import { patchName } from '../../services/patchService';
import { findRank } from '../../services/rankService';
import {
  MAX_TIER,
  MIN_TIER,
  PATCH_PERIOD,
  PERIODS,
  RANK_PRESETS,
  activeRankPreset,
  isDefaultFilters,
} from '../../services/statsFilters';

// Меньше этого числа матчей в выборке цифры заметно «шумят»
const LOW_SAMPLE_MATCHES = 5000;

const TIERS = Array.from({ length: MAX_TIER - MIN_TIER + 1 }, (_, i) => MIN_TIER + i);

/**
 * Период и диапазон рангов для всей статистики сайта. Фильтры общие и переживают перезагрузку,
 * поэтому панель можно ставить на любую страницу — она управляет одним и тем же состоянием.
 * Ранги выбираются готовыми диапазонами (один щелчок — один набор запросов) либо двумя списками.
 */
function StatsFilters() {
  const t = useTranslation();
  const ranks = useRanks();
  const { filters, ready } = useStatsFilters();
  const setFilters = useHeroStore((state) => state.setFilters);
  const patch = useHeroStore((state) => state.patch);
  const defaults = useHeroStore((state) => state.defaultFilters);
  const heroes = useHeroStore((state) => state.heroes);
  const loading = useHeroStore((state) => state.loading);
  const language = useHeroStore((state) => state.language);

  const sample = useMemo(() => estimateSampleMatches(heroes), [heroes]);

  // Пока определяются фильтры по умолчанию (доли секунды при первом визите), панель не показываем:
  // иначе она мигнула бы значением «30 дней» и тут же переключилась на «с патча»
  if (!ready) return null;

  const rankName = (tier) => findRank(ranks, tier)?.name ?? `#${tier}`;
  const onPatch = filters.period === PATCH_PERIOD;
  const patchLabel = patch ? `${patchName(patch.title)} · ${formatShortDate(patch.at, language)}` : null;
  const rankPreset = activeRankPreset(filters);

  return (
    <section className="stats-filters" aria-busy={loading}>
      <div className="stats-filters__group" role="group" aria-label={t('filters.period')}>
        <span className="stats-filters__label" title={t('filters.hint')}>{t('filters.period')}</span>
        <div className="chip-group">
          {patch && (
            <button
              type="button"
              className={`chip ${onPatch ? 'active' : ''}`}
              aria-pressed={onPatch}
              title={patchLabel}
              onClick={() => setFilters({ period: PATCH_PERIOD })}
            >
              {t('filters.sincePatch')}
            </button>
          )}
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

      <div className="stats-filters__group" role="group" aria-label={t('filters.rank')}>
        <span className="stats-filters__label" title={t('filters.hint')}>{t('filters.rank')}</span>
        <div className="chip-group">
          {RANK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`chip ${rankPreset === preset.id ? 'active' : ''}`}
              aria-pressed={rankPreset === preset.id}
              title={preset.min === preset.max
                ? rankName(preset.min)
                : t('filters.presetTitle', { from: rankName(preset.min), to: rankName(preset.max) })}
              onClick={() => setFilters({ rankMin: preset.min, rankMax: preset.max })}
            >
              {t(`filters.presets.${preset.id}`)}
            </button>
          ))}
        </div>
        <div className="stats-filters__range">
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
      </div>

      <div className="stats-filters__meta">
        {onPatch && patchLabel && (
          <span className="stats-filters__patch">{t('filters.patchInfo', { name: patchLabel })}</span>
        )}
        {sample > 0 && (
          <span className="stats-filters__sample">{t('filters.sample', { count: formatCompact(sample, language) })}</span>
        )}
        {sample > 0 && sample < LOW_SAMPLE_MATCHES && (
          <span className="stats-filters__warn">{t('filters.lowSample')}</span>
        )}
        {!isDefaultFilters(filters, defaults) && (
          <button type="button" className="stats-filters__reset" onClick={() => setFilters(defaults)}>
            {t('filters.reset')}
          </button>
        )}
      </div>

      <details className="stats-filters__about">
        <summary>{t('filters.about.summary')}</summary>
        <ul>
          <li>{t('filters.about.wr')}</li>
          <li>{t('filters.about.pr')}</li>
          <li>{t('filters.about.sample')}</li>
          <li>{t('filters.about.rank')}</li>
        </ul>
      </details>
    </section>
  );
}

export default StatsFilters;
