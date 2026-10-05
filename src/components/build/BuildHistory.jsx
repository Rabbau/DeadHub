import HeroIcon from '../hero/HeroIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatAgo, formatNumber } from '../../services/format';

const SLOT_KEYS = { weapon: 'itemCard.slotWeapon', spirit: 'itemCard.slotSpirit', vitality: 'itemCard.slotVitality' };
const SHORT_COUNT = 4;

/**
 * «Твои последние броски»: четыре последних (все — по кнопке), по щелчку бросок возвращается на экран со своими
 * предметами и настройками. Хранится только в этом браузере.
 * @param {{ entries: any[], heroes: any[], expanded: boolean, onToggle: () => void, onPick: (entry: any) => void, onClear: () => void }} props
 */
function BuildHistory({ entries, heroes, expanded, onToggle, onPick, onClear }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  if (entries.length === 0) return null;

  const shown = expanded ? entries : entries.slice(0, SHORT_COUNT);
  const describe = (entry) => {
    const slots = entry.options.slots.length === 1
      ? t(SLOT_KEYS[entry.options.slots[0]])
      : t.plural('buildPage.slotsCount', entry.options.slots.length);
    return [t(`buildPage.modeShort.${entry.options.mode}`), slots, formatAgo(entry.at, language)].join(' · ');
  };

  return (
    <section className="build-history" id="build-history" aria-labelledby="build-history-title">
      <h2 id="build-history-title" className="build-history__head">
        <span>{t('buildPage.historyTitle')}</span>
        <i aria-hidden="true" />
        {entries.length > SHORT_COUNT && (
          <button type="button" className="build-link" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? t('buildPage.historyLess') : t('buildPage.historyAll', { count: entries.length })}
          </button>
        )}
        <button type="button" className="build-link" onClick={onClear}>{t('buildPage.historyClear')}</button>
      </h2>

      <ul className="build-history__list">
        {shown.map((entry) => {
          const hero = heroes.find((candidate) => candidate.id === entry.heroId);
          const name = hero?.name ?? entry.heroName;
          return (
            <li key={`${entry.seed}-${entry.heroId}-${entry.at}`}>
              <button type="button" className="build-roll" onClick={() => onPick(entry)}>
                {hero ? <HeroIcon hero={hero} size="md" decorative /> : <span className="build-roll__blank" aria-hidden="true">{name.slice(0, 1)}</span>}
                <span className="build-roll__text">
                  <b>{name}</b>
                  <small>{describe(entry)}</small>
                </span>
                <span className="build-roll__total">{formatNumber(entry.total, language)}</span>
                <span className="sr-only">{t('buildPage.historyOpen')}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default BuildHistory;
