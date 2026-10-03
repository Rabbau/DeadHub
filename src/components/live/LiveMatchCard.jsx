import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import HeroIcon from '../hero/HeroIcon';
import { useCopy } from '../../hooks/useCopy';
import { usePlayerNames } from '../../hooks/usePlayerNames';
import { useTranslation } from '../../hooks/useTranslation';
import { formatCompact, formatDuration } from '../../services/format';
import { elapsedSeconds, liveModeKey, soulLead, teamPlayers } from '../../services/liveService';

const TEAMS = [0, 1];

/** Название региона из данных API: известное переводится, незнакомое показывается как есть. */
export function regionLabel(t, region) {
  if (!region) return null;
  return t.has(`live.regions.${region}`) ? t(`live.regions.${region}`) : region.replace(/_/g, ' ');
}

/**
 * Один идущий матч: режим и регион, сколько он идёт, герои двух команд, перевес по душам (не в Street Brawl),
 * список игроков по запросу и ссылка на трансляцию, если она есть. Нажатие на героя включает фильтр по нему.
 */
function LiveMatchCard({ match, heroMap, broadcast, now, language, activeHeroId, onHero }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [copyState, copy] = useCopy();
  const { names, loading, error } = usePlayerNames(match.players.map((player) => player.id), open);

  const mode = liveModeKey(match);
  const elapsed = elapsedSeconds(match, now);
  const lead = soulLead(match);
  const region = regionLabel(t, match.region);
  const [souls0, souls1] = match.souls;
  const showSouls = mode !== 'streetBrawl' && souls0 + souls1 > 0;

  const heroOf = (heroId) => heroMap[heroId];
  const nameOf = (heroId) => heroOf(heroId)?.name ?? `#${heroId}`;

  const soulsText = lead
    ? t('live.soulsLead', { team: lead.leader + 1, souls: formatCompact(lead.lead, language) })
    : t('live.soulsEven');

  return (
    <article className={`live-card live-card--${mode}`} aria-label={t('live.matchId', { id: match.id })}>
      <header className="live-card__head">
        <span className={`tag live-card__mode live-card__mode--${mode}`}>{t(`live.modes.${mode}`)}</span>
        {region && <span className="live-card__region">{region}</span>}
        <span className="live-card__spacer" />
        {match.spectators > 0 && <span className="live-card__spectators">{t('live.spectators', { count: match.spectators })}</span>}
        {elapsed != null && <span className="live-card__time" title={t('live.elapsed', { time: formatDuration(elapsed) })}>{formatDuration(elapsed)}</span>}
      </header>

      <div className="live-card__teams">
        {TEAMS.map((team) => (
          <div key={team} className="live-card__team">
            <span className="live-card__team-name">{t('live.teamN', { n: team + 1 })}</span>
            <span className="live-card__heroes">
              {teamPlayers(match, team).map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className={`live-hero${activeHeroId === player.heroId ? ' is-active' : ''}`}
                  aria-pressed={activeHeroId === player.heroId}
                  title={nameOf(player.heroId)}
                  onClick={() => onHero(player.heroId)}
                >
                  <HeroIcon hero={heroOf(player.heroId)} size="sm" />
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>

      {showSouls && (
        <div className="live-card__souls" title={soulsText}>
          <span className="live-card__souls-bar" aria-hidden="true">
            <span className="live-card__souls-a" style={{ flexGrow: Math.max(souls0, 1) }} />
            <span className="live-card__souls-b" style={{ flexGrow: Math.max(souls1, 1) }} />
          </span>
          <span className="live-card__souls-text">
            {formatCompact(souls0, language)} · {formatCompact(souls1, language)}
            <span className="live-card__souls-lead"> — {soulsText}</span>
          </span>
        </div>
      )}

      <footer className="live-card__foot">
        <button type="button" className="live-card__toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? t('live.hidePlayers') : t('live.showPlayers')} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
        {broadcast && (
          <button type="button" className="live-card__copy" onClick={() => copy(broadcast.url)} title={broadcast.url}>
            {copyState === 'copied' ? `✓ ${t('live.copied')}` : copyState === 'failed' ? t('live.copyFailed') : `⧉ ${t('live.broadcast')}`}
          </button>
        )}
      </footer>

      {open && (
        <div className="live-card__players">
          {loading && <p className="live-card__hint">{t('live.loadingPlayers')}</p>}
          {error && <p className="live-card__hint live-card__hint--error">{t('live.playersError')}</p>}
          <div className="live-card__roster">
            {TEAMS.map((team) => (
              <ul key={team} className="live-roster">
                {teamPlayers(match, team).map((player) => {
                  const profile = names[player.id];
                  return (
                    <li key={player.id}>
                      <Link to={`/player/${player.id}`} className="live-roster__row">
                        <HeroIcon hero={heroOf(player.heroId)} size="xs" decorative />
                        <Avatar src={profile?.avatar} name={profile?.name} />
                        <span className="live-roster__name">{profile?.name ?? t('live.playerById', { id: player.id })}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default LiveMatchCard;
