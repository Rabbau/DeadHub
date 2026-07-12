import { Link } from 'react-router-dom';
import { useItemDetail } from '../hooks/useItemDetail';
import { useHeroStore } from '../store/heroStore';
import { useHeroes } from '../hooks/useHeroes';
import { useTranslation } from '../hooks/useTranslation';
import ItemCard from '../components/ui/ItemCard';
import { formatWinrate, winrateColor } from '../services/heroService';

const SLOT_LABEL_KEYS = {
  weapon: 'itemCard.slotWeapon',
  spirit: 'itemCard.slotSpirit',
  vitality: 'itemCard.slotVitality',
};

function ItemPage() {
  const { item, stats, heroUsage, loading, error } = useItemDetail();
  const { allHeroes } = useHeroes();
  const t = useTranslation();

  const heroMap = Object.fromEntries(allHeroes.map(h => [h.id, h]));

  if (loading) {
    return (
      <div className="page state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !item) {
    const msg = error === 'notFound' ? t('itemPage.notFound') : (error || t('itemPage.notFound'));
    return (
      <div className="state-center state-error">
        ⚠️ {t('common.error')}: {msg}
        <br />
        <Link to="/items" className="back-link" style={{ marginTop: '1rem', display: 'inline-block' }}>
          {t('itemPage.back')}
        </Link>
      </div>
    );
  }

  const wrColor = stats ? winrateColor(stats.winrate) : 'neutral';

  return (
    <div className="page item-page">
      <Link to="/items" className="back-link">{t('itemPage.back')}</Link>

      <div className="item-detail">
        <div className="item-detail__card">
          <ItemCard item={item} />
        </div>

        <div className="item-detail__info">
          <h1 className="page-title">{item.name}</h1>

          <div className="item-detail__meta">
            {item.item_slot_type && (
              <span className={`tag tag--role item-detail__slot item-detail__slot--${item.item_slot_type}`}>
                {t(SLOT_LABEL_KEYS[item.item_slot_type] || '')}
              </span>
            )}
            {item.cost && <span className="tag">{item.cost} ₡</span>}
            {item.item_tier && <span className="tag">{t('itemCard.tier')} {item.item_tier}</span>}
          </div>

          {item.description?.desc && (
            <p className="item-detail__desc">{item.description.desc}</p>
          )}
          {item.description?.quip && (
            <p className="item-detail__quip">{item.description.quip}</p>
          )}

          {stats && (
            <div className="item-detail__stats">
              <h2 className="section__title">{t('itemPage.globalStats')}</h2>
              <div className="hero-detail__stats-row">
                <div className="stat-card">
                  <div className="stat-card__label">{t('itemPage.winrate')}</div>
                  <div className={`stat-card__value winrate-${wrColor}`}>{formatWinrate(stats.winrate)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">{t('itemPage.matches')}</div>
                  <div className="stat-card__value">{stats.matches.toLocaleString()}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card__label">{t('itemPage.players')}</div>
                  <div className="stat-card__value">{stats.players.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}

          {heroUsage.length > 0 && (
            <div className="section">
              <h2 className="section__title">{t('itemPage.heroUsage')}</h2>
              <div className="item-hero-usage">
                {heroUsage.slice(0, 10).map(entry => {
                  const hero = heroMap[entry.heroId];
                  if (!hero) return null;
                  const color = winrateColor(entry.winrate);
                  return (
                    <Link to={`/hero/${hero.id}`} key={entry.heroId} className="item-hero-usage__row">
                      {hero.image_url ? (
                        <img src={hero.image_url} alt={hero.name} className="item-hero-usage__img" />
                      ) : (
                        <div className="item-hero-usage__placeholder">{hero.name.slice(0, 2)}</div>
                      )}
                      <span className="item-hero-usage__name">{hero.name}</span>
                      <span className={`item-hero-usage__wr winrate-${color}`}>{formatWinrate(entry.winrate)}</span>
                      <span className="item-hero-usage__matches">{entry.matches.toLocaleString()} {t('itemPage.matchesShort')}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ItemPage;
