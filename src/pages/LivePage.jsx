import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import HeroIcon from '../components/hero/HeroIcon';
import LiveMatchCard, { regionLabel } from '../components/live/LiveMatchCard';
import { useCopy } from '../hooks/useCopy';
import { useHeroes } from '../hooks/useHeroes';
import { useLiveMatches } from '../hooks/useLiveMatches';
import { useNow } from '../hooks/useNow';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from '../hooks/useTranslation';
import { useHeroStore } from '../store/heroStore';
import { formatNumber } from '../services/format';
import { filterMatches, heroesOnAir, regionsPresent, sortMatches, summarizeLive } from '../services/liveService';

const PAGE_STEP = 36;
const MODES = ['ranked', 'unranked', 'streetBrawl'];
const SORTS = ['spectators', 'newest', 'longest'];
const HERO_STRIP = 10;

/** «Обновлено 40 с назад» / «5 мин назад» по времени последней загрузки. */
function updatedText(t, updatedAt, now) {
  if (!updatedAt) return '';
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 10) return t('live.updatedNow');
  if (seconds < 60) return t('live.updatedSeconds', { count: seconds });
  return t('live.updatedMinutes', { count: Math.round(seconds / 60) });
}

/** Возраст ссылки на трансляцию в минутах («12 мин назад») для списка остальных трансляций. */
function ageText(language, updatedAt, now) {
  if (!updatedAt) return '—';
  const minutes = Math.max(0, Math.round((now / 1000 - updatedAt) / 60));
  const rtf = new Intl.RelativeTimeFormat(language === 'russian' ? 'ru-RU' : 'en-US', { numeric: 'auto' });
  return rtf.format(-minutes, 'minute');
}

function BroadcastRow({ item, now, language, t }) {
  const [state, copy] = useCopy();
  return (
    <li className="live-others__row">
      <span className="live-others__id">{t('live.matchId', { id: item.matchId })}</span>
      <span className="live-others__age">{t('live.broadcastUpdated', { age: ageText(language, item.updatedAt, now) })}</span>
      <button type="button" className="live-card__copy" onClick={() => copy(item.url)} title={item.url}>
        {state === 'copied' ? `✓ ${t('live.copied')}` : state === 'failed' ? t('live.copyFailed') : `⧉ ${t('live.copy')}`}
      </button>
    </li>
  );
}

/**
 * Идущие матчи (адрес /live): витрина вкладки «Смотреть» игры — режим, регион, герои, зрители, ссылки на трансляции.
 * Фильтры лежат в адресе, поэтому нужным видом можно поделиться. Список сам обновляется раз в две минуты.
 */
function LivePage() {
  const t = useTranslation();
  usePageMeta('live');
  const language = useHeroStore((state) => state.language);
  const { allHeroes } = useHeroes();
  const { matches, broadcasts, loading, refreshing, error, updatedAt, refresh } = useLiveMatches();
  const now = useNow(10000);
  const [params, setParams] = useSearchParams();
  const [shown, setShown] = useState(PAGE_STEP);

  const heroMap = useMemo(() => Object.fromEntries(allHeroes.map((hero) => [hero.id, hero])), [allHeroes]);
  const broadcastById = useMemo(() => new Map(broadcasts.map((item) => [item.matchId, item])), [broadcasts]);

  // Фильтры из адреса: всё неизвестное считается значением по умолчанию
  const mode = MODES.includes(params.get('mode')) ? params.get('mode') : 'all';
  const sort = SORTS.includes(params.get('sort')) ? params.get('sort') : 'spectators';
  const regions = useMemo(() => regionsPresent(matches), [matches]);
  const region = regions.includes(params.get('region')) ? params.get('region') : 'all';
  const heroParam = Number(params.get('hero'));
  const heroId = Number.isInteger(heroParam) && heroParam > 0 ? heroParam : null;
  const onlyBroadcast = params.get('bc') === '1';

  const setFilter = (key, value, fallback) => {
    const next = new URLSearchParams(params);
    if (value === fallback || value == null) next.delete(key);
    else next.set(key, String(value));
    setParams(next, { replace: true });
  };

  // Другой набор фильтров — снова с первой страницы
  useEffect(() => { setShown(PAGE_STEP); }, [mode, region, sort, heroId, onlyBroadcast]);

  const visible = useMemo(
    () => sortMatches(filterMatches(matches, { mode, region, heroId, withBroadcast: onlyBroadcast }, broadcastById), sort),
    [matches, mode, region, heroId, onlyBroadcast, sort, broadcastById],
  );
  const summary = useMemo(() => summarizeLive(matches), [matches]);
  const onAir = useMemo(() => heroesOnAir(matches, HERO_STRIP), [matches]);
  // Трансляции матчей, которых нет в списке вкладки «Смотреть»
  const activeIds = useMemo(() => new Set(matches.map((match) => match.id)), [matches]);
  const others = useMemo(() => broadcasts.filter((item) => !activeIds.has(item.matchId)).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)), [broadcasts, activeIds]);

  const heroName = (id) => heroMap[id]?.name ?? `#${id}`;
  const toggleHero = (id) => setFilter('hero', id === heroId ? null : id, null);

  return (
    <div className="page live-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('live.title')} <em>{t('live.titleAccent')}</em></h1>
          <div className="page-subtitle">{t('live.subtitle')}</div>
        </div>
        <div className="live-status">
          {updatedAt && <span className="live-status__text" aria-live="polite">{updatedText(t, updatedAt, now)}</span>}
          <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading || refreshing}>
            {refreshing ? t('live.refreshing') : t('live.refresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="state-center">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      ) : error && matches.length === 0 ? (
        <div className="state-center state-error">
          <p>{t('live.error')}</p>
          <p className="live-page__hint">{error === 'rateLimited' ? t('match.rateLimited') : t('live.errorHint')}</p>
          <button type="button" className="btn btn-primary" onClick={refresh}>{t('live.retry')}</button>
        </div>
      ) : (
        <>
          <p className="live-page__summary">
            {t('live.summary', { matches: formatNumber(summary.matches, language), players: formatNumber(summary.players, language) })}
            <span className="live-page__auto"> · {t('live.autoNote')}</span>
          </p>
          {error && <p className="live-page__hint live-page__hint--error" role="status">{t('live.error')}</p>}

          {onAir.length > 0 && (
            <section className="section" aria-labelledby="live-air">
              <h2 className="section__title" id="live-air">{t('live.heroesOnAir')}</h2>
              <div className="live-air">
                {onAir.map((entry) => (
                  <button
                    key={entry.heroId}
                    type="button"
                    className={`live-air__hero${entry.heroId === heroId ? ' is-active' : ''}`}
                    aria-pressed={entry.heroId === heroId}
                    title={t('live.heroPlayers', { hero: heroName(entry.heroId), count: entry.players })}
                    onClick={() => toggleHero(entry.heroId)}
                  >
                    <HeroIcon hero={heroMap[entry.heroId]} size="md" decorative />
                    <span className="live-air__count">{entry.players}</span>
                    <span className="sr-only">{t('live.heroPlayers', { hero: heroName(entry.heroId), count: entry.players })}</span>
                  </button>
                ))}
              </div>
              <p className="live-page__hint">{t('live.heroesOnAirNote')}</p>
            </section>
          )}

          <section className="section" aria-label={t('live.filters')}>
            <div className="live-filters">
              <div className="chip-group" role="group" aria-label={t('live.mode')}>
                <button type="button" className={`chip${mode === 'all' ? ' active' : ''}`} aria-pressed={mode === 'all'} onClick={() => setFilter('mode', 'all', 'all')}>
                  {t('live.allModes')} · {summary.matches}
                </button>
                {MODES.map((key) => (
                  <button key={key} type="button" className={`chip${mode === key ? ' active' : ''}`} aria-pressed={mode === key} onClick={() => setFilter('mode', key, 'all')}>
                    {t(`live.modes.${key}`)} · {summary.modes[key]}
                  </button>
                ))}
              </div>
              <label className="live-filters__field">
                <span className="live-filters__label">{t('live.region')}</span>
                <select className="select" value={region} onChange={(event) => setFilter('region', event.target.value, 'all')}>
                  <option value="all">{t('live.allRegions')}</option>
                  {regions.map((key) => <option key={key} value={key}>{regionLabel(t, key)}</option>)}
                </select>
              </label>
              <label className="live-filters__field">
                <span className="live-filters__label">{t('live.sort')}</span>
                <select className="select" value={sort} onChange={(event) => setFilter('sort', event.target.value, 'spectators')}>
                  {SORTS.map((key) => <option key={key} value={key}>{t(`live.sorts.${key}`)}</option>)}
                </select>
              </label>
              <button type="button" className={`chip${onlyBroadcast ? ' active' : ''}`} aria-pressed={onlyBroadcast} onClick={() => setFilter('bc', onlyBroadcast ? null : '1', null)}>
                {t('live.onlyBroadcast')} · {broadcasts.filter((item) => activeIds.has(item.matchId)).length}
              </button>
              {heroId && (
                <button type="button" className="chip active live-filters__hero" onClick={() => toggleHero(heroId)} title={t('live.clearHero')}>
                  {t('live.heroFilter', { hero: heroName(heroId) })} ✕
                </button>
              )}
            </div>
          </section>

          {visible.length === 0 ? (
            <div className="state-center">
              <p>{t('live.empty')}</p>
              <p className="live-page__hint">{t('live.emptyHint')}</p>
            </div>
          ) : (
            <>
              <div className="live-grid">
                {visible.slice(0, shown).map((match) => (
                  <LiveMatchCard
                    key={match.id}
                    match={match}
                    heroMap={heroMap}
                    broadcast={broadcastById.get(match.id)}
                    now={now}
                    language={language}
                    activeHeroId={heroId}
                    onHero={toggleHero}
                  />
                ))}
              </div>
              {shown < visible.length && (
                <button type="button" className="btn btn-secondary live-page__more" onClick={() => setShown((n) => n + PAGE_STEP)}>
                  {t('player.showMore')} ({visible.length - shown})
                </button>
              )}
            </>
          )}

          {others.length > 0 && (
            <details className="live-others">
              <summary>{t('live.others', { count: others.length })}</summary>
              <p className="live-page__hint">{t('live.othersNote')}</p>
              <ul className="live-others__list">
                {others.map((item) => <BroadcastRow key={item.matchId} item={item} now={now} language={language} t={t} />)}
              </ul>
            </details>
          )}

          <p className="live-page__note">{t('live.note')}</p>
          <p className="live-page__note">{t('live.broadcastNote')}</p>
          <p className="live-page__note">{t('live.soulsNote')}</p>
        </>
      )}
    </div>
  );
}

export default LivePage;
