import { useTranslation } from '../../hooks/useTranslation';
import { localeFor } from '../../services/format';

/** Число для таблицы: целое или с одним-двумя знаками, по правилам языка интерфейса. */
function useNumber(language) {
  return (value, digits = 0) => new Intl.NumberFormat(localeFor(language), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Разница со столбцом «герой без предметов»: «+495», «−3,2», пусто, если разницы нет. */
function Delta({ now, base, digits = 0, format }) {
  const diff = now - base;
  if (Math.abs(diff) < 10 ** -(digits + 1)) return null;
  return <span className={`calc-delta ${diff > 0 ? 'calc-delta--up' : 'calc-delta--down'}`}>{diff > 0 ? '+' : '−'}{format(Math.abs(diff), digits)}</span>;
}

/**
 * Таблица результата: герой без предметов, с постоянными бонусами и «если условия выполнены». Строки про оружие
 * пропадают, если у героя нет данных об оружии.
 * @param {{ result: ReturnType<typeof import('../../services/calculatorService.js').computeBuild>, language: string }} props
 */
function CalcResults({ result, language }) {
  const t = useTranslation();
  const format = useNumber(language);
  const { base, permanent, peak } = result;
  const hasWeapon = Boolean(base.weapon);

  const rows = [
    { key: 'health', label: t('calculator.health'), pick: (s) => s.health, digits: 0 },
    { key: 'regen', label: t('calculator.regen'), pick: (s) => s.regen, digits: 1, suffix: t('calculator.perSecond') },
    ...(hasWeapon
      ? [
        { key: 'damagePerShot', label: t('calculator.damagePerShot'), pick: (s) => s.weapon.damagePerShot, digits: 1 },
        { key: 'shotsPerSecond', label: t('calculator.shotsPerSecond'), pick: (s) => s.weapon.shotsPerSecond, digits: 2 },
        { key: 'clip', label: t('calculator.clip'), pick: (s) => s.weapon.clip, digits: 0 },
        { key: 'dps', label: t('calculator.dps'), pick: (s) => s.weapon.dps, digits: 1, strong: true },
        { key: 'dpsSustained', label: t('calculator.dpsSustained'), pick: (s) => s.weapon.dpsSustained, digits: 1, strong: true },
      ]
      : []),
  ];

  return (
    <div className="calc-results">
      <div className="compare-table-wrapper">
        <table className="lb-table calc-table">
          <caption className="sr-only">{t('calculator.results')}</caption>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">{t('calculator.results')}</span></th>
              <th scope="col" className="num">{t('calculator.colBase')}</th>
              <th scope="col" className="num" title={t('calculator.colPermanentHint')}>{t('calculator.colPermanent')}</th>
              <th scope="col" className="num calc-table__peak" title={t('calculator.colPeakHint')}>{t('calculator.colPeak')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const b = row.pick(base);
              return (
                <tr key={row.key} className={row.strong ? 'calc-table__strong' : undefined}>
                  <th scope="row">{row.label}</th>
                  <td className="num">{format(b, row.digits)}{row.suffix}</td>
                  <td className="num">
                    {format(row.pick(permanent), row.digits)}{row.suffix} <Delta now={row.pick(permanent)} base={b} digits={row.digits} format={format} />
                  </td>
                  <td className="num calc-table__peak">
                    {format(row.pick(peak), row.digits)}{row.suffix} <Delta now={row.pick(peak)} base={b} digits={row.digits} format={format} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasWeapon && base.weapon.bullets > 1 && <p className="calc-hint">{t('calculator.pellets', { count: base.weapon.bullets })}</p>}
      {!hasWeapon && <p className="calc-hint">{t('calculator.noWeapon')}</p>}
      <p className="calc-hint">{t('calculator.colPeakHint')}</p>
    </div>
  );
}

export default CalcResults;
