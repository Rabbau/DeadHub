import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatNumber } from '../../services/format';
import { SLOTS } from '../../services/buildService';
import BuildItemCard from './BuildItemCard';
import { LinkIcon, RerollIcon, SoulIcon } from './BuildIcons';

const SLOT_KEYS = { weapon: 'itemCard.slotWeapon', spirit: 'itemCard.slotSpirit', vitality: 'itemCard.slotVitality' };

/**
 * Готовый билд: герой и зерно, кнопки «перебросить» и «поделиться», итоги по слотам, этапы покупки с предметами.
 * @param {{
 *   build: ReturnType<typeof import('../../services/buildService').makeBuild>,
 *   pinned: Set<number>, onTogglePin: (id: number) => void, onReroll: () => void, onShare: () => void,
 *   shareState: 'idle'|'copied'|'failed', usefulMissing: boolean,
 * }} props
 */
function BuildResult({ build, pinned, onTogglePin, onReroll, onShare, shareState, usefulMissing }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const { hero, totals } = build;
  const number = (value) => formatNumber(value, language);
  const shareLabel = shareState === 'copied' ? t('buildPage.shareCopied') : shareState === 'failed' ? t('buildPage.shareFailed') : t('buildPage.share');

  return (
    <section className="build-result" aria-labelledby="build-hero-name">
      <header className="build-result__head">
        <span className="build-portrait" aria-hidden="true">
          {hero.image_url ? <img src={hero.image_url} alt="" /> : <span>{hero.name.slice(0, 2)}</span>}
        </span>
        <div className="build-result__who">
          <h2 id="build-hero-name" className="build-result__name"><Link to={`/hero/${hero.id}`}>{hero.name}</Link></h2>
          <p className="build-result__meta">
            {hero.role && <span className="build-result__role">{hero.role}</span>}
            <span className="build-result__seed">{t('buildPage.seed')} #{build.seedLabel}</span>
          </p>
        </div>
        <div className="build-result__actions">
          <button type="button" className="build-btn" onClick={onReroll}>
            <RerollIcon />
            {t('buildPage.reroll')}
          </button>
          <button type="button" className="build-btn build-btn--primary" onClick={onShare}>
            <LinkIcon />
            {shareLabel}
          </button>
          <span className="sr-only" role="status">{shareState === 'copied' ? t('buildPage.shareCopied') : ''}</span>
        </div>
      </header>

      <dl className="build-totals">
        <div className="build-totals__cell build-totals__cell--all">
          <dt>{t('buildPage.total')}</dt>
          <dd>{number(totals.total)}</dd>
        </div>
        {SLOTS.map((slot) => (
          <div key={slot} className={`build-totals__cell build-totals__cell--${slot}${totals[slot] === 0 ? ' is-zero' : ''}`}>
            <dt>{t(SLOT_KEYS[slot])}</dt>
            <dd>{number(totals[slot])}</dd>
            <i style={{ '--share': `${totals.total ? Math.round((totals[slot] / totals.total) * 100) : 0}%` }} aria-hidden="true" />
          </div>
        ))}
      </dl>

      {build.overBudget && <p className="build-note build-note--warn">{t('buildPage.overBudget', { budget: number(build.options.budget) })}</p>}
      {usefulMissing && <p className="build-note">{t('buildPage.usefulMissing')}</p>}

      {build.phases.map((phase) => (
        phase.entries.length > 0 && (
          <section key={phase.id} className="build-phase" aria-labelledby={`build-phase-${phase.id}`}>
            <h3 id={`build-phase-${phase.id}`} className="build-phase__head">
              <span>{t(`buildPage.phases.${phase.id}`)}</span>
              <i aria-hidden="true" />
              <span className="build-phase__sum">{number(phase.total)}<SoulIcon /><span className="sr-only"> {t('buildPage.souls')}</span></span>
            </h3>
            <ul className="build-phase__items">
              {phase.entries.map(({ item }) => (
                <BuildItemCard key={item.id} item={item} pinned={pinned.has(item.id)} onTogglePin={onTogglePin} />
              ))}
            </ul>
          </section>
        )
      ))}
    </section>
  );
}

export default BuildResult;
