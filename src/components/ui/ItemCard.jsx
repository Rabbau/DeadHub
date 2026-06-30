import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

const SLOT_KEYS = {
  weapon: 'itemCard.slotWeapon',
  vitality: 'itemCard.slotVitality',
  spirit: 'itemCard.slotSpirit',
};

function ItemCard({ item, compact = false }) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const t = useTranslation();

  const imageUrl = item.image_url;
  const showImage = imageUrl && !imgError;

  const cardClass = compact ? 'item-card build-item-card' : 'item-card';
  const imgClass = compact ? 'item-card__img build-item-img' : 'item-card__img';
  const placeholderClass = compact ? 'item-card__img-placeholder build-item-img' : 'item-card__img-placeholder';
  const nameClass = compact ? 'item-card__name build-item-name' : 'item-card__name';
  const costClass = compact ? 'item-card__cost build-item-cost' : 'item-card__cost';

  const slotLabel = item.item_slot_type ? t(SLOT_KEYS[item.item_slot_type] || '') : '';

  return (
    <div className="item-card-wrap">
      <div className={cardClass}>
        {showImage ? (
          <img
            src={imageUrl}
            alt={item.name}
            className={imgClass}
            onError={() => setImgError(true)}
            onLoad={() => setLoaded(true)}
            style={{ display: loaded ? 'block' : 'none' }}
          />
        ) : null}
        {(!showImage || !loaded) && (
          <div className={placeholderClass}>🛡</div>
        )}
        <div className={nameClass}>{item.name}</div>
        {item.cost && <div className={costClass}>{item.cost} ₡</div>}
      </div>

      <div className="item-tooltip">
        <div className="item-tooltip__header">
          <span className="item-tooltip__name">{item.name}</span>
          {item.cost ? <span className="item-tooltip__cost">{item.cost} ₡</span> : null}
        </div>
        <div className="item-tooltip__meta">
          {item.item_slot_type && (
            <span className={`item-tooltip__badge item-tooltip__badge--${item.item_slot_type}`}>
              {slotLabel}
            </span>
          )}
          {item.item_tier && (
            <span className="item-tooltip__badge">
              {t('itemCard.tier')} {item.item_tier}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ItemCard;