import HeroIcon from '../hero/HeroIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { COMPARE_COLORS, compareStats, formatPerLevel, formatStat } from '../../services/compareService';

/**
 * «Кто впереди»: по карточке на каждый показатель, в котором герои различаются. Сверху — лидер и его значение,
 * ниже — полоска каждого героя относительно лидера. Одинаковые у всех характеристики свёрнуты в одну строку.
 * @param {{ heroes: any[] }} props
 */
function CompareLeaders({ heroes }) {
  const t = useTranslation();
  const { differing, identical } = compareStats(heroes);

  if (heroes.length < 2) {
    return heroes.length === 1 ? <p className="cmp-hint">{t('compare.leadersNeedTwo')}</p> : null;
  }

  return (
    <section className="cmp-section" aria-labelledby="cmp-leaders-title">
      <h2 id="cmp-leaders-title" className="section__title">{t('compare.leadersTitle')}</h2>

      <div className="cmp-leaders">
        {differing.map(({ stat, values, best, leaders, extras }) => (
          <div key={stat.id} className="cmp-lead" style={{ '--c': COMPARE_COLORS[leaders[0]] }}>
            <h3 className="cmp-lead__label">{t(stat.label)}</h3>
            <div className="cmp-lead__top">
              <span className="cmp-lead__faces">
                {leaders.map((index) => <HeroIcon key={heroes[index].id} hero={heroes[index]} size="sm" decorative />)}
              </span>
              <span className="cmp-lead__name">{leaders.length === 1 ? heroes[leaders[0]].name : t('compare.tie')}</span>
              <b>{formatStat(stat, best)}</b>
            </div>
            <div className="cmp-lead__bars">
              {values.map((value, index) => (
                <span
                  key={heroes[index].id}
                  className={`cmp-bar${leaders.includes(index) ? ' is-lead' : ''}`}
                  style={{ '--c': COMPARE_COLORS[index] }}
                >
                  <i style={{ width: `${Math.max(6, Math.round((value / best) * 100))}%` }} />
                  <em>
                    <span className="sr-only">{heroes[index].name}: </span>
                    {formatStat(stat, value)}
                    {extras[index] ? <small>{formatPerLevel(extras[index])}{t('compare.perLevel')}</small> : null}
                  </em>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {identical.length > 0 && (
        <p className="cmp-same">
          <b>{t('compare.sameForAll')}:</b>{' '}
          {identical.map(({ stat, value }) => `${t(stat.label)} ${formatStat(stat, value)}`).join(' · ')}
        </p>
      )}
    </section>
  );
}

export default CompareLeaders;
