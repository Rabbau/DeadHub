import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroIcon from '../hero/HeroIcon';
import RankBadge from '../ui/RankBadge';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatCompact, formatDuration, formatNumber } from '../../services/format';
import { finalBuild, kdaOf, maxOf, splitItemLog } from '../../services/matchService';

const MAX_BUILD_ICONS = 12;

/** Предмет сборки: картинка с названием в подсказке; без картинки — первые буквы названия. */
function ItemIcon({ item, id }) {
  if (!item) return <span className="match-item match-item--unknown" title={`#${id}`} aria-hidden="true" />;
  const slot = item.item_slot_type ? ` match-item--${item.item_slot_type}` : '';
  return item.image_url ? (
    <img src={item.image_url} alt="" title={item.name} className={`match-item${slot}`} loading="lazy" decoding="async" />
  ) : (
    <span className={`match-item${slot}`} title={item.name} aria-hidden="true">{item.name.slice(0, 2)}</span>
  );
}

/** Игрок: аватар и имя со ссылкой на профиль; без профиля — «Игрок №…» или «Бот». */
function PlayerName({ player, profile, className = '' }) {
  const t = useTranslation();
  if (!player.account) return <span className={`match-player__name ${className}`}>{t('match.bot')}</span>;
  const name = profile?.name ?? t('match.playerId', { id: player.account });
  return (
    <Link to={`/player/${player.account}`} className={`match-player__link ${className}`}>
      {profile?.avatar && <img src={profile.avatar} alt="" className="match-player__avatar" loading="lazy" decoding="async" />}
      <span className="match-player__name">{name}</span>
    </Link>
  );
}

function PlayerDetails({ player, heroMap, bySlot, catalog, profiles }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const { purchases } = useMemo(
    () => (catalog ? splitItemLog(player.items, (id) => catalog.has(id)) : { purchases: [] }),
    [player.items, catalog],
  );

  return (
    <div className="match-details__body">
      <dl className="match-details__stats">
        <div><dt>{t('match.level')}</dt><dd>{player.level}</dd></div>
        <div><dt>{t('match.souls')}</dt><dd>{formatNumber(player.netWorth, language)}</dd></div>
        <div><dt>{t('match.damage')}</dt><dd>{formatNumber(player.damage, language)}</dd></div>
        <div><dt>{t('match.taken')}</dt><dd>{formatNumber(player.taken, language)}</dd></div>
        <div><dt>{t('match.healing')}</dt><dd>{formatNumber(player.healing, language)}</dd></div>
        <div><dt>{t('match.bossDamage')}</dt><dd>{formatNumber(player.boss, language)}</dd></div>
        <div><dt>KDA</dt><dd>{kdaOf(player).toFixed(2)}</dd></div>
        {player.rank && (
          <div className="match-details__rank">
            <dt>{t('match.rankBefore')}</dt>
            <dd>
              <RankBadge badge={player.rank.badge} />
              {player.rank.change != null && player.rank.change !== 0 && (
                <span className={`match-details__change ${player.rank.change > 0 ? 'positive' : 'negative'}`} title={t('player.rankPoints')}>
                  {player.rank.change > 0 ? '+' : '−'}{Math.abs(player.rank.change)}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      <div className="match-details__block">
        <h4 className="match-details__title">{t('match.purchases')}</h4>
        {!catalog ? (
          <p className="match-details__empty">{t('common.loading')}</p>
        ) : purchases.length === 0 ? (
          <p className="match-details__empty">{t('match.noItems')}</p>
        ) : (
          <ol className="match-purchases">
            {purchases.map((purchase, i) => (
              <li key={`${purchase.id}-${i}`} className={purchase.soldAt ? 'is-sold' : undefined}>
                <span className="match-purchases__time">{formatDuration(purchase.at)}</span>
                <ItemIcon item={catalog.get(purchase.id)} id={purchase.id} />
                {/* Проданное — вычеркнуто, а «продан на …» отдельной строкой: рядом с названием оно съедало бы его */}
                <span className="match-purchases__text">
                  <span className="match-purchases__name">{catalog.get(purchase.id)?.name ?? `#${purchase.id}`}</span>
                  {purchase.soldAt > 0 && <span className="match-purchases__sold">{t('match.sold', { time: formatDuration(purchase.soldAt) })}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {player.deathLog.length > 0 && (
        <div className="match-details__block">
          <h4 className="match-details__title">{t('match.deathsTitle', { count: player.deathLog.length })}</h4>
          <ul className="match-deaths">
            {[...player.deathLog].sort((a, b) => a[0] - b[0]).map(([time, killerSlot], i) => {
              const killer = killerSlot == null ? null : bySlot.get(killerSlot);
              const hero = killer ? heroMap[killer.hero] : null;
              return (
                <li key={`${time}-${i}`}>
                  <span className="match-purchases__time">{formatDuration(time)}</span>
                  {killer ? (
                    <>
                      <HeroIcon hero={hero ?? { name: `#${killer.hero}` }} size="xs" decorative />
                      <span>{hero?.name ?? `#${killer.hero}`}</span>
                      <span className="match-deaths__who">{profiles.get(killer.account)?.name ?? ''}</span>
                    </>
                  ) : (
                    <span className="match-deaths__who">{t('match.environment')}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Таблица одной команды: герой, игрок, K/D/A, душа, добитые и урон, итоговая сборка. Строку можно раскрыть:
 * очки ранга, покупки по времени (с проданными), хроника смертей. Игрок, с профиля которого пришли, подсвечен.
 * @param {{
 *   match: object, team: number, heroMap: Record<number, object>, profiles: Map<number, object>,
 *   catalog: Map<number, object>|null, focus: number|null, focusLabel: string
 * }} props focus — Account ID подсвеченного игрока, focusLabel — подпись на его метке («Вы» или «Выбран»)
 */
function MatchScoreboard({ match, team, heroMap, profiles, catalog, focus, focusLabel }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const [open, setOpen] = useState(() => new Set());

  const players = useMemo(() => match.players.filter((player) => player.team === team), [match, team]);
  const bySlot = useMemo(() => new Map(match.players.map((player) => [player.slot, player])), [match]);
  const topDamage = useMemo(() => maxOf(match, 'damage'), [match]);

  const toggle = (slot) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    return next;
  });

  return (
    <div className="hero-table-wrap match-table-wrap">
      <table className="hero-table match-table">
        <thead>
          <tr>
            <th scope="col" className="hero-table__hero">{t('match.colHero')}</th>
            <th scope="col" className="match-col-player">{t('match.colPlayer')}</th>
            <th scope="col" className="num">K / D / A</th>
            <th scope="col" className="num">{t('match.souls')}</th>
            <th scope="col" className="num match-col-cs" title={t('match.lastHitsHint')}>{t('match.colCs')}</th>
            <th scope="col" className="match-col-damage">{t('match.damage')}</th>
            <th scope="col" className="match-col-build">{t('match.colBuild')}</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const hero = heroMap[player.hero] ?? { name: `#${player.hero}` };
            const profile = profiles.get(player.account);
            const expanded = open.has(player.slot);
            const isFocus = focus != null && player.account === focus;
            const build = catalog
              ? finalBuild(splitItemLog(player.items, (id) => catalog.has(id)).purchases).slice(0, MAX_BUILD_ICONS)
              : [];
            return (
              <Fragment key={player.slot}>
                <tr className={`${expanded ? 'is-open' : ''}${isFocus ? ' is-focus' : ''}`.trim() || undefined}>
                  <td className="hero-table__hero">
                    <div className="match-hero">
                      <button
                        type="button"
                        className="row-toggle"
                        aria-expanded={expanded}
                        aria-label={`${t(expanded ? 'match.hideDetails' : 'match.showDetails')}: ${hero.name}`}
                        onClick={() => toggle(player.slot)}
                      >
                        {expanded ? '▾' : '▸'}
                      </button>
                      <Link to={`/hero/${player.hero}`} className="hero-table__link match-hero__link" title={hero.name}>
                        <HeroIcon hero={hero} size="sm" decorative />
                        <span className="match-hero__text">
                          <span className="hero-table__name">{hero.name}</span>
                          <span className="match-hero__level">{t('match.levelShort', { level: player.level })}</span>
                        </span>
                      </Link>
                    </div>
                    {/* На телефоне колонка с игроком скрыта — имя показываем под героем */}
                    <div className="match-hero__player"><PlayerName player={player} profile={profile} /></div>
                  </td>
                  <td className="match-col-player">
                    <div className="match-player">
                      <PlayerName player={player} profile={profile} />
                      {isFocus && <span className="tag tag--role match-player__tag">{focusLabel}</span>}
                      {player.mvp === 1 && <span className="tag match-player__tag match-player__tag--mvp" title={t('match.mvpHint')}>MVP</span>}
                      {player.mvp > 1 && <span className="tag match-player__tag" title={t('match.mvpHint')}>#{player.mvp}</span>}
                      {player.left != null && <span className="tag match-player__tag match-player__tag--left" title={t('match.leftHint')}>{t('match.left', { time: formatDuration(player.left) })}</span>}
                    </div>
                  </td>
                  <td className="num match-kda" title={`KDA ${kdaOf(player).toFixed(2)}`}>{player.kills}/{player.deaths}/{player.assists}</td>
                  <td className="num">{formatCompact(player.netWorth, language)}</td>
                  <td className="num match-col-cs">{player.lastHits}/{player.denies}</td>
                  <td className="match-col-damage">
                    <span className="match-damage">
                      <span className="match-damage__value">{formatCompact(player.damage, language)}</span>
                      <span className="match-damage__bar" aria-hidden="true">
                        <span style={{ width: `${topDamage > 0 ? Math.max(2, (player.damage / topDamage) * 100) : 0}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className="match-col-build">
                    <div className="match-build">
                      {build.map((purchase, i) => <ItemIcon key={`${purchase.id}-${i}`} item={catalog.get(purchase.id)} id={purchase.id} />)}
                    </div>
                  </td>
                </tr>
                {expanded && (
                  <tr className="match-details">
                    <td colSpan={7}>
                      <PlayerDetails player={player} heroMap={heroMap} bySlot={bySlot} catalog={catalog} profiles={profiles} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default MatchScoreboard;
