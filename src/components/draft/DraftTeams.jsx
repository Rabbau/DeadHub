import HeroIcon from '../hero/HeroIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { MAX_ALLIES, MAX_ENEMIES } from '../../services/draftService';

/** Одна отмеченная позиция: герой (нажатие убирает его) или пустое место. */
function Slot({ hero, id, onRemove, removeLabel }) {
  if (id == null) return <span className="draft-slot draft-slot--empty" aria-hidden="true" />;
  return (
    <button
      type="button"
      className="draft-slot"
      title={hero?.name ?? `#${id}`}
      aria-label={`${removeLabel}: ${hero?.name ?? `#${id}`}`}
      onClick={() => onRemove(id)}
    >
      <HeroIcon hero={hero} size="md" decorative />
      <span className="draft-slot__name">{hero?.name ?? `#${id}`}</span>
      <span className="draft-slot__x" aria-hidden="true">×</span>
    </button>
  );
}

function Team({ title, ids, max, heroMap, onRemove, tone }) {
  const t = useTranslation();
  const slots = Array.from({ length: max }, (_, i) => ids[i] ?? null);
  return (
    <section className={`draft-team draft-team--${tone}`} aria-label={title}>
      <h2 className="draft-team__title">
        {title} <span className="draft-team__count">{t('draft.slots', { count: ids.length, max })}</span>
      </h2>
      <div className="draft-team__slots">
        {slots.map((id, i) => (
          <Slot key={id ?? `empty-${i}`} id={id} hero={id == null ? null : heroMap[id]} onRemove={onRemove} removeLabel={t('draft.remove')} />
        ))}
      </div>
    </section>
  );
}

/**
 * Две команды драфта и список недоступных героев. Нажатие на героя убирает его из списка.
 * @param {{ selection: { enemies: number[], allies: number[], excluded: number[] }, heroMap: Record<number, object>, onRemove: (list: string, id: number) => void }} props
 */
function DraftTeams({ selection, heroMap, onRemove }) {
  const t = useTranslation();
  return (
    <div className="draft-teams">
      <Team title={t('draft.enemies')} ids={selection.enemies} max={MAX_ENEMIES} heroMap={heroMap} tone="enemy" onRemove={(id) => onRemove('enemies', id)} />
      <Team title={t('draft.allies')} ids={selection.allies} max={MAX_ALLIES} heroMap={heroMap} tone="ally" onRemove={(id) => onRemove('allies', id)} />
      {selection.excluded.length > 0 && (
        <section className="draft-team draft-team--excluded" aria-label={t('draft.excluded')}>
          <h2 className="draft-team__title">
            {t('draft.excluded')} <span className="draft-team__count">{selection.excluded.length}</span>
          </h2>
          <div className="draft-team__slots">
            {selection.excluded.map((id) => (
              <Slot key={id} id={id} hero={heroMap[id]} onRemove={(heroId) => onRemove('excluded', heroId)} removeLabel={t('draft.remove')} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default DraftTeams;
