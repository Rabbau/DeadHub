import { useState } from 'react';

function ItemCard({ item, compact = false }) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const imageUrl = item.image_url;
  const showImage = imageUrl && !imgError;

  const cardClass = compact ? 'item-card build-item-card' : 'item-card';
  const imgClass = compact ? 'item-card__img build-item-img' : 'item-card__img';
  const placeholderClass = compact ? 'item-card__img-placeholder build-item-img' : 'item-card__img-placeholder';
  const nameClass = compact ? 'item-card__name build-item-name' : 'item-card__name';
  const costClass = compact ? 'item-card__cost build-item-cost' : 'item-card__cost';

  return (
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
  );
}

export default ItemCard;