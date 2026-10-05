import { useMemo, useState } from 'react';
import BuildControls from '../components/build/BuildControls';
import BuildHistory from '../components/build/BuildHistory';
import BuildResult from '../components/build/BuildResult';
import { HistoryIcon } from '../components/build/BuildIcons';
import { useBuildGenerator } from '../hooks/useBuildGenerator';
import { useCopy } from '../hooks/useCopy';
import { useHeroes } from '../hooks/useHeroes';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from '../hooks/useTranslation';
import { formatShortDate, localeFor } from '../services/format';
import { useBuildStore } from '../store/buildStore';
import { useHeroStore } from '../store/heroStore';

/** «5 октября» из даты билда дня («2026-10-05», местная дата посетителя). */
function dayLabel(day, language) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(localeFor(language), { day: 'numeric', month: 'long' });
}

function BuildPage() {
  const t = useTranslation();
  usePageMeta('build');
  const { allHeroes, loading: heroesLoading, error: heroesError, language } = useHeroes();
  const patch = useHeroStore((state) => state.patch);
  const clearHistory = useBuildStore((state) => state.clear);
  const [shareState, copy] = useCopy();
  const [historyOpen, setHistoryOpen] = useState(false);

  const roster = useMemo(() => allHeroes.filter((hero) => hero.released), [allHeroes]);
  const generator = useBuildGenerator({ heroes: roster, language });
  const { build, error, draft, history } = generator;

  const kicker = patch
    ? t('buildPage.kicker', { date: dayLabel(generator.day, language), patch: formatShortDate(patch.at, language) })
    : t('buildPage.kickerNoPatch', { date: dayLabel(generator.day, language) });

  const showHistory = () => {
    setHistoryOpen(true);
    // Раскрытый список ещё не отрисован: прокручиваем на следующем кадре
    requestAnimationFrame(() => document.getElementById('build-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  if (heroesLoading) {
    return (
      <div className="page state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const errorText = heroesError ?? (error ? t(`buildPage.errors.${error}`) : null);

  return (
    <div className="page build-page">
      <header className="build-head">
        <div>
          <p className="build-kicker"><i aria-hidden="true" />{kicker}</p>
          <h1 className="page-title">{t('buildPage.title')}</h1>
          <p className="build-head__text">{t('buildPage.description')}</p>
        </div>
        {history.length > 0 && (
          <button type="button" className="build-btn" onClick={showHistory}>
            <HistoryIcon />
            {t('buildPage.history')}
          </button>
        )}
      </header>

      <div className="build-layout">
        <BuildControls
          draft={draft}
          onChange={generator.updateDraft}
          heroes={roster}
          current={build?.hero ?? generator.hero}
          onGenerate={generator.generate}
          notice={generator.notice}
          busy={generator.pending}
        />

        <div className="build-stage">
          {build && (
            <BuildResult
              build={build}
              pinned={generator.pinned}
              onTogglePin={generator.togglePin}
              onReroll={generator.reroll}
              onShare={() => copy(generator.shareUrl)}
              shareState={shareState}
              usefulMissing={generator.usefulMissing}
            />
          )}

          {!build && errorText && (
            <div className="build-empty state-error" role="alert">
              <p>{t('common.error')}: {errorText}</p>
              {error === 'itemsFailed' && <button type="button" className="build-btn" onClick={generator.retry}>{t('buildPage.retry')}</button>}
            </div>
          )}

          {!build && !errorText && (
            <div className="build-empty" role="status">
              <div className="spinner" />
              <p>{t('buildPage.loadingBuild')}</p>
            </div>
          )}
        </div>
      </div>

      <BuildHistory
        entries={history}
        heroes={roster}
        expanded={historyOpen}
        onToggle={() => setHistoryOpen((open) => !open)}
        onPick={generator.restore}
        onClear={() => { clearHistory(); setHistoryOpen(false); }}
      />
    </div>
  );
}

export default BuildPage;
