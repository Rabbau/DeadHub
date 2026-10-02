import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DraftPicker from '../components/draft/DraftPicker';
import DraftResults from '../components/draft/DraftResults';
import DraftTeams from '../components/draft/DraftTeams';
import StatsFilters from '../components/ui/StatsFilters';
import { useHeroes } from '../hooks/useHeroes';
import { useMatchups } from '../hooks/useMatchups';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from '../hooks/useTranslation';
import { isListFull, parseSelection, rankDraft, selectionSearch, toggleHero } from '../services/draftService';

/** Не больше этого «чистого» эффекта пары (в долях) считаем неотличимым от шума: 0,3 пп. */
const NOISE_TAU = 0.003;

const pp = (fraction) => (fraction * 100).toFixed(1);

/**
 * Подбор героя против вражеской команды. Враги, союзники и недоступные герои хранятся в адресе
 * (`?e=1,2&a=3&x=4`), поэтому драфтом можно поделиться. Данные — те же две матрицы матчапов, что и на странице
 * «Матчапы» (кеш общий), так что своих запросов страница не добавляет. Расчёт — в services/draftService.js.
 */
function DraftPage() {
  const t = useTranslation();
  usePageMeta('draft');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { allHeroes, loading: heroesLoading, error: heroesError } = useHeroes();
  const { counters, synergy, loading: matchupsLoading, error: matchupsError } = useMatchups();
  const [mode, setMode] = useState('enemies');
  const [fullNotice, setFullNotice] = useState(false);

  const released = useMemo(
    () => allHeroes.filter((hero) => hero.released).sort((a, b) => a.name.localeCompare(b.name)),
    [allHeroes],
  );
  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((hero) => [hero.id, hero])), [allHeroes]);
  const roles = useMemo(() => [...new Set(released.map((hero) => hero.role).filter(Boolean))].sort(), [released]);

  const selection = useMemo(() => parseSelection(params, released.map((hero) => hero.id)), [params, released]);
  const role = roles.includes(params.get('r')) ? params.get('r') : 'all';

  // Адрес обновляется после отрисовки, а два нажатия подряд (двойное касание) могут прийти раньше неё:
  // самый свежий выбор держим в ref, чтобы второе нажатие считалось от первого, а не от устаревшего адреса
  const latest = useRef(selection);
  latest.current = selection;

  const update = useCallback((nextSelection, nextRole = role) => {
    latest.current = nextSelection;
    // replace: каждый клик по герою не должен становиться отдельным шагом в истории браузера
    navigate({ search: selectionSearch(nextSelection, nextRole) }, { replace: true });
  }, [role, navigate]);

  const onToggle = (heroId) => {
    const current = latest.current;
    const next = toggleHero(current, mode, heroId);
    setFullNotice(next === current && !current[mode].includes(heroId));
    if (next !== current) update(next);
  };
  const onRemove = (list, heroId) => {
    setFullNotice(false);
    update({ ...latest.current, [list]: latest.current[list].filter((id) => id !== heroId) });
  };
  const onMode = (next) => {
    setMode(next);
    setFullNotice(false);
  };

  const result = useMemo(
    () => (counters && synergy
      ? rankDraft({ heroes: released, counters, synergy, ...selection, role })
      : null),
    [released, counters, synergy, selection, role],
  );

  const hasPicks = selection.enemies.length + selection.allies.length > 0;
  const header = (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('draft.title')}</h1>
          <div className="page-subtitle">{t('draft.subtitle')}</div>
        </div>
        <div className="page-header__side">
          <Link to="/matchups" className="btn btn-secondary">{t('draft.toMatchups')} →</Link>
        </div>
      </div>
      <StatsFilters />
    </>
  );

  if (heroesLoading || (matchupsLoading && !counters)) {
    return (
      <div className="page draft-page">
        {header}
        <div className="state-center">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const error = heroesError || (!counters && matchupsError);
  if (error) {
    return (
      <div className="page draft-page">
        {header}
        <div className="state-center state-error">{t('common.error')}: {error}</div>
      </div>
    );
  }

  const noisy = result && Math.max(result.tau.counter, result.tau.synergy) < NOISE_TAU;

  return (
    <div className="page draft-page">
      {header}

      <DraftTeams selection={selection} heroMap={heroMap} onRemove={onRemove} />

      <DraftPicker
        heroes={released}
        selection={selection}
        mode={mode}
        onMode={onMode}
        onToggle={onToggle}
        full={fullNotice && isListFull(selection, mode)}
      />

      <section className="draft-output" aria-label={t('draft.resultsTitle')}>
        <div className="draft-output__head">
          <h2 className="section__title">{t('draft.resultsTitle')}</h2>
          <div className="draft-output__tools">
            <div className="chip-group" role="group" aria-label={t('draft.roleLabel')}>
              {['all', ...roles].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`chip${role === value ? ' active' : ''}`}
                  aria-pressed={role === value}
                  onClick={() => update(selection, value)}
                >
                  {value === 'all' ? t('draft.roleAll') : value}
                </button>
              ))}
            </div>
            {hasPicks && (
              <button type="button" className="btn btn-secondary" onClick={() => update({ enemies: [], allies: [], excluded: selection.excluded })}>
                {t('draft.reset')}
              </button>
            )}
          </div>
        </div>

        {!hasPicks && <p className="delta-note">{t('draft.hintNone')}</p>}
        {hasPicks && result && (
          <p className="delta-note">
            {noisy ? t('draft.tauNoise') : t('draft.tauNote', { counter: pp(result.tau.counter), synergy: pp(result.tau.synergy) })}
          </p>
        )}

        {result && <DraftResults result={result} selection={selection} heroMap={heroMap} />}
      </section>

      <details className="tier-formula draft-explain">
        <summary>{t('draft.explainTitle')}</summary>
        <ul>
          <li>{t('draft.explain1')}</li>
          <li>{t('draft.explain2')}</li>
          <li>{t('draft.explain3')}</li>
          <li>{t('draft.explain4')}</li>
        </ul>
      </details>
    </div>
  );
}

export default DraftPage;
