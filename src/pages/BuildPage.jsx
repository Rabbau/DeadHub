import { useRandomBuild } from '../hooks/useRandomBuild';
import { useHeroes } from '../hooks/useHeroes';
import ItemCard from '../components/ui/ItemCard';
import { useTranslation } from '../hooks/useTranslation';

const SLOT_LABEL_KEYS = {
  weapon: 'itemCard.slotWeapon',
  spirit: 'itemCard.slotSpirit',
  vitality: 'itemCard.slotVitality',
};

const MODE_LABEL_KEYS = {
  balance: 'buildPage.modeBalance',
  random: 'buildPage.modeRandom',
};

function BuildPage() {
  const { build, loading, error, options, updateOptions, generate } = useRandomBuild();
  const { allHeroes } = useHeroes();
  const t = useTranslation();

  const activeHeroes = allHeroes.filter(h => h.stats.pickrate > 0);

  const errorMessage = error
    ? (t(`buildPage.errors.${error}`) !== `buildPage.errors.${error}`
        ? t(`buildPage.errors.${error}`)
        : error)
    : null;

  const toggleSlot = (slot) => {
    updateOptions({
      slots: { ...options.slots, [slot]: !options.slots[slot] },
    });
  };

  return (
    <div className="page build-page">
      <h1 className="page-title">{t('buildPage.title')}</h1>
      <p className="build-page__intro">{t('buildPage.description')}</p>

      <div className="build-options">
        <label className="build-options__field">
          <span>{t('buildPage.heroSelect')}</span>
          <select
            className="select"
            value={options.heroId}
            onChange={e => updateOptions({ heroId: e.target.value })}
          >
            <option value="">{t('buildPage.randomHero')}</option>
            {activeHeroes.map(hero => (
              <option key={hero.id} value={hero.id}>{hero.name}</option>
            ))}
          </select>
        </label>

        <div className="build-options__field">
          <span>{t('buildPage.slots')}</span>
          <div className="chip-group">
            {['weapon', 'spirit', 'vitality'].map(slot => (
              <button
                key={slot}
                type="button"
                className={`chip ${options.slots[slot] ? 'active' : ''}`}
                onClick={() => toggleSlot(slot)}
              >
                {t(SLOT_LABEL_KEYS[slot])}
              </button>
            ))}
          </div>
        </div>

        <div className="build-options__field">
          <span>{t('buildPage.mode')}</span>
          <div className="chip-group">
            {['balance', 'random'].map(mode => (
              <button
                key={mode}
                type="button"
                className={`chip ${options.mode === mode ? 'active' : ''}`}
                onClick={() => updateOptions({ mode })}
              >
                {t(MODE_LABEL_KEYS[mode])}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button className="btn btn-primary" onClick={generate} disabled={loading}>
        {loading ? t('common.loading') : t('buildPage.generate')}
      </button>

      {errorMessage && (
        <p className="build-page__error state-error" style={{ marginTop: '1rem' }}>
          ⚠️ {t('common.error')}: {errorMessage}
        </p>
      )}

      {build && (
        <div className="build-card">
          <div className="build-card__hero">
            {build.hero.image_url ? (
              <img src={build.hero.image_url} alt={build.hero.name} className="build-card__hero-img" />
            ) : (
              <div className="build-card__hero-placeholder">{build.hero.name.slice(0, 2)}</div>
            )}
            <div>
              <div className="build-card__hero-name">{build.hero.name}</div>
              <div className="build-card__hero-role">{build.hero.role || '—'}</div>
            </div>
          </div>

          <div className="build-card__items">
            {build.items.map(item => <ItemCard key={item.id} item={item} compact={true} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default BuildPage;