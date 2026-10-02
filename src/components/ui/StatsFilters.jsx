import { useId, useMemo, useState } from 'react';
import { useHeroStore } from '../../store/heroStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
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
  MODES,
  PATCH_PERIOD,
  PERIODS,
  RANK_PRESETS,
  activeRankPreset,
  isDefaultFilters,
  isStreetBrawl,
} from '../../services/statsFilters';

// Меньше этого числа матчей в выборке цифры заметно «шумят»
const LOW_SAMPLE_MATCHES = 5000;

// Ширина, до которой панель сворачивается в одну строку-сводку: на телефоне она иначе занимает четверть экрана
const NARROW_QUERY = '(max-width: 720px)';

const TIERS = Array.from({ length: MAX_TIER - MIN_TIER + 1 }, (_, i) => MIN_TIER + i);

/**
 * Период, диапазон рангов и режим игры для всей статистики сайта. Фильтры общие и переживают перезагрузку,
 * поэтому панель можно ставить на любую страницу — она управляет одним и тем же состоянием.
 * Ранги выбираются готовыми диапазонами (один щелчок — один набор запросов) либо двумя списками.
 * Street Brawl рангов не знает, поэтому в этом режиме выбор ранга скрыт.
 * На узком экране панель свёрнута в строку-сводку («С патча · Ранг: Все»), нажатие раскрывает её.
 * `modes={false}` — для страниц, у которых данных по Street Brawl нет (карта): переключатель режима
 * скрыт, а ранги доступны всегда.
 */
function StatsFilters({ modes = true }) {
  const t = useTranslation();
  const ranks = useRanks();
  const { filters, ready } = useStatsFilters();
  const setFilters = useHeroStore((state) => state.setFilters);
  const resetFilters = useHeroStore((state) => state.resetFilters);
  const patch = useHeroStore((state) => state.patch);
  const defaults = useHeroStore((state) => state.defaultFilters);
  const heroes = useHeroStore((state) => state.heroes);
  const loading = useHeroStore((state) => state.loading);
  const language = useHeroStore((state) => state.language);

  const narrow = useMediaQuery(NARROW_QUERY);
  const [openOnNarrow, setOpenOnNarrow] = useState(false);
  const bodyId = useId();

  const sample = useMemo(() => estimateSampleMatches(heroes), [heroes]);

  // Пока определяются фильтры по умолчанию (доли секунды при первом визите), панель не показываем:
  // иначе она мигнула бы значением «30 дней» и тут же переключилась на «с патча»
  if (!ready) return null;

  const rankName = (tier) => findRank(ranks, tier)?.name ?? `#${tier}`;
  const onPatch = filters.period === PATCH_PERIOD;
  const patchLabel = patch ? `${patchName(patch.title)} · ${formatShortDate(patch.at, language)}` : null;
  const rankPreset = activeRankPreset(filters);
  const lowSample = sample > 0 && sample < LOW_SAMPLE_MATCHES;
  const streetBrawl = isStreetBrawl(filters);
  const brawlHere = modes && streetBrawl; // режим действует на этой странице

  const expanded = !narrow || openOnNarrow;
  const periodLabel = onPatch ? t('filters.sincePatch') : t('filters.days', { count: filters.period });
  const rankLabel = rankPreset
    ? t(`filters.presets.${rankPreset}`)
    : `${rankName(filters.rankMin)}–${rankName(filters.rankMax)}`;
  const summary = brawlHere
    ? `${periodLabel} · ${t('filters.modes.street_brawl')}`
    : `${periodLabel} · ${t('filters.rank')}: ${rankLabel}`;

  return (
    <section className="stats-filters" aria-busy={loading}>
      {narrow && (
        <button
          type="button"
          className="stats-filters__toggle"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setOpenOnNarrow((open) => !open)}
        >
          <span className="stats-filters__toggle-title">{t('filters.title')}</span>
          <span className="stats-filters__summary">{summary}</span>
          <span className="stats-filters__chevron" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
        </button>
      )}

      {/* Свёрнутая панель всё равно предупреждает о малой выборке: от неё зависит, можно ли верить цифрам */}
      {!expanded && lowSample && <span className="stats-filters__warn">{t('filters.lowSample')}</span>}

      <div id={bodyId} className="stats-filters__body" hidden={!expanded}>
        {modes && (
          <div className="stats-filters__group" role="group" aria-label={t('filters.mode')}>
            <span className="stats-filters__label" title={t('filters.modeHint')}>{t('filters.mode')}</span>
            <div className="chip-group">
              {MODES.map((mode) => {
                const active = (mode === 'street_brawl') === streetBrawl;
                return (
                  <button
                    key={mode}
                    type="button"
                    className={`chip ${active ? 'active' : ''}`}
                    aria-pressed={active}
                    title={t(`filters.modeTitle.${mode}`)}
                    onClick={() => setFilters({ mode })}
                  >
                    {t(`filters.modes.${mode}`)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        {brawlHere && <p className="stats-filters__note">{t('filters.noRankInBrawl')}</p>}

        {!brawlHere && (
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
        )}

        <div className="stats-filters__meta">
          {onPatch && patchLabel && (
            <span className="stats-filters__patch">{t('filters.patchInfo', { name: patchLabel })}</span>
          )}
          {sample > 0 && (
            <span className="stats-filters__sample">{t('filters.sample', { count: formatCompact(sample, language) })}</span>
          )}
          {lowSample && <span className="stats-filters__warn">{t('filters.lowSample')}</span>}
          {!modes && streetBrawl && <span className="stats-filters__warn">{t('filters.modeIgnored')}</span>}
          {!isDefaultFilters(filters, defaults) && (
            <button type="button" className="stats-filters__reset" onClick={resetFilters}>
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
      </div>
    </section>
  );
}

export default StatsFilters;
