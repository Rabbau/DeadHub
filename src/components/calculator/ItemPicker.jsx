import { useMemo, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { localeFor } from '../../services/format';
import { CALC, filterCalcItems } from '../../services/calculatorService';

const SLOTS = ['all', 'weapon', 'vitality', 'spirit'];

/** Короткая подпись бонуса предмета на плитке: «+125 здоровье», «+8% урон оружия». */
function modText(t, language, mod) {
  const percent = mod.stat === 'weaponDamage' || mod.stat === 'fireRate' || mod.stat === 'clipPercent';
  const value = new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 1 }).format(Math.abs(mod.value));
  return `${mod.value < 0 ? '−' : '+'}${value}${percent ? '%' : ''} ${t(`calculator.stats.${mod.stat}`)}`;
}

/**
 * Выбор предметов: вкладки по слотам, поиск по названию и плитки с ценой и бонусами, которые считает калькулятор.
 * Постоянные бонусы показаны обычным шрифтом, условные — приглушённым.
 * @param {{ items: any[], selected: number[], full: boolean, language: string, onToggle: (id: number) => void }} props
 */
function ItemPicker({ items, selected, full, language, onToggle }) {
  const t = useTranslation();
  const [slot, setSlot] = useState('all');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => filterCalcItems(items, { slot, query }), [items, slot, query]);
  const chosen = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="calc-picker">
      <div className="calc-picker__bar">
        <div className="chip-group" role="group" aria-label={t('calculator.items')}>
          {SLOTS.map((key) => (
            <button key={key} type="button" className={`chip${slot === key ? ' active' : ''}`} aria-pressed={slot === key} onClick={() => setSlot(key)}>
              {t(`calculator.slots.${key}`)}
            </button>
          ))}
        </div>
        <div className="filters__search calc-picker__search">
          <span className="filters__search-icon" aria-hidden="true">&gt;</span>
          <input
            type="search"
            className="input"
            value={query}
            placeholder={t('calculator.itemsSearch')}
            aria-label={t('calculator.itemsSearch')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <ul className="calc-items">
        {visible.map((item) => {
          const isChosen = chosen.has(item.id);
          const blocked = full && !isChosen;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`calc-item calc-item--${item.slot}${isChosen ? ' is-chosen' : ''}`}
                aria-pressed={isChosen}
                disabled={blocked}
                title={blocked ? t('calculator.full', { max: CALC.MAX_ITEMS }) : undefined}
                onClick={() => onToggle(item.id)}
              >
                <img src={item.image} alt="" className="calc-item__img" loading="lazy" width="40" height="40" />
                <span className="calc-item__body">
                  <span className="calc-item__name">{item.name}</span>
                  <span className="calc-item__meta">{t('calculator.tier', { tier: item.tier ?? '—' })} · {item.cost}</span>
                  {item.mods.length > 0 && (
                    <span className="calc-item__mods">
                      {item.mods.map((mod) => (
                        <span key={mod.stat} className={mod.always ? 'calc-mod' : 'calc-mod calc-mod--cond'}>{modText(t, language, mod)}</span>
                      ))}
                    </span>
                  )}
                </span>
                {isChosen && <span className="calc-item__mark" aria-hidden="true">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && <p className="calc-hint">{t('search.nothing')}</p>}
    </div>
  );
}

export default ItemPicker;
