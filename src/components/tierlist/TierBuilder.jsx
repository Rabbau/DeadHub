import { useEffect, useMemo, useState } from 'react';
import HeroIcon from '../hero/HeroIcon';
import { TIER_COLORS } from './constants';
import { useHeroes } from '../../hooks/useHeroes';
import { useTranslation } from '../../hooks/useTranslation';
import { useTierStore } from '../../store/tierStore';
import { TIER_ORDER, buildTierList } from '../../services/tierService';

const POOL = 'pool';

/**
 * Герой в конструкторе. Перетаскивание работает мышью; на телефоне (где HTML5 drag-and-drop не работает)
 * героя выбирают касанием, а затем касаются нужного тира. Это обычная кнопка, поэтому доступно и с клавиатуры.
 */
function BuilderHero({ hero, container, selected, onSelect, onDragStart }) {
  return (
    <button
      type="button"
      className={`tier-hero-card${selected ? ' is-selected' : ''}`}
      draggable="true"
      aria-pressed={selected}
      onClick={(event) => { event.stopPropagation(); onSelect(hero.id, container); }}
      onDragStart={(event) => onDragStart(event, hero.id, container)}
    >
      <HeroIcon hero={hero} size="md" decorative />
      <span className="tier-hero-card__name">{hero.name}</span>
    </button>
  );
}

/**
 * Конструктор тир-листа: свой порядок героев вручную. Расставлять можно перетаскиванием (мышь) или в два касания:
 * выбрать героя — выбрать тир. «По данным» заполняет тиры из тир-листа по статистике, чтобы поправить его под себя.
 */
function TierBuilder() {
  const { allHeroes, loading } = useHeroes();
  const { tiers, availableHeroIds, init, moveToTier, moveToPool, moveBetweenTiers, assign, reset } = useTierStore();
  const t = useTranslation();
  const [selected, setSelected] = useState(null); // { heroId, from } — выбранный касанием герой

  const activeHeroIds = useMemo(() => allHeroes.filter((h) => h.released).map((h) => h.id), [allHeroes]);
  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((h) => [h.id, h])), [allHeroes]);

  useEffect(() => {
    if (activeHeroIds.length) init(activeHeroIds);
  }, [activeHeroIds, init]);

  const place = (heroId, from, to) => {
    if (!from || !to || from === to) return;
    if (from === POOL && TIER_ORDER.includes(to)) moveToTier(heroId, to);
    else if (TIER_ORDER.includes(from) && to === POOL) moveToPool(heroId, from);
    else if (TIER_ORDER.includes(from) && TIER_ORDER.includes(to)) moveBetweenTiers(heroId, from, to);
  };

  // --- Перетаскивание мышью ---
  const handleDragStart = (e, heroId, from) => {
    e.dataTransfer.setData('text/plain', String(heroId));
    e.dataTransfer.setData('from', from);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e, to) => {
    e.preventDefault();
    place(parseInt(e.dataTransfer.getData('text/plain'), 10), e.dataTransfer.getData('from'), to);
  };

  // --- Касание: выбрать героя, затем тир ---
  const handleSelect = (heroId, from) => {
    setSelected((current) => (current && current.heroId === heroId ? null : { heroId, from }));
  };
  const handlePlace = (to) => {
    if (!selected) return;
    place(selected.heroId, selected.from, to);
    setSelected(null);
  };

  const handleReset = () => {
    if (confirm(t('tierList.confirmReset'))) {
      setSelected(null);
      reset(activeHeroIds);
    }
  };

  // Заполнить тиры тир-листом по данным; герои без достаточной выборки остаются в пуле
  const handleFromData = () => {
    if (!confirm(t('tierList.confirmFromData'))) return;
    const { tiers: dataTiers } = buildTierList(allHeroes);
    setSelected(null);
    assign(
      Object.fromEntries(TIER_ORDER.map((tier) => [tier, dataTiers[tier].map((entry) => entry.hero.id)])),
      activeHeroIds,
    );
  };

  if (loading) {
    return (
      <div className="state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const total = Object.values(tiers).flat().length + availableHeroIds.length;
  const selectedHero = selected ? heroMap[selected.heroId] : null;
  const renderHero = (heroId, container) => {
    const hero = heroMap[heroId];
    if (!hero) return null;
    return (
      <BuilderHero
        key={heroId}
        hero={hero}
        container={container}
        selected={selected?.heroId === heroId}
        onSelect={handleSelect}
        onDragStart={handleDragStart}
      />
    );
  };

  return (
    <>
      <div className="tier-builder__bar">
        <p className={`tier-builder__hint${selectedHero ? ' is-active' : ''}`} role="status">
          {selectedHero ? t('tierList.placeHint', { name: selectedHero.name }) : t('tierList.pickHint', { count: total })}
        </p>
        <div className="tierlist-actions">
          <button type="button" className="btn btn-secondary" onClick={handleFromData}>{t('tierList.fromData')}</button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>{t('tierList.reset')}</button>
        </div>
      </div>

      <div className="tierlist-container">
        {TIER_ORDER.map((tierKey) => (
          <div
            key={tierKey}
            className={`tier-row${selected ? ' is-target' : ''}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, tierKey)}
            onClick={() => handlePlace(tierKey)}
          >
            <button
              type="button"
              className="tier-row__label tier-row__label--button"
              style={{ background: TIER_COLORS[tierKey] }}
              disabled={!selected}
              aria-label={t('tierList.placeInTier', { tier: tierKey })}
              onClick={(event) => { event.stopPropagation(); handlePlace(tierKey); }}
            >
              {tierKey}
            </button>
            <div className="tier-row__container">
              {tiers[tierKey]?.map((heroId) => renderHero(heroId, tierKey))}
              {(!tiers[tierKey] || tiers[tierKey].length === 0) && (
                <div className="tier-row__empty">{t('tierList.emptyTier')}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="tierlist-pool">
        <div
          className={`hero-pool${selected && selected.from !== POOL ? ' is-target' : ''}`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, POOL)}
          onClick={() => handlePlace(POOL)}
        >
          <div className="hero-pool__header">{t('tierList.poolHeader', { count: availableHeroIds.length })}</div>
          <div className="hero-pool__grid">
            {availableHeroIds.map((heroId) => renderHero(heroId, POOL))}
            {availableHeroIds.length === 0 && <div className="hero-pool__empty">{t('tierList.emptyPool')}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

export default TierBuilder;
