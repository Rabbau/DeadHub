import { Link } from 'react-router-dom';
import RankBadge from '../components/ui/RankBadge';
import { useRankDistribution } from '../hooks/useRankDistribution';
import { useRanks } from '../hooks/useRanks';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import { useHeroStore } from '../store/heroStore';
import { useProfileStore } from '../store/profileStore';
import { formatNumber } from '../services/format';
import { findRank } from '../services/rankService';

const percentText = (fraction) => `${(fraction * 100).toFixed(fraction < 0.1 ? 1 : 0)}%`;

// «Лучше, чем у N%»: вниз, а не к ближайшему — у лучшего игрока должно получиться 99,9%, а не «лучше, чем у 100%»
const betterText = (fraction) => `${(Math.floor(fraction * 1000) / 10).toFixed(fraction > 0.9 ? 1 : 0)}%`;

/** Столбик доли: ширина — от самого населённого тира, поэтому видна форма распределения. */
function Bar({ value, max, color, label }) {
  return (
    <span className="rank-bar" role="img" aria-label={label}>
      <span className="rank-bar__fill" style={{ width: `${max > 0 ? Math.max(1, (value / max) * 100) : 0}%`, background: color }} />
    </span>
  );
}

/**
 * Распределение игроков по рангам: сколько игроков на каждом ранге, какая доля играет выше. Если выбран «мой профиль»,
 * показано, где в этом распределении сам посетитель. Данные — один запрос на 3 КБ (плюс ранг игрока).
 */
function RanksPage() {
  const t = useTranslation();
  usePageMeta('ranks');
  const language = useHeroStore((state) => state.language);
  const ranks = useRanks();
  const me = useProfileStore((state) => state.me);
  const { distribution, loading, error, myBadge, myLoading, position } = useRankDistribution(me?.id);

  const myTier = myBadge ? Math.floor(myBadge / 10) : null;
  const maxTier = distribution ? Math.max(...distribution.tiers.map((tier) => tier.players)) : 0;
  const maxSub = distribution ? Math.max(...distribution.tiers.flatMap((tier) => tier.subs.map((sub) => sub.players))) : 0;

  // «Выше» считается от самого высокого ранга вниз: доля игроков на этом тире и выше
  const topFrom = (tierNumber) => {
    const above = distribution.tiers.filter((tier) => tier.tier >= tierNumber).reduce((sum, tier) => sum + tier.players, 0);
    return above / distribution.total;
  };

  return (
    <div className="page ranks-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('ranks.title')}</h1>
          <div className="page-subtitle">
            {distribution ? t('ranks.subtitle', { count: formatNumber(distribution.total, language) }) : t('ranks.subtitleShort')}
          </div>
        </div>
      </div>

      <section className="rank-me" aria-live="polite">
        {!me ? (
          <p>
            {t('ranks.noProfile')} <Link to="/me" className="rank-me__link">{t('ranks.setProfile')} →</Link>
          </p>
        ) : myLoading ? (
          <p>{t('common.loading')}</p>
        ) : position ? (
          <>
            <div className="rank-me__badge"><RankBadge badge={myBadge} size="lg" /></div>
            <p className="rank-me__text">
              <strong>{me.name ?? `#${me.id}`}</strong>: {t('ranks.position', { better: betterText(position.betterThan), top: position.topPercent })}
              {' '}
              <Link to={`/player/${me.id}`} className="rank-me__link">{t('ranks.openProfile')} →</Link>
            </p>
          </>
        ) : (
          <p>
            <strong>{me.name ?? `#${me.id}`}</strong>: {t('ranks.unrated')}{' '}
            <Link to={`/player/${me.id}`} className="rank-me__link">{t('ranks.openProfile')} →</Link>
          </p>
        )}
      </section>

      {loading && (
        <div className="state-center">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      )}
      {error && <div className="state-center state-error">{t('common.error')}: {error}</div>}

      {distribution && (
        <div className="rank-list">
          {distribution.tiers.map((tier) => {
            const rank = findRank(ranks, tier.tier);
            const name = rank?.name ?? `#${tier.tier}`;
            const mine = myTier === tier.tier;
            return (
              <details key={tier.tier} className={`rank-row${mine ? ' is-mine' : ''}`} open={mine || undefined}>
                <summary className="rank-row__summary">
                  {rank?.large
                    ? <img src={rank.large} alt="" className="rank-row__img" loading="lazy" />
                    : <span className="rank-row__img rank-row__img--empty" aria-hidden="true" />}
                  <span className="rank-row__name">{name}</span>
                  <Bar value={tier.players} max={maxTier} color={rank?.color ?? undefined} label={`${name}: ${formatNumber(tier.players, language)}`} />
                  <span className="rank-row__share">{percentText(tier.players / distribution.total)}</span>
                  <span className="rank-row__count">{formatNumber(tier.players, language)}</span>
                  <span className="rank-row__top" title={t('ranks.topFromHint')}>
                    {t('ranks.topFrom', { percent: percentText(topFrom(tier.tier)) })}
                  </span>
                </summary>
                <div className="rank-subs">
                  {tier.subs.map((sub) => {
                    const here = mine && myBadge % 10 === sub.sub;
                    return (
                      <div key={sub.sub} className={`rank-sub${here ? ' is-mine' : ''}`}>
                        <span className="rank-sub__name">{name} {sub.sub}{here ? ` ← ${t('ranks.you')}` : ''}</span>
                        <Bar value={sub.players} max={maxSub} color={rank?.color ?? undefined} label={`${name} ${sub.sub}: ${formatNumber(sub.players, language)}`} />
                        <span className="rank-sub__count">{formatNumber(sub.players, language)}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {distribution && <p className="delta-note rank-note">{t('ranks.note')}</p>}
    </div>
  );
}

export default RanksPage;
