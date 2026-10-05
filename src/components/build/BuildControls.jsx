import { useEffect, useId, useMemo, useRef, useState } from 'react';
import HeroIcon from '../hero/HeroIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatNumber } from '../../services/format';
import { BUDGET, BUILD_SIZE, SLOTS, balancedCounts, normalizeSlots } from '../../services/buildService';
import { ChevronIcon, DiceIcon } from './BuildIcons';

const SLOT_KEYS = { weapon: 'itemCard.slotWeapon', spirit: 'itemCard.slotSpirit', vitality: 'itemCard.slotVitality' };
const MODES = [
  { id: 'balance', key: 'buildPage.modeBalance' },
  { id: 'random', key: 'buildPage.modeRandom' },
];

/** «Brawler · Беглый огонь»: роль и тип оружия героя одной строкой. */
function heroLine(hero) {
  return [hero?.role, hero?.stats?.gunTag].filter(Boolean).join(' · ');
}

/**
 * Выбор героя: кнопка с портретом, названием и ролью раскрывает список с поиском. Закрывается выбором, Esc и щелчком
 * мимо; в списке только настоящие кнопки — работает с клавиатуры без особых ролей.
 * @param {{ heroes: any[], value: number|null, current: any, onChange: (id: number) => void }} props
 *   current — герой, которого показать в кнопке (выбранный или тот, что выпал при «любом»)
 */
function HeroSelect({ heroes, value, current, onChange }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return heroes
      .filter((hero) => !needle || hero.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, language === 'russian' ? 'ru' : 'en'));
  }, [heroes, query, language]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (hero) => {
    onChange(hero.id);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  return (
    <div className="build-select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="build-select__trigger"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((on) => !on)}
      >
        {current ? <HeroIcon hero={current} size="sm" decorative /> : <span className="build-select__blank" aria-hidden="true">?</span>}
        <span className="build-select__text">
          <b>{current ? current.name : t('buildPage.randomHero')}</b>
          {current && <small>{heroLine(current)}</small>}
        </span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="build-select__panel" id={listId}>
          <input
            ref={searchRef}
            type="search"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('buildPage.heroSearch')}
            aria-label={t('buildPage.heroSearch')}
          />
          {shown.length === 0 ? (
            <p className="build-select__empty">{t('buildPage.noHeroResults')}</p>
          ) : (
            <ul>
              {shown.map((hero) => (
                <li key={hero.id}>
                  <button type="button" className={hero.id === value ? 'is-on' : ''} aria-pressed={hero.id === value} onClick={() => pick(hero)}>
                    <HeroIcon hero={hero} size="xs" decorative />
                    <span>{hero.name}</span>
                    <small>{hero.role}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Панель настроек: герой, слоты, распределение, бюджет душ, фильтр «нужное герою» и кнопка «Сгенерировать».
 * Настройки меняют только черновик — билд не пересобирается, пока не нажата кнопка (или клавиша R).
 * @param {{
 *   draft: any, onChange: (patch: object | ((draft: any) => object)) => void, heroes: any[], current: any, onGenerate: () => void,
 *   notice: string|null, busy: boolean,
 * }} props
 */
function BuildControls({ draft, onChange, heroes, current, onGenerate, notice, busy }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const budgetId = useId();

  const toggleSlot = (slot) => onChange((prev) => ({
    slots: prev.slots.includes(slot) ? prev.slots.filter((id) => id !== slot) : normalizeSlots([...prev.slots, slot]),
  }));

  const split = balancedCounts(BUILD_SIZE, draft.slots, {}, Object.fromEntries(draft.slots.map((slot) => [slot, BUILD_SIZE])));
  // Неразрывные пробелы: «4 / 4 / 4» не рвётся по строкам на узком экране
  const splitText = draft.slots.map((slot) => split[slot]).join(' / ');
  const fill = `${((draft.budget - BUDGET.min) / (BUDGET.max - BUDGET.min)) * 100}%`;

  return (
    <aside className="build-controls" aria-label={t('buildPage.controlsLabel')}>
      <div className="build-field">
        <div className="build-field__head">
          <span className="build-label">{t('buildPage.heroSelect')}</span>
          <button type="button" className="build-any" aria-pressed={draft.heroId === null} onClick={() => onChange({ heroId: null })}>
            <DiceIcon />
            {t('buildPage.anyHero')}
          </button>
        </div>
        <HeroSelect heroes={heroes} value={draft.heroId} current={draft.heroId === null ? current : heroes.find((hero) => hero.id === draft.heroId) ?? current} onChange={(id) => onChange({ heroId: id })} />
      </div>

      <div className="build-field">
        <div className="build-field__head">
          <span className="build-label" id="build-slots-label">{t('buildPage.slots')}</span>
          <span className="build-count">{t('buildPage.slotsOf', { count: draft.slots.length, total: SLOTS.length })}</span>
        </div>
        <div className="build-slots" role="group" aria-labelledby="build-slots-label">
          {SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              className={`build-slot build-slot--${slot}${draft.slots.includes(slot) ? ' is-on' : ''}`}
              aria-pressed={draft.slots.includes(slot)}
              onClick={() => toggleSlot(slot)}
            >
              <i aria-hidden="true" />
              {t(SLOT_KEYS[slot])}
            </button>
          ))}
        </div>
        {notice === 'noSlots' && <p className="build-note build-note--warn" role="alert">{t('buildPage.errors.noSlots')}</p>}
      </div>

      <div className="build-field">
        <span className="build-label" id="build-mode-label">{t('buildPage.mode')}</span>
        <div className="build-segment" role="group" aria-labelledby="build-mode-label">
          {MODES.map((mode) => (
            <button key={mode.id} type="button" className={draft.mode === mode.id ? 'is-on' : ''} aria-pressed={draft.mode === mode.id} onClick={() => onChange({ mode: mode.id })}>
              {t(mode.key)}
            </button>
          ))}
        </div>
        <p className="build-hint">
          {draft.mode === 'balance' && draft.slots.length > 0
            ? t('buildPage.balanceHint', { split: splitText })
            : t('buildPage.randomHint')}
        </p>
      </div>

      <div className="build-field">
        <div className="build-field__head">
          <label className="build-label" htmlFor={budgetId}>{t('buildPage.budget')}</label>
          <span className="build-budget">{t('buildPage.budgetUpTo', { value: formatNumber(draft.budget, language) })}</span>
        </div>
        <input
          id={budgetId}
          type="range"
          className="build-range"
          min={BUDGET.min}
          max={BUDGET.max}
          step={BUDGET.step}
          value={draft.budget}
          style={{ '--fill': fill }}
          aria-valuetext={formatNumber(draft.budget, language)}
          onChange={(event) => onChange({ budget: Number(event.target.value) })}
        />
        <div className="build-range__ends" aria-hidden="true">
          <span>{BUDGET.min / 1000}k</span>
          <span>{BUDGET.max / 1000}k</span>
        </div>
      </div>

      <label className="build-check">
        <input type="checkbox" checked={draft.useful} onChange={(event) => onChange({ useful: event.target.checked })} aria-describedby="build-useful-hint" />
        <span className="build-check__box" aria-hidden="true" />
        <span>{t('buildPage.useful')}</span>
      </label>
      <p className="build-hint build-hint--check" id="build-useful-hint">{t('buildPage.usefulHint')}</p>

      <div className="build-controls__go">
        <button type="button" className="build-generate" onClick={onGenerate} disabled={busy}>
          <DiceIcon />
          {t('buildPage.generate')}
        </button>
        <p className="build-keyhint">{t('buildPage.orPress')} <kbd>R</kbd></p>
      </div>
    </aside>
  );
}

export default BuildControls;
