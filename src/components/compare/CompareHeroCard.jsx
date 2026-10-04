import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { COMPARE_COLORS, heroMeta } from '../../services/compareService';

const PIPS = [1, 2, 3];

/** Ромбики сложности: заполнены столько, сколько сложность героя из трёх. */
function Complexity({ value }) {
  const t = useTranslation();
  if (!value) return null;
  return (
    <span className="cmp-pips" role="img" aria-label={t('compare.complexityOf', { value })}>
      {PIPS.map((pip) => <i key={pip} className={pip <= value ? 'on' : ''} />)}
    </span>
  );
}

const number = (value, digits = 1) => (value === null ? '—' : `${value.toFixed(digits)}%`);

/**
 * Карточка выбранного героя: портрет в рамке, роль и сложность, мета, теги и способности.
 * Цвет полосы слева тот же, что у фигуры героя на радаре и у его полосок ниже.
 */
function CompareHeroCard({ hero, index, onRemove }) {
  const t = useTranslation();
  const meta = heroMeta(hero);
  const tags = hero.stats?.tags ?? [];
  const abilities = (hero.abilities ?? []).map((ability) => ability.name).filter(Boolean);

  return (
    <article className="cmp-hero" style={{ '--c': COMPARE_COLORS[index] }}>
      <button type="button" className="cmp-hero__x" onClick={() => onRemove(hero.id)} aria-label={t('compare.remove', { name: hero.name })}>✕</button>

      <span className="cmp-frame" style={{ '--r': `${[-1.4, 1, -0.7][index] ?? 0}deg` }} aria-hidden="true">
        {hero.image_url ? <img src={hero.image_url} alt="" loading="lazy" /> : <span className="cmp-frame__empty">{hero.name.slice(0, 2)}</span>}
      </span>

      <div className="cmp-hero__info">
        <h2 className="cmp-hero__name"><Link to={`/hero/${hero.id}`}>{hero.name}</Link></h2>
        <div className="cmp-hero__row">
          {hero.role && <span className="tag tag--cyan">{hero.role}</span>}
          <Complexity value={hero.complexity} />
          {hero.stats?.gunTag && <span className="cmp-hero__gun">{hero.stats.gunTag}</span>}
        </div>

        <dl className="cmp-pills">
          <div className="cmp-pill">
            <dt>{t('compare.winrateShort')}</dt>
            <dd className={`cmp-wr cmp-wr--${meta.tone}`}>{number(meta.winrate)}</dd>
          </div>
          <div className="cmp-pill">
            <dt>{t('compare.pickrateShort')}</dt>
            <dd>{number(meta.pickrate)}</dd>
          </div>
          <div className="cmp-pill">
            <dt>{t('compare.matches')}</dt>
            <dd>{meta.matches === null ? '—' : meta.matches.toLocaleString()}</dd>
          </div>
        </dl>

        {tags.length > 0 && <ul className="cmp-chips">{tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
        {abilities.length > 0 && (
          <ul className="cmp-chips cmp-chips--abilities" aria-label={t('compare.abilities')}>
            {abilities.map((name) => <li key={name}>{name}</li>)}
          </ul>
        )}
      </div>
    </article>
  );
}

/** Пустое место под героя: кнопка, которая ведёт к выбору. */
export function CompareSlot({ index, onPick }) {
  const t = useTranslation();
  return (
    <button type="button" className="cmp-slot" style={{ '--c': COMPARE_COLORS[index] }} onClick={onPick}>
      <b aria-hidden="true">+</b>
      <span>{t('compare.slot')}</span>
    </button>
  );
}

export default CompareHeroCard;
