import { useState } from 'react';
import { itemMonogram } from '../../services/shopService';

/**
 * Плитка предмета: рисунок на фоне цвета слота; нет рисунка (или он не загрузился) — буквы названия.
 * Цвет слота задают классы .item-tile--weapon|vitality|spirit; размер — sm | md | lg.
 * @param {{ item: { name: string, image_url?: string|null, item_slot_type?: string|null }, size?: 'sm'|'md'|'lg' }} props
 */
function ItemTile({ item, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(item.image_url) && !failed;

  return (
    <span className={`item-tile item-tile--${item.item_slot_type ?? 'none'} item-tile--${size}`} aria-hidden="true">
      {showImage
        ? <img src={item.image_url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : <span className="item-tile__mono">{itemMonogram(item.name)}</span>}
    </span>
  );
}

export default ItemTile;
