import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import HeroIcon from '../components/hero/HeroIcon';
import PlayerPicker from '../components/player/PlayerPicker';
import Avatar from '../components/ui/Avatar';
import RankBadge from '../components/ui/RankBadge';
import { useHeroes } from '../hooks/useHeroes';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePlayerProfile } from '../hooks/usePlayers';
import { useTranslation } from '../hooks/useTranslation';
import { useFavoritesStore } from '../store/favoritesStore';
import { useHeroStore } from '../store/heroStore';
import { usePlayerStore } from '../store/playerStore';
import { useProfileStore } from '../store/profileStore';
import { formatMatchDate, formatNumber } from '../services/format';
import { formatWinrate, winrateColor } from '../services/heroService';
import {
  RECENT_WINDOW, SHARED_HERO_MIN, compareRows, parseAccountParam, playerSnapshot, sharedHeroes, tally,
} from '../services/playersCompareService';
import { topHeroes } from '../services/playerService';

const QUICK_LIMIT = 4;

/** Значение ячейки таблицы по типу строки. */
function Cell({ row, side, language }) {
  const value = row[side];
  if (row.type === 'rank') return <RankBadge badge={value} />;
  if (value == null) return <span className="versus-empty">—</span>;
  if (row.type === 'int') return formatNumber(value, language);
  if (row.type === 'pct') return <span className={`winrate-${winrateColor(value)}`}>{formatWinrate(value)}</span>;
  if (row.type === 'kda') return value.toFixed(2);
  return formatMatchDate(value, language);
}

/** Шапка одного игрока: аватар, ник, ранг и ссылка на профиль; пока загружается или не найден — заглушка. */
function PlayerHead({ accountId, profile, snapshot, onClear, t }) {
  if (profile.loading) {
    return <div className="versus-head versus-head--busy"><div className="spinner" /></div>;
  }
  if (profile.error) {
    return (
      <div className="versus-head">
        <p className="versus-head__error">{t('versus.notFound', { id: accountId })}</p>
        <button type="button" className="cx-link" onClick={onClear}>{t('versus.change')}</button>
      </div>
    );
  }
  return (
    <div className="versus-head">
      <Avatar src={snapshot.avatar} name={snapshot.name} size="lg" />
      <div className="versus-head__info">
        <Link to={`/player/${accountId}`} className="versus-head__name">{snapshot.name}</Link>
        <span className="versus-head__id">ID {accountId}</span>
      </div>
      <button type="button" className="cx-link" onClick={onClear}>{t('versus.change')}</button>
    </div>
  );
}

/**
 * Сравнение двух игроков (адрес /versus?a=…&b=…): ранг, винрейт, KDA, точность, форма и общие герои. Игроки лежат в
 * адресе, поэтому сравнением можно поделиться. Профили берутся теми же запросами и из того же кеша, что и страница игрока.
 */
function VersusPage() {
  const t = useTranslation();
  usePageMeta('versus');
  const language = useHeroStore((state) => state.language);
  const { allHeroes } = useHeroes();
  const [params, setParams] = useSearchParams();
  const me = useProfileStore((state) => state.me);
  const recent = usePlayerStore((state) => state.recent);
  const favoritePlayers = useFavoritesStore((state) => state.players);

  const idA = parseAccountParam(params.get('a'));
  const idB = parseAccountParam(params.get('b'));
  const same = idA != null && idA === idB;

  const profileA = usePlayerProfile(idA);
  const profileB = usePlayerProfile(same ? null : idB);

  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((hero) => [hero.id, hero])), [allHeroes]);

  const setSlot = (key, id) => {
    const next = new URLSearchParams(params);
    if (id) next.set(key, String(id));
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const swap = () => {
    const next = new URLSearchParams();
    if (idB) next.set('a', String(idB));
    if (idA) next.set('b', String(idA));
    setParams(next, { replace: true });
  };

  // Быстрый выбор: «Я», недавно открытые, избранные — без тех, кто уже выбран
  const quick = useMemo(() => {
    const taken = new Set([idA, idB]);
    const list = [];
    const seen = new Set();
    const add = (player, group) => {
      if (!player || taken.has(player.id) || seen.has(player.id)) return;
      seen.add(player.id);
      list.push({ id: player.id, name: player.name ?? null, avatar: player.avatar ?? null, group });
    };
    add(me, 'me');
    favoritePlayers.slice(0, QUICK_LIMIT).forEach((player) => add(player, 'favorites'));
    recent.slice(0, QUICK_LIMIT).forEach((player) => add(player, 'recent'));
    return list.slice(0, QUICK_LIMIT * 2);
  }, [me, favoritePlayers, recent, idA, idB]);

  const ready = idA && idB && !same && !profileA.loading && !profileB.loading && !profileA.error && !profileB.error;
  const snapA = ready ? playerSnapshot(idA, profileA) : null;
  const snapB = ready ? playerSnapshot(idB, profileB) : null;
  const rows = useMemo(() => (snapA && snapB ? compareRows(snapA, snapB) : []), [snapA, snapB]);
  const score = useMemo(() => tally(rows), [rows]);
  const shared = useMemo(() => (snapA && snapB ? sharedHeroes(snapA.heroes, snapB.heroes) : []), [snapA, snapB]);

  const rowLabel = (key) => t(`versus.rows.${key}`, { count: RECENT_WINDOW });
  const heroOf = (heroId) => heroMap[heroId];
  const winrateOf = (hero) => (hero.matches ? hero.wins / hero.matches : 0);

  const slot = (key, id, profile, snapshot, label) => (
    <div className="versus-slot">
      <h2 className="versus-slot__label">{label}</h2>
      {id ? (
        <PlayerHead accountId={id} profile={profile} snapshot={snapshot ?? playerSnapshot(id, profile)} onClear={() => setSlot(key, null)} t={t} />
      ) : (
        <PlayerPicker label={label} quick={quick} onPick={(picked) => setSlot(key, picked)} />
      )}
    </div>
  );

  return (
    <div className="page versus-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('versus.title')} <em>{t('versus.titleAccent')}</em></h1>
          <div className="page-subtitle">{t('versus.subtitle')}</div>
        </div>
        {(idA || idB) && <button type="button" className="btn btn-secondary" onClick={swap}>⇄ {t('versus.swap')}</button>}
      </div>

      <div className="versus-slots">
        {slot('a', idA, profileA, ready ? snapA : null, t('versus.slotA'))}
        {slot('b', idB, profileB, ready ? snapB : null, t('versus.slotB'))}
      </div>

      {same && <p className="versus-message" role="status">{t('versus.same')}</p>}

      {!idA || !idB ? (
        <div className="versus-empty-state">
          <h2>{t('versus.emptyTitle')}</h2>
          <p>{t('versus.emptyText')}</p>
        </div>
      ) : (profileA.loading || profileB.loading) && !same ? (
        <div className="state-center"><div className="spinner" /><p>{t('versus.loading')}</p></div>
      ) : ready ? (
        <>
          <div className="compare-table-wrapper">
            <table className="lb-table versus-table">
              <caption className="sr-only">{t('versus.title')} {t('versus.titleAccent')}</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">{t('versus.title')} {t('versus.titleAccent')}</span></th>
                  <th scope="col" className="num"><Link to={`/player/${idA}`}>{snapA.name}</Link></th>
                  <th scope="col" className="num"><Link to={`/player/${idB}`}>{snapB.name}</Link></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{rowLabel(row.key)}</th>
                    <td className={`num${row.lead === 'a' ? ' versus-lead' : ''}`}><Cell row={row} side="a" language={language} />{row.lead === 'a' && <span className="sr-only"> ★</span>}</td>
                    <td className={`num${row.lead === 'b' ? ' versus-lead' : ''}`}><Cell row={row} side="b" language={language} />{row.lead === 'b' && <span className="sr-only"> ★</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="versus-score">
            {score.lead ? (
              <>
                <strong>{score.lead === 'a' ? snapA.name : snapB.name}</strong> — {t('versus.ahead', { count: score.lead === 'a' ? score.a : score.b, total: rows.filter((row) => row.scored).length })}
              </>
            ) : (
              t('versus.aheadBoth', { count: score.a })
            )}
          </p>

          <div className="versus-heroes">
            {[snapA, snapB].map((snap) => (
              <div key={snap.id} className="versus-heroes__col">
                <h3 className="advice-col__title">{snap.name} · {t('versus.topHeroes')}</h3>
                <ul className="versus-top">
                  {topHeroes(snap.heroes, 3).map((hero) => (
                    <li key={hero.heroId}>
                      <Link to={`/hero/${hero.heroId}`} className="player-hero-cell">
                        <HeroIcon hero={heroOf(hero.heroId)} size="sm" decorative />
                        <span>{heroOf(hero.heroId)?.name ?? `#${hero.heroId}`}</span>
                      </Link>
                      <span className="versus-top__stat">{formatNumber(hero.matches, language)} · <span className={`winrate-${winrateColor(winrateOf(hero))}`}>{formatWinrate(winrateOf(hero))}</span></span>
                    </li>
                  ))}
                  {snap.heroes.length === 0 && <li className="versus-empty">—</li>}
                </ul>
              </div>
            ))}
          </div>

          <section className="section" aria-labelledby="versus-shared">
            <h2 className="section__title" id="versus-shared">{t('versus.shared')}</h2>
            {shared.length === 0 ? (
              <p className="matchup-panel__empty">{t('versus.sharedEmpty', { count: SHARED_HERO_MIN })}</p>
            ) : (
              <div className="compare-table-wrapper">
                <table className="lb-table versus-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('player.hero')}</th>
                      <th scope="col" className="num">{snapA.name}</th>
                      <th scope="col" className="num">{snapB.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shared.map((row) => (
                      <tr key={row.heroId}>
                        <td className="lb-table__name">
                          <Link to={`/hero/${row.heroId}`} className="player-hero-cell">
                            <HeroIcon hero={heroOf(row.heroId)} size="sm" decorative />
                            <span>{heroOf(row.heroId)?.name ?? `#${row.heroId}`}</span>
                          </Link>
                        </td>
                        {['a', 'b'].map((side) => (
                          <td key={side} className={`num${row.lead === side ? ' versus-lead' : ''}`}>
                            <span className={`winrate-${winrateColor(row[side].winrate)}`}>{formatWinrate(row[side].winrate)}</span>
                            <span className="versus-matches"> · {t('versus.matchesShort', { count: formatNumber(row[side].matches, language) })}</span>
                            {row.lead === side && <span className="sr-only"> ★</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="versus-hint">{t('versus.sharedHint', { count: SHARED_HERO_MIN })}</p>
          </section>
          <p className="versus-hint">{t('versus.note')}</p>
        </>
      ) : null}
    </div>
  );
}

export default VersusPage;
