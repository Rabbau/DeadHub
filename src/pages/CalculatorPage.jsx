import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CalcResults from '../components/calculator/CalcResults';
import ItemPicker from '../components/calculator/ItemPicker';
import HeroIcon from '../components/hero/HeroIcon';
import { fetchCalcItems, fetchHeroCalcBase } from '../api/index.js';
import { useCopy } from '../hooks/useCopy';
import { useHeroes } from '../hooks/useHeroes';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from '../hooks/useTranslation';
import { useHeroStore } from '../store/heroStore';
import { CALC, calcSearch, clampLevel, computeBuild, parseCalcParams, pickItems, toggleItem } from '../services/calculatorService';
import { formatNumber } from '../services/format';

/**
 * Калькулятор билда (адрес /calculator): герой, уровень и до 12 предметов → здоровье, урон выстрела и DPS в трёх
 * вариантах (без предметов, с постоянными бонусами, если выполнены условия предметов). Состояние лежит в адресе, поэтому
 * билдом можно поделиться ссылкой. Это оценка по данным игры; что именно считается, написано под таблицей.
 */
function CalculatorPage() {
  const t = useTranslation();
  usePageMeta('calculator');
  const language = useHeroStore((state) => state.language);
  const { allHeroes } = useHeroes();
  const [params, setParams] = useSearchParams();
  const [initial] = useState(() => parseCalcParams(params));

  const [heroId, setHeroId] = useState(initial.heroId);
  const [level, setLevel] = useState(initial.level);
  const [selected, setSelected] = useState(initial.itemIds);
  const [catalog, setCatalog] = useState({ items: [], state: 'loading' });
  const [base, setBase] = useState({ id: null, value: null, state: 'idle' });
  const [linkCopy, copyLink] = useCopy();
  const [reloadKey, setReloadKey] = useState(0);

  const heroes = useMemo(() => allHeroes.filter((hero) => hero.released).sort((a, b) => a.name.localeCompare(b.name)), [allHeroes]);

  // Каталог предметов
  useEffect(() => {
    let cancelled = false;
    setCatalog((prev) => ({ ...prev, state: 'loading' }));
    fetchCalcItems(language)
      .then((items) => {
        if (cancelled) return;
        setCatalog({ items, state: 'ready' });
        // Предметы из адреса, которых уже нет в игре, отбрасываются
        const known = new Set(items.map((item) => item.id));
        setSelected((ids) => (ids.every((id) => known.has(id)) ? ids : ids.filter((id) => known.has(id))));
      })
      .catch(() => { if (!cancelled) setCatalog({ items: [], state: 'error' }); });
    return () => { cancelled = true; };
  }, [language, reloadKey]);

  // Основа выбранного героя
  useEffect(() => {
    if (!heroId) return undefined;
    let cancelled = false;
    setBase((prev) => ({ ...prev, id: heroId, state: 'loading' }));
    fetchHeroCalcBase(heroId, language)
      .then((value) => { if (!cancelled) setBase({ id: heroId, value, state: 'ready' }); })
      .catch(() => { if (!cancelled) setBase({ id: heroId, value: null, state: 'error' }); });
    return () => { cancelled = true; };
  }, [heroId, language, reloadKey]);

  // Состояние калькулятора — в адресе
  useEffect(() => {
    const next = calcSearch({ heroId, level, itemIds: selected });
    if (new URLSearchParams(next).toString() !== params.toString()) setParams(next, { replace: true });
  }, [heroId, level, selected, params, setParams]);

  const items = useMemo(() => pickItems(catalog.items, selected), [catalog.items, selected]);
  const baseReady = base.state === 'ready' && base.id === heroId ? base.value : null;
  const result = useMemo(() => (baseReady ? computeBuild(baseReady, level, items) : null), [baseReady, level, items]);
  const chosenHero = heroes.find((hero) => hero.id === heroId) ?? null;
  const full = selected.length >= CALC.MAX_ITEMS;
  const slots = Array.from({ length: CALC.MAX_ITEMS }, (_, index) => items[index] ?? null);

  const retry = () => setReloadKey((key) => key + 1);
  const shareLink = `${window.location.origin}${window.location.pathname}?${calcSearch({ heroId, level, itemIds: selected })}`;

  return (
    <div className="page calc-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('calculator.title')} <em>{t('calculator.titleAccent')}</em></h1>
          <div className="page-subtitle">{t('calculator.subtitle')}</div>
        </div>
      </div>

      <div className="calc-layout">
        <div className="calc-main">
          <section className="section calc-section" aria-labelledby="calc-hero">
            <h2 className="section__title" id="calc-hero">{t('calculator.hero')}</h2>
            <div className="calc-heroes" role="group" aria-label={t('calculator.heroesLabel')}>
              {heroes.map((hero) => (
                <button
                  key={hero.id}
                  type="button"
                  className={`calc-hero${hero.id === heroId ? ' is-chosen' : ''}`}
                  aria-pressed={hero.id === heroId}
                  title={hero.name}
                  onClick={() => setHeroId(hero.id)}
                >
                  <HeroIcon hero={hero} size="md" decorative />
                  <span className="calc-hero__name">{hero.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="section calc-section" aria-labelledby="calc-level">
            <h2 className="section__title" id="calc-level">{t('calculator.level')}</h2>
            <div className="calc-level">
              <input
                type="range"
                className="cx-field__range calc-level__range"
                min={CALC.MIN_LEVEL}
                max={CALC.MAX_LEVEL}
                value={level}
                aria-label={t('calculator.level')}
                onChange={(event) => setLevel(clampLevel(event.target.value))}
              />
              <input
                type="number"
                className="cx-field__num calc-level__num"
                min={CALC.MIN_LEVEL}
                max={CALC.MAX_LEVEL}
                value={level}
                aria-label={t('calculator.level')}
                onChange={(event) => { if (event.target.value !== '') setLevel(clampLevel(event.target.value)); }}
              />
            </div>
            <p className="calc-hint">{t('calculator.levelHint')}</p>
          </section>

          <section className="section calc-section" aria-labelledby="calc-items">
            <h2 className="section__title" id="calc-items">{t('calculator.items')} · {t('calculator.itemsCount', { count: selected.length, max: CALC.MAX_ITEMS })}</h2>
            {catalog.state === 'loading' && catalog.items.length === 0 ? (
              <div className="state-center"><div className="spinner" /><p>{t('calculator.loading')}</p></div>
            ) : catalog.state === 'error' ? (
              <div className="state-center state-error">
                <p>{t('calculator.loadError')}</p>
                <button type="button" className="btn btn-primary" onClick={retry}>{t('calculator.retry')}</button>
              </div>
            ) : (
              <ItemPicker items={catalog.items} selected={selected} full={full} language={language} onToggle={(id) => setSelected((ids) => toggleItem(ids, id))} />
            )}
          </section>
        </div>

        <aside className="calc-side" aria-label={t('calculator.results')}>
          <div className="calc-card">
            <h2 className="calc-card__title">
              {chosenHero ? (
                <span className="calc-card__hero"><HeroIcon hero={chosenHero} size="sm" decorative /> {chosenHero.name} · {t('calculator.level')} {level}</span>
              ) : t('calculator.results')}
            </h2>

            <ul className="calc-slots" aria-label={t('calculator.inBuild')}>
              {slots.map((item, index) => (
                <li key={item ? item.id : `empty-${index}`}>
                  {item ? (
                    <button type="button" className="calc-slot is-filled" title={t('calculator.remove', { name: item.name })} aria-label={t('calculator.remove', { name: item.name })} onClick={() => setSelected((ids) => ids.filter((id) => id !== item.id))}>
                      <img src={item.image} alt="" width="36" height="36" />
                    </button>
                  ) : (
                    <span className="calc-slot" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
            <div className="calc-card__bar">
              <span className="calc-card__cost">{t('calculator.cost')}: <strong>{formatNumber(result ? result.cost : items.reduce((sum, item) => sum + item.cost, 0), language)}</strong></span>
              <span className="calc-card__actions">
                {selected.length > 0 && <button type="button" className="cx-link" onClick={() => setSelected([])}>{t('calculator.clear')}</button>}
                <button type="button" className="cx-link" disabled={!heroId} onClick={() => copyLink(shareLink)}>
                  {linkCopy === 'copied' ? `✓ ${t('calculator.copied')}` : linkCopy === 'failed' ? t('calculator.copyFailed') : t('calculator.copyLink')}
                </button>
              </span>
            </div>
            {selected.length === 0 && <p className="calc-hint">{t('calculator.empty')}</p>}

            {!heroId ? (
              <p className="calc-hint">{t('calculator.pickHero')}</p>
            ) : base.state === 'error' ? (
              <div className="state-center state-error">
                <p>{t('calculator.loadError')}</p>
                <button type="button" className="btn btn-primary" onClick={retry}>{t('calculator.retry')}</button>
              </div>
            ) : !result ? (
              <div className="state-center"><div className="spinner" /><p>{t('calculator.loading')}</p></div>
            ) : (
              <>
                <CalcResults result={result} language={language} />
                {result.uncounted.length > 0 && (
                  <div className="calc-uncounted" role="note">
                    <strong>{t('calculator.uncounted')}:</strong>
                    <ul>
                      {result.uncounted.map((entry) => (
                        <li key={`${entry.itemId}-${entry.stat}`}>
                          {t('calculator.uncountedItem', { name: entry.name, effect: t(`calculator.effects.${entry.stat}`, { value: `${entry.value > 0 ? '+' : '−'}${Math.abs(entry.value)}` }) })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      <section className="section calc-section" aria-labelledby="calc-how">
        <h2 className="section__title" id="calc-how">{t('calculator.how')}</h2>
        <ul className="calc-formulas">
          {['health', 'damage', 'rate', 'dps'].map((key) => <li key={key}>{t(`calculator.formulas.${key}`)}</li>)}
        </ul>
        <p className="calc-hint">{t('calculator.note')}</p>
      </section>
    </div>
  );
}

export default CalculatorPage;
