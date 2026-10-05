import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatNumber } from '../../services/format';

/**
 * Вкладки тиров: «T1 · 800 · 23». В магазине и сетке это быстрые переходы к разделу (подсвечен тот, что сейчас
 * на экране), в таблице — фильтр по тиру (повторный щелчок снимает). Тир без предметов при текущих фильтрах недоступен.
 * @param {{
 *   summary: Array<{ key: string, cost: number, count: number }>,
 *   active: string|null, mode: 'jump'|'filter', onPick: (key: string) => void,
 * }} props
 */
function TierTabs({ summary, active, mode, onPick }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  return (
    <nav className="items-tiers" aria-label={t('itemsPage.tiersLabel')}>
      {summary.map(({ key, cost, count }) => (
        <button
          key={key}
          type="button"
          className={`items-tier${active === key ? ' is-on' : ''}`}
          disabled={count === 0}
          aria-current={mode === 'jump' && active === key ? 'true' : undefined}
          aria-pressed={mode === 'filter' ? active === key : undefined}
          onClick={() => onPick(key)}
        >
          <b>{key.toUpperCase()}</b>
          <span className="items-tier__cost">{formatNumber(cost, language)}</span>
          <span className="items-tier__count">{count}</span>
        </button>
      ))}
    </nav>
  );
}

export default TierTabs;
