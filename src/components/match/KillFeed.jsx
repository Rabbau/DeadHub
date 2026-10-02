import { useMemo, useState } from 'react';
import HeroIcon from '../hero/HeroIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDuration } from '../../services/format';
import { killFeed } from '../../services/matchService';

const FIRST = 24;

/** Герой в хронике: значок и имя, цвет рамки — команда. */
function Who({ player, heroMap, profiles }) {
  if (!player) return null;
  const hero = heroMap[player.hero] ?? { name: `#${player.hero}` };
  const name = profiles.get(player.account)?.name;
  return (
    <span className={`kill-who kill-who--${player.team === 0 ? 'a' : 'b'}`} title={name ? `${hero.name} — ${name}` : hero.name}>
      <HeroIcon hero={hero} size="xs" decorative />
      <span className="kill-who__name">{hero.name}</span>
    </span>
  );
}

/**
 * Хроника убийств: время, кто и кого. Первые строки сразу, остальное — по кнопке: в долгом матче их больше сотни.
 * @param {{ match: object, heroMap: Record<number, object>, profiles: Map<number, object> }} props
 */
function KillFeed({ match, heroMap, profiles }) {
  const t = useTranslation();
  const [all, setAll] = useState(false);
  const feed = useMemo(() => killFeed(match), [match]);
  const bySlot = useMemo(() => new Map(match.players.map((player) => [player.slot, player])), [match]);

  if (feed.length === 0) return null;
  const rows = all ? feed : feed.slice(0, FIRST);

  return (
    <section className="section match-feed">
      <h2 className="section__title">{t('match.feedTitle', { count: feed.length })}</h2>
      <ol className="kill-feed">
        {rows.map((kill, i) => (
          <li key={`${kill.time}-${kill.victim}-${i}`} className="kill-feed__row">
            <span className="kill-feed__time">{formatDuration(kill.time)}</span>
            {kill.killer != null
              ? <Who player={bySlot.get(kill.killer)} heroMap={heroMap} profiles={profiles} />
              : <span className="kill-who kill-who--env">{t('match.environment')}</span>}
            <span className="kill-feed__arrow" role="img" aria-label={t('match.killed')}>→</span>
            <Who player={bySlot.get(kill.victim)} heroMap={heroMap} profiles={profiles} />
          </li>
        ))}
      </ol>
      {feed.length > FIRST && (
        <button type="button" className="btn btn-secondary match-feed__more" onClick={() => setAll((value) => !value)}>
          {all ? t('match.feedLess', { count: FIRST }) : t('match.feedAll', { count: feed.length })}
        </button>
      )}
    </section>
  );
}

export default KillFeed;
