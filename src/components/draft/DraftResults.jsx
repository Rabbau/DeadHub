import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroIcon from '../hero/HeroIcon';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { certaintyLevel } from '../../services/draftService';
import { formatNumber, formatPoints } from '../../services/format';
import { formatWinrate, winrateColor } from '../../services/heroService';

const TOP = 10;
const DOTS = { high: '●●●', medium: '●●○', low: '●○○' };

/** Подпись колонки: на широком экране полная, на телефоне короткая (переключает CSS). */
function Label({ long, short }) {
  return (
    <>
      <span className="draft-label--long">{long}</span>
      <span className="draft-label--short">{short}</span>
    </>
  );
}

/** Вклад в пунктах винрейта со знаком; цвет — только у заметных значений (меньше 0,05 пп — «ноль»). */
function Effect({ value }) {
  const tone = value > 0.0005 ? 'up' : value < -0.0005 ? 'down' : 'flat';
  return <span className={`draft-effect draft-effect--${tone}`}>{formatPoints(value, 1)}</span>;
}

/** Герой из разбора: чип со значком, именем и вкладом пары. */
function PairChip({ item, hero, kind }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const name = hero?.name ?? `#${item.id}`;

  if (item.missing) {
    return <span className="draft-pair draft-pair--missing" title={t('draft.noPairData')}>{name}: {t('draft.noPairData')}</span>;
  }
  const title = t(kind === 'counter' ? 'draft.pairTitleCounter' : 'draft.pairTitleSynergy', {
    name,
    wr: formatWinrate(item.wr),
    count: formatNumber(item.matches, language),
    pure: formatPoints(item.pure, 1),
    weight: Math.round(item.weight * 100),
    effect: formatPoints(item.effect, 1),
  });
  return (
    <span className="draft-pair" title={title}>
      <HeroIcon hero={hero} size="xs" decorative />
      <span className="draft-pair__name">{name}</span>
      <span className="draft-pair__wr">{formatWinrate(item.wr)}</span>
      <Effect value={item.effect} />
    </span>
  );
}

/**
 * Таблица лучших пиков: скорректированный винрейт, сила героя, вклад контр-пиков и синергий и надёжность.
 * Строку можно раскрыть: видно, какая пара сколько дала.
 * @param {{ result: ReturnType<typeof import('../../services/draftService').rankDraft>, selection: object, heroMap: Record<number, object> }} props
 */
function DraftResults({ result, selection, heroMap }) {
  const t = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(() => new Set());

  const hasEnemies = selection.enemies.length > 0;
  const hasAllies = selection.allies.length > 0;
  const hasPicks = hasEnemies || hasAllies;
  const rows = showAll ? result.rows : result.rows.slice(0, TOP);
  const columns = 3 + (hasPicks ? 1 : 0) + (hasEnemies ? 1 : 0) + (hasAllies ? 1 : 0) + (hasPicks ? 1 : 0);

  const toggle = (id) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  if (result.rows.length === 0) return <p className="matchup-panel__empty">{t('draft.noCandidates')}</p>;

  return (
    <div className="draft-results">
      <div className="hero-table-wrap">
        <table className="hero-table draft-table">
          <thead>
            <tr>
              <th scope="col" className="num draft-table__rank">#</th>
              <th scope="col" className="hero-table__hero">{t('draft.colHero')}</th>
              <th scope="col" className="num" title={hasPicks ? t('draft.colAdjustedHint') : t('draft.colBaseHint')}>
                {hasPicks ? <Label long={t('draft.colAdjusted')} short={t('draft.colAdjustedShort')} /> : 'WR'}
              </th>
              {hasPicks && <th scope="col" className="num draft-table__base" title={t('draft.colBaseHint')}>{t('draft.colBase')}</th>}
              {hasEnemies && (
                <th scope="col" className="num" title={t('draft.colCounterHint')}>
                  <Label long={t('draft.colCounter')} short={t('draft.colCounterShort')} />
                </th>
              )}
              {hasAllies && (
                <th scope="col" className="num" title={t('draft.colSynergyHint')}>
                  <Label long={t('draft.colSynergy')} short={t('draft.colSynergyShort')} />
                </th>
              )}
              {hasPicks && <th scope="col" className="num draft-table__certainty" title={t('draft.certaintyHint')}><Label long={t('draft.colCertainty')} short={t('draft.colCertaintyShort')} /></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const id = row.hero.id;
              const expanded = open.has(id);
              const level = certaintyLevel(row.certainty);
              return (
                <Fragment key={id}>
                  <tr className={expanded ? 'is-open' : undefined}>
                    <td className="num draft-table__rank">{index + 1}</td>
                    <td className="hero-table__hero">
                      <div className="draft-hero">
                        {hasPicks ? (
                          <button
                            type="button"
                            className="draft-hero__toggle"
                            aria-expanded={expanded}
                            aria-controls={`draft-details-${id}`}
                            aria-label={`${t(expanded ? 'draft.hideDetails' : 'draft.showDetails')}: ${row.hero.name}`}
                            onClick={() => toggle(id)}
                          >
                            {expanded ? '▾' : '▸'}
                          </button>
                        ) : null}
                        <Link to={`/hero/${id}`} className="hero-table__link draft-hero__link">
                          <HeroIcon hero={row.hero} size="sm" decorative />
                          <span className="hero-table__name">{row.hero.name}</span>
                          {row.hero.role && <span className="tag tag--role hero-table__role">{row.hero.role}</span>}
                        </Link>
                      </div>
                    </td>
                    <td className={`num winrate-${winrateColor(row.adjusted)}`}>{formatWinrate(row.adjusted)}</td>
                    {hasPicks && <td className="num draft-table__base">{formatWinrate(row.base)}</td>}
                    {hasEnemies && <td className="num"><Effect value={row.counter.total} /></td>}
                    {hasAllies && <td className="num"><Effect value={row.synergy.total} /></td>}
                    {hasPicks && (
                      <td className="num draft-table__certainty">
                        <span className={`draft-certainty draft-certainty--${level}`} aria-label={t(`draft.certainty.${level}`)} title={t(`draft.certainty.${level}`)}>
                          {DOTS[level]}
                        </span>
                      </td>
                    )}
                  </tr>
                  {expanded && (
                    <tr className="draft-details" id={`draft-details-${id}`}>
                      <td colSpan={columns}>
                        {hasEnemies && (
                          <div className="draft-details__group">
                            <span className="draft-details__label">{t('draft.vsEnemies')}</span>
                            {row.counter.items.map((item) => <PairChip key={item.id} item={item} hero={heroMap[item.id]} kind="counter" />)}
                          </div>
                        )}
                        {hasAllies && (
                          <div className="draft-details__group">
                            <span className="draft-details__label">{t('draft.withAllies')}</span>
                            {row.synergy.items.map((item) => <PairChip key={item.id} item={item} hero={heroMap[item.id]} kind="synergy" />)}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {result.rows.length > TOP && (
        <button type="button" className="btn btn-secondary draft-results__more" onClick={() => setShowAll((value) => !value)}>
          {showAll ? t('draft.showTop', { count: TOP }) : t('draft.showAll', { count: result.rows.length })}
        </button>
      )}
    </div>
  );
}

export default DraftResults;
