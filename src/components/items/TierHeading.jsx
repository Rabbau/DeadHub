import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatNumber } from '../../services/format';
import { SoulMark } from './ItemIcons';
import { tierName } from './labels';

/**
 * Заголовок раздела тира: «⬢ Тир I · 800 ◈ · 23 предмета ———». Общий для магазина и сетки.
 * @param {{ id?: string, sectionKey: string, cost: number|null, count: number }} props
 */
function TierHeading({ id, sectionKey, cost, count }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  return (
    <h2 className="shop-tier__title" id={id}>
      <i className="shop-hex" aria-hidden="true" />
      <span className="shop-tier__name">{tierName(t, sectionKey)}</span>
      {cost != null && (
        <span className="shop-tier__cost">
          {formatNumber(cost, language)}
          <SoulMark />
        </span>
      )}
      <span className="shop-tier__count">{t.plural('itemsPage.itemsCount', count)}</span>
      <span className="shop-tier__line" aria-hidden="true" />
    </h2>
  );
}

export default TierHeading;
