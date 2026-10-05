import { memo, useId } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { itemKind } from '../../services/itemService';
import { visibleRows } from '../../services/shopService';
import { ChevronIcon } from './ItemIcons';
import ItemTile from './ItemTile';
import TierHeading from './TierHeading';
import { SLOT_KEYS } from './labels';

/** Предмет в колонке: плитка, название и тип; щелчок выбирает его (панель справа показывает подробности). */
const ShopRow = memo(function ShopRow({ item, selected, kindLabel, offLabel, onSelect }) {
  return (
    <li>
      <button
        type="button"
        className={`shop-row shop-row--${item.item_slot_type}${selected ? ' is-on' : ''}${offLabel ? ' is-off' : ''}`}
        aria-pressed={selected}
        data-item-id={item.id}
        onClick={() => onSelect(item.id)}
      >
        <ItemTile item={item} />
        <span className="shop-row__text">
          <b className="shop-row__name">{item.name}</b>
          <small>{offLabel || kindLabel}</small>
        </span>
      </button>
    </li>
  );
});

/** Колонка слота: заголовок с числом предметов, строки и кнопка «Ещё N», если колонка длинная и не раскрыта. */
function ShopColumn({ sectionKey, column, expanded, forceAll, selectedId, onSelect, onExpand, off }) {
  const t = useTranslation();
  const shown = visibleRows(column.items.length, { expanded, forceAll });
  const hidden = column.items.length - shown;
  const offLabel = off ? t('itemsPage.off') : null;

  return (
    <div className={`shop-col shop-col--${column.slot}`}>
      <h3 className="shop-col__head">
        <span>{t(SLOT_KEYS[column.slot])}</span>
        <small>{column.items.length}</small>
      </h3>
      <ul className="shop-col__list">
        {column.items.slice(0, shown).map((item) => (
          <ShopRow
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            kindLabel={t(`itemsPage.kinds.${itemKind(item)}`)}
            offLabel={offLabel}
            onSelect={onSelect}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" className="shop-more" onClick={() => onExpand(`${sectionKey}:${column.slot}`)}>
          {t('itemsPage.more', { count: hidden })}
        </button>
      )}
    </div>
  );
}

/** Раздел тира: заголовок с кнопкой «Свернуть / Развернуть» и три колонки по слотам. Свёрнутый раздел остаётся строкой-заголовком. */
function ShopSection({ section, open, forceAll, expandedColumns, selectedId, onSelect, onToggle, onExpand }) {
  const t = useTranslation();
  const bodyId = useId();
  const titleId = useId();
  const isOpen = forceAll || open;

  return (
    <section id={`items-tier-${section.key}`} className={`shop-tier${isOpen ? '' : ' is-collapsed'}`} aria-labelledby={titleId}>
      <div className="shop-tier__head">
        <TierHeading id={titleId} sectionKey={section.key} cost={section.cost} count={section.total} />
        {!forceAll && (
          <button type="button" className="shop-tier__toggle" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => onToggle(section.key)}>
            {isOpen ? t('itemsPage.collapse') : t('itemsPage.expand')}
            <ChevronIcon up={isOpen} />
          </button>
        )}
      </div>
      <div className="shop-tier__cols" id={bodyId} hidden={!isOpen}>
        {section.columns.map((column) => (
          <ShopColumn
            key={column.slot}
            sectionKey={section.key}
            column={column}
            expanded={expandedColumns.has(`${section.key}:${column.slot}`)}
            forceAll={forceAll}
            selectedId={selectedId}
            onSelect={onSelect}
            onExpand={onExpand}
            off={section.key === 'indev'}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Магазин: тиры по порядку, в каждом три колонки (оружие, живучесть, дух).
 * @param {{
 *   shop: ReturnType<typeof import('../../services/shopService').buildShop>,
 *   open: Record<string, boolean>, expandedColumns: Set<string>, forceAll: boolean,
 *   selectedId: number|null, onSelect: (id: number) => void,
 *   onToggleTier: (key: string) => void, onExpandColumn: (key: string) => void,
 * }} props
 */
function ShopView({ shop, open, expandedColumns, forceAll, selectedId, onSelect, onToggleTier, onExpandColumn }) {
  const sections = shop.indev ? [...shop.tiers, shop.indev] : shop.tiers;

  return (
    <div className="shop">
      {sections.map((section) => (
        <ShopSection
          key={section.key}
          section={section}
          open={open[section.key] ?? false}
          forceAll={forceAll}
          expandedColumns={expandedColumns}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggle={onToggleTier}
          onExpand={onExpandColumn}
        />
      ))}
    </div>
  );
}

export default ShopView;
