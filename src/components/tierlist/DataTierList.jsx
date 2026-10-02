import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DeltaBadge from '../ui/DeltaBadge';
import DeltaNote from '../ui/DeltaNote';
import HeroIcon from '../hero/HeroIcon';
import StatsFilters from '../ui/StatsFilters';
import SkeletonGrid from '../ui/SkeletonGrid';
import { TIER_COLORS } from './constants';
import { useHeroes } from '../../hooks/useHeroes';
import { useTranslation } from '../../hooks/useTranslation';
import { formatPickrate, formatWinrate } from '../../services/heroService';
import { MIN_SHARE, SCORE_WEIGHTS, TIER_ORDER, TIER_SHARES, buildTierList } from '../../services/tierService';
import { formatNumber, formatPoints } from '../../services/format';
import { useHeroStore } from '../../store/heroStore';

const percent = (fraction) => Math.round(fraction * 100);

/** Герой в тир-листе по данным: иконка, имя и винрейт; ведёт на страницу героя. */
function TierHero({ entry }) {
  const t = useTranslation();
  const { hero, score, wrPct, prPct } = entry;
  const title = t('tierList.heroTitle', {
    name: hero.name,
    score: percent(score),
    wr: formatWinrate(hero.stats.winrate),
    pr: formatPickrate(hero.stats.pickrate),
    wrPct: percent(wrPct),
    prPct: percent(prPct),
  });

  return (
    <Link to={`/hero/${hero.id}`} className="tier-hero-card tier-hero-card--data" title={title}>
      <HeroIcon hero={hero} size="md" decorative />
      <span className="tier-hero-card__name">{hero.name}</span>
      <span className="tier-hero-card__wr">{formatWinrate(hero.stats.winrate)}</span>
    </Link>
  );
}

/**
 * Тир-лист по данным: оценка = 0,8 × процентиль винрейта + 0,2 × процентиль пикрейта, тиры — по месту в рейтинге
 * (S — первые 10%, A — 20%, B — 40%, C — 20%, D — 10%). Фильтры сайта (период, ранги, режим) пересчитывают его.
 * Формула показана на странице целиком, там же — оценка каждого героя.
 */
function DataTierList() {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const { allHeroes, loading, refreshing, error, hasDeltas, deltaWindow } = useHeroes({ withDelta: true });
  const list = useMemo(() => buildTierList(allHeroes), [allHeroes]);

  if (loading) {
    return (
      <>
        <StatsFilters />
        <SkeletonGrid type="hero" count={12} />
      </>
    );
  }

  if (error) {
    return (
      <>
        <StatsFilters />
        <div className="state-center state-error">{t('common.error')}: {error}</div>
      </>
    );
  }

  const spreadText = list.spread
    ? t('tierList.formulaSpread', {
      best: formatWinrate(list.spread.best),
      worst: formatWinrate(list.spread.worst),
      points: formatPoints(list.spread.best - list.spread.worst).replace('+', ''),
    })
    : null;

  return (
    <>
      <StatsFilters />
      {hasDeltas && <DeltaNote window={deltaWindow} />}

      <div className={refreshing ? 'is-refreshing' : undefined} aria-busy={refreshing}>
        <div className="tierlist-container">
          {TIER_ORDER.map((tier) => (
            <div key={tier} className="tier-row">
              <div className="tier-row__label" style={{ background: TIER_COLORS[tier] }}>{tier}</div>
              <div className="tier-row__container">
                {list.tiers[tier].map((entry) => <TierHero key={entry.hero.id} entry={entry} />)}
                {list.tiers[tier].length === 0 && <div className="tier-row__empty">—</div>}
              </div>
            </div>
          ))}
        </div>

        {list.excluded.length > 0 && (
          <div className="tier-excluded">
            <h2 className="tier-excluded__title">{t('tierList.excludedTitle', { count: list.excluded.length, min: formatNumber(list.minGames, language) })}</h2>
            <div className="tier-excluded__list">
              {list.excluded.map((hero) => (
                <Link key={hero.id} to={`/hero/${hero.id}`} className="tier-excluded__hero">
                  <HeroIcon hero={hero} size="xs" decorative />
                  <span>{hero.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <details className="tier-formula">
        <summary>{t('tierList.formulaTitle')}</summary>
        <ul>
          <li>{t('tierList.formulaScore', { wr: percent(SCORE_WEIGHTS.winrate), pr: percent(SCORE_WEIGHTS.pickrate), count: list.ranked.length })}</li>
          <li>
            {t('tierList.formulaTiers', {
              s: percent(TIER_SHARES[0]), a: percent(TIER_SHARES[1]), b: percent(TIER_SHARES[2]), c: percent(TIER_SHARES[3]), d: percent(TIER_SHARES[4]),
            })}
          </li>
          <li>{t('tierList.formulaSample', { min: formatNumber(list.minGames, language), share: (MIN_SHARE * 100).toFixed(1) })}</li>
          {spreadText && <li>{spreadText}</li>}
          <li>{t('tierList.formulaFilters')}</li>
        </ul>

        <div className="hero-table-wrap">
          <table className="hero-table tier-score-table">
            <thead>
              <tr>
                <th scope="col" className="num">#</th>
                <th scope="col" className="hero-table__hero">{t('heroesPage.colHero')}</th>
                <th scope="col">{t('tierList.colTier')}</th>
                <th scope="col" className="num">{t('tierList.colScore')}</th>
                <th scope="col" className="num">WR</th>
                <th scope="col" className="num">PR</th>
                {hasDeltas && <th scope="col" className="num">Δ WR</th>}
              </tr>
            </thead>
            <tbody>
              {list.ranked.map(({ hero, tier, score, wrPct, prPct, rank }) => (
                <tr key={hero.id}>
                  <td className="num">{rank}</td>
                  <td className="hero-table__hero">
                    <Link to={`/hero/${hero.id}`} className="hero-table__link">
                      <HeroIcon hero={hero} size="sm" decorative />
                      <span className="hero-table__name">{hero.name}</span>
                    </Link>
                  </td>
                  <td><span className="tier-score-table__tier" style={{ background: TIER_COLORS[tier] }}>{tier}</span></td>
                  <td className="num">{percent(score)}</td>
                  <td className="num">{formatWinrate(hero.stats.winrate)} <span className="tier-score-table__pct">p{percent(wrPct)}</span></td>
                  <td className="num">{formatPickrate(hero.stats.pickrate)} <span className="tier-score-table__pct">p{percent(prPct)}</span></td>
                  {hasDeltas && <td className="num"><DeltaBadge delta={hero.delta} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export default DataTierList;
