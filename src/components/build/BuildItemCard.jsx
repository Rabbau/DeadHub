import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatNumber } from '../../services/format';
import { LockIcon, SoulIcon } from './BuildIcons';

const TIER = ['', 'I', 'II', 'III', 'IV', 'V'];

/** Рисунок предмета; нет картинки — первая буква названия, как у героев без портрета. */
function ItemImage({ item }) {
  if (!item.image_url) return <span className="build-item__letter" aria-hidden="true">{String(item.name).slice(0, 1)}</span>;
  return <img src={item.image_url} alt="" loading="lazy" decoding="async" />;
}

/**
 * Предмет билда: цвет полосы сверху — слот, замок справа вверху — закрепить (при броске остального закреплённые
 * предметы остаются), внизу цена в душах и тир.
 * @param {{ item: any, pinned: boolean, onTogglePin: (id: number) => void }} props
 */
function BuildItemCard({ item, pinned, onTogglePin }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const tier = TIER[item.item_tier] ?? '';

  return (
    <li className={`build-item build-item--${item.item_slot_type}${pinned ? ' is-pinned' : ''}`}>
      <button
        type="button"
        className="build-item__pin"
        aria-pressed={pinned}
        aria-label={t(pinned ? 'buildPage.unpin' : 'buildPage.pin', { name: item.name })}
        title={t(pinned ? 'buildPage.unpin' : 'buildPage.pin', { name: item.name })}
        onClick={() => onTogglePin(item.id)}
      >
        <LockIcon locked={pinned} />
      </button>

      <Link to={`/items/${item.id}`} className="build-item__link">
        <span className="build-item__icon"><ItemImage item={item} /></span>
        <span className="build-item__name">{item.name}</span>
      </Link>

      <div className="build-item__foot">
        <span className="build-item__cost">
          {formatNumber(item.cost ?? 0, language)}
          <SoulIcon />
          <span className="sr-only"> {t('buildPage.souls')}</span>
        </span>
        {tier && <span className="build-item__tier" title={t('buildPage.tier', { tier: item.item_tier })}>{tier}</span>}
      </div>
    </li>
  );
}

export default BuildItemCard;
