import { useEffect } from 'react';
import { useHeroes } from '../hooks/useHeroes';
import { useTierStore } from '../store/tierStore';
import { useTranslation } from '../hooks/useTranslation';

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];
const TIER_COLORS = {
  S: '#ff6b6b',
  A: '#feca57',
  B: '#48dbfb',
  C: '#1dd1a1',
  D: '#a29bfe',
};

function TierListPage() {
  const { heroes, loading } = useHeroes();
  const {
    tiers,
    availableHeroes,
    init,
    moveToTier,
    moveToPool,
    moveBetweenTiers,
    reset,
  } = useTierStore();
  const t = useTranslation();

  const activeHeroes = heroes.filter(h => h.stats.pickrate > 0);

  useEffect(() => {
    if (activeHeroes.length) {
      init(activeHeroes);
    }
  }, [activeHeroes, init]);

  // --- Drag handlers ---
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
    const heroId = parseInt(e.dataTransfer.getData('text/plain'));
    const from = e.dataTransfer.getData('from');
    if (!from || !to || from === to) return;

    if (from === 'pool' && TIER_ORDER.includes(to)) {
      moveToTier(heroId, to);
    } else if (TIER_ORDER.includes(from) && to === 'pool') {
      moveToPool(heroId, from);
    } else if (TIER_ORDER.includes(from) && TIER_ORDER.includes(to)) {
      moveBetweenTiers(heroId, from, to);
    }
  };

  // --- Сброс ---
  const handleReset = () => {
    if (confirm(t('tierList.confirmReset'))) {
      reset(activeHeroes);
    }
  };

  if (loading) {
    return (
      <div className="page state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const total = Object.values(tiers).flat().length + availableHeroes.length;

  // Компонент карточки героя
  const HeroCard = ({ hero, container }) => (
    <div
      className="tier-hero-card"
      draggable="true"
      onDragStart={(e) => handleDragStart(e, hero.id, container)}
    >
      {hero.image_url ? (
        <img src={hero.image_url} alt={hero.name} className="tier-hero-card__img" />
      ) : (
        <div className="tier-hero-card__placeholder">{hero.name.slice(0, 2)}</div>
      )}
      <span className="tier-hero-card__name">{hero.name}</span>
    </div>
  );

  return (
    <div className="page tierlist-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('tierList.title')}</h1>
          <div className="page-subtitle">
            {t('tierList.subtitle', { count: total })}
          </div>
        </div>
        <div className="tierlist-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            {t('tierList.reset')}
          </button>
          {/* Кнопка PNG удалена */}
        </div>
      </div>

      <div>
        <div className="tierlist-container">
          {TIER_ORDER.map((tierKey) => (
            <div
              key={tierKey}
              className="tier-row"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, tierKey)}
            >
              <div
                className="tier-row__label"
                style={{ background: TIER_COLORS[tierKey] }}
              >
                {tierKey}
              </div>
              <div className="tier-row__container">
                {tiers[tierKey]?.map((hero) => (
                  <HeroCard key={hero.id} hero={hero} container={tierKey} />
                ))}
                {(!tiers[tierKey] || tiers[tierKey].length === 0) && (
                  <div className="tier-row__empty">{t('tierList.emptyTier')}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="tierlist-pool">
          <div
            className="hero-pool"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'pool')}
          >
            <div className="hero-pool__header">
              {t('tierList.poolHeader', { count: availableHeroes.length })}
            </div>
            <div className="hero-pool__grid">
              {availableHeroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} container="pool" />
              ))}
              {availableHeroes.length === 0 && (
                <div className="hero-pool__empty">{t('tierList.emptyPool')}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TierListPage;