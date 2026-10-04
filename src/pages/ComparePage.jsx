import { useMemo, useRef } from 'react';
import CompareHeroCard, { CompareSlot } from '../components/compare/CompareHeroCard';
import CompareHeroPicker from '../components/compare/CompareHeroPicker';
import CompareLeaders from '../components/compare/CompareLeaders';
import CompareRadar from '../components/compare/CompareRadar';
import { useHeroes } from '../hooks/useHeroes';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import { useCompareStore } from '../store/compareStore';
import { MAX_COMPARED, nextSelection, pickSelected } from '../services/compareService';

function ComparePage() {
  const { allHeroes, loading } = useHeroes();
  const { selectedIds, replace, clear, history, applyHistory } = useCompareStore();
  const pickerRef = useRef(null);
  const t = useTranslation();
  usePageMeta('compare');

  // Только герои, доступные игрокам (а не заготовки в разработке)
  const roster = useMemo(() => allHeroes.filter((hero) => hero.released), [allHeroes]);
  // В порядке выбора, без героев, которых больше нет в игре (id мог остаться в сохранённом выборе)
  const selected = useMemo(() => pickSelected(roster, selectedIds), [roster, selectedIds]);
  const ids = useMemo(() => selected.map((hero) => hero.id), [selected]);

  const toggle = (id) => replace(nextSelection(ids, id));
  const remove = (id) => replace(ids.filter((existing) => existing !== id));
  const scrollToPicker = () => {
    pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    pickerRef.current?.querySelector('input')?.focus({ preventScroll: true });
  };

  if (loading) {
    return (
      <div className="page state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const described = selected.filter((hero) => hero.description);

  return (
    <div className="page compare-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('compare.title')} <em>{t('compare.titleAccent')}</em></h1>
          <div className="page-subtitle">{t('compare.subtitle', { count: MAX_COMPARED })}</div>
        </div>
        {selected.length > 0 && (
          <div className="page-header__side">
            <button type="button" className="chip" onClick={clear}>{t('compare.reset')}</button>
          </div>
        )}
      </div>

      <div className="cmp-top">
        <CompareRadar heroes={selected} roster={roster} />
        <div className="cmp-cards">
          {selected.map((hero, index) => <CompareHeroCard key={hero.id} hero={hero} index={index} onRemove={remove} />)}
          {Array.from({ length: Math.max(0, MAX_COMPARED - selected.length) }, (_, offset) => (
            <CompareSlot key={`slot-${offset}`} index={selected.length + offset} onPick={scrollToPicker} />
          ))}
        </div>
      </div>

      <CompareLeaders heroes={selected} />

      {described.length > 0 && (
        <details className="cmp-lore">
          <summary>{t('compare.descriptions')}</summary>
          <div className="cmp-lore__list">
            {described.map((hero) => (
              <div key={hero.id}>
                <h3>{hero.name}</h3>
                <p>{hero.description}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      <CompareHeroPicker
        ref={pickerRef}
        heroes={roster}
        selectedIds={ids}
        onToggle={toggle}
        history={history}
        onHistory={applyHistory}
      />
    </div>
  );
}

export default ComparePage;
