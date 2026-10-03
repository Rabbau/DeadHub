import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import HeroIcon from '../hero/HeroIcon';
import { TIER_COLORS } from '../tierlist/constants';
import { requestSearch } from '../layout/searchEvents';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatAge, formatShortDate } from '../../services/format';
import { formatPickrate, formatWinrate, winrateColor } from '../../services/heroService';
import { HOME_QUICK_HEROES, HOME_SECTIONS, HOME_TIER_HEROES, bannerArt, tierPreview } from '../../services/homeService';
import { patchName } from '../../services/patchService';
import { MAX_TIER } from '../../services/statsFilters';
import { TIER_ORDER, buildTierList } from '../../services/tierService';

const SECTION = Object.fromEntries(HOME_SECTIONS.map((section) => [section.id, section]));

// Быстрые ссылки под поиском: имена самых популярных героев и три раздела, куда заходят чаще всего
const QUICK_SECTIONS = ['tierlist', 'draft', 'me'];
const BUILD_SLOTS = 12;
const WINRATE_PLATE = { good: 'good', neutral: 'neutral', bad: 'bad' };

/**
 * Плитка-ссылка на раздел: наклейка с названием, картинка или данные (скринридеру они не нужны: смысл плитки
 * в названии и строке о том, что внутри) и сама строка из описания раздела.
 */
function Tile({ id, tone = 'dark', plate = 'cyan', children }) {
  const t = useTranslation();
  const section = SECTION[id];

  return (
    <Link to={section.to} className={`gt gt--${tone} t-${id}`}>
      <span className="gt__head"><span className={`tag tag--${plate}`}>{t(section.nameKey)}</span></span>
      {children && <span className="gt__art" aria-hidden="true">{children}</span>}
      <span className="gt__text">{t(`home.sections.${id}`)}</span>
    </Link>
  );
}

/**
 * Поиск. Плитка не содержит поля ввода: большая «строка» — кнопка, она открывает то же окно поиска, что и кнопка
 * в шапке и клавиша «/» (его код подгружается отдельно), поэтому поиск на главной ищет по тем же героям,
 * предметам, разделам и игрокам. Под ней — быстрые ссылки.
 */
function SearchTile({ heroes }) {
  const t = useTranslation();
  const buttonRef = useRef(null);

  return (
    <div className="gt gt--paper t-search">
      <span className="gt__head"><span className="tag tag--orange">{t('search.button')}</span></span>
      <button
        ref={buttonRef}
        type="button"
        className="home-search"
        aria-haspopup="dialog"
        aria-keyshortcuts="/"
        onClick={() => requestSearch(buttonRef.current)}
      >
        <span className="home-search__prompt" aria-hidden="true">&gt;</span>
        <span className="home-search__text">
          <span className="sr-only">{t('search.open')}: </span>
          {t('search.placeholder')}
        </span>
        <kbd className="home-search__key" aria-hidden="true">/</kbd>
      </button>
      <div className="home-quick">
        {heroes.map((hero) => <Link key={hero.id} to={`/hero/${hero.id}`}>{hero.name}</Link>)}
        {QUICK_SECTIONS.map((id) => <Link key={id} to={SECTION[id].to}>{t(SECTION[id].nameKey)}</Link>)}
      </div>
    </div>
  );
}

/**
 * Герой периода: те же цифры и тот же выбор, что на странице меты. Пока данные грузятся — пустая рамка того же размера
 * (плитка не прыгает), если их нет совсем — обычная плитка списка героев.
 */
function HeroTile({ hero, loading }) {
  const t = useTranslation();
  if (loading) {
    return (
      <div className="gt gt--brown t-hero" aria-hidden="true">
        <span className="gt__head"><span className="tag tag--yellow">{t('meta.heroOfWeek')}</span></span>
        <span className="gt-frame gt-frame--loading" />
      </div>
    );
  }
  if (!hero) {
    return (
      <Tile id="heroes" tone="brown" plate="yellow">
        <span className="gt-grid">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</span>
      </Tile>
    );
  }

  const plate = WINRATE_PLATE[winrateColor(hero.stats.winrate)];
  return (
    <Link to={`/hero/${hero.id}`} className="gt gt--brown t-hero">
      <span className="gt__head"><span className="tag tag--yellow">{t('meta.heroOfWeek')}</span></span>
      <span className="gt-frame" aria-hidden="true">
        {hero.image_url ? <img src={hero.image_url} alt="" loading="lazy" /> : <span className="gt-frame__empty">{hero.name.slice(0, 2)}</span>}
      </span>
      <span className="gt-hero__name">{hero.name}</span>
      <span className="gt-hero__stats">
        <span className={`tag tag--${plate}`}>WR {formatWinrate(hero.stats.winrate)}</span>
        <span className="tag tag--cream">PR {formatPickrate(hero.stats.pickrate)}</span>
      </span>
    </Link>
  );
}

/** Последнее обновление: открытка с артом (пока обновление свежее) и название свежего патча. Список патчей уже загрузила шапка. */
function UpdateTile({ photo }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const patch = useHeroStore((state) => state.patch);

  return (
    <Link to={SECTION.update.to} className={`gt gt--dark t-update${photo ? ' t-update--photo' : ''}`}>
      <span className="gt__head"><span className="tag tag--cream">{t('home.latestUpdate')}</span></span>
      {photo && (
        <span className="gt-frame gt-frame--wide" aria-hidden="true">
          <img src={photo} alt="" loading="lazy" width="760" height="428" />
        </span>
      )}
      <span className="gt__caption">
        {patch ? patchName(patch.title) : t('home.patchNotes')}
        <small>{patch ? `${formatShortDate(patch.at, language)} · ${formatAge(patch.at, language)} · ` : ''}{t('home.patchNotes')} →</small>
      </span>
    </Link>
  );
}

/** Карта: арт города с маркерами цели и те же названия слоёв, что на самой карте. */
function MapTile() {
  const t = useTranslation();
  return (
    <Link to={SECTION.map.to} className="gt gt--teal t-map">
      <img className="gt-map__img" src="/art/map.webp" alt="" aria-hidden="true" loading="lazy" width="640" height="641" />
      <span className="gt-map__body">
        <span className="gt__head"><span className="tag tag--cyan">{t(SECTION.map.nameKey)}</span></span>
        <span className="gt__text">{t('home.sections.map')}</span>
        <span className="gt-map__legend" aria-hidden="true">
          <span className="tag tag--yellow">{t('map.layers.objectives.name')}</span>
          <span className="tag tag--orange">{t('map.layers.heat.name')}</span>
          <span className="tag tag--green">{t('map.layers.ziplines.name')}</span>
        </span>
      </span>
    </Link>
  );
}

/** Тир-лист: по четыре героя каждого тира из тех же данных, что на странице тир-листа. Пока героев нет — пустые клетки. */
function TierTile({ rows }) {
  const shown = rows.length ? rows : TIER_ORDER.map((tier) => ({ tier, heroes: [] }));
  return (
    <Tile id="tierlist" tone="olive" plate="green">
      {shown.map(({ tier, heroes }) => (
        <span key={tier} className="gt-tier">
          <b className="gt-tier__letter" style={{ background: TIER_COLORS[tier] }}>{tier}</b>
          {heroes.length
            ? heroes.map((hero) => <HeroIcon key={hero.id} hero={hero} size="sm" decorative />)
            : Array.from({ length: HOME_TIER_HEROES }, (_, index) => <i key={index} className="gt-tier__empty" />)}
        </span>
      ))}
    </Tile>
  );
}

/**
 * Витрина инструментов сайта: плитки разной величины в сетке (.home-tiles). Где есть что показать из уже
 * загруженных данных (герой периода, тир-лист, патч), плитки показывают их; остальные — рисунок раздела.
 * Новых запросов к API плитки не делают: герои приходят от родителя.
 * @param {{ dashboard: ReturnType<typeof import('../../hooks/useMetaDashboard').useMetaDashboard> }} props
 */
function HomeTiles({ dashboard }) {
  const t = useTranslation();
  const { allHeroes, heroOfWeek, topPickrate, topWinrate, loading } = dashboard;
  const art = bannerArt();

  const tiers = useMemo(() => tierPreview(buildTierList(allHeroes).tiers), [allHeroes]);
  const popular = topPickrate.slice(0, 6);
  const [first, second] = topWinrate;

  return (
    <section className="section">
      <h2 className="section__title">{t('home.toolsTitle')}</h2>
      <div className="home-tiles">
        <SearchTile heroes={popular.slice(0, HOME_QUICK_HEROES)} />
        <UpdateTile photo={art?.photo} />
        <HeroTile hero={heroOfWeek} loading={loading} />
        <MapTile />
        <TierTile rows={tiers} />

        <Tile id="matchups" tone="dark" plate="rose">
          {first && second && (
            <span className="gt-duel">
              <HeroIcon hero={first} size="lg" decorative />
              <b>vs</b>
              <HeroIcon hero={second} size="lg" decorative />
            </span>
          )}
        </Tile>

        <Tile id="draft" tone="brown" plate="orange">
          <span className="gt-duel gt-duel--team">
            {popular.slice(2, 6).map((hero) => <HeroIcon key={hero.id} hero={hero} size="md" decorative />)}
            <b>vs</b>
            <i className="gt-duel__pick">?</i>
          </span>
        </Tile>

        <Tile id="ranks" tone="teal" plate="yellow">
          <span className="gt-ladder">
            {Array.from({ length: MAX_TIER }, (_, index) => <i key={index} style={{ '--h': `${22 + index * 7.5}%` }} />)}
          </span>
        </Tile>

        <Tile id="items" tone="dark" plate="cream">
          <span className="gt-slots">
            <i className="gt-slots__weapon" />
            <i className="gt-slots__vitality" />
            <i className="gt-slots__spirit" />
          </span>
        </Tile>

        <Tile id="build" tone="brown" plate="orange">
          <span className="gt-build">{Array.from({ length: BUILD_SLOTS }, (_, index) => <i key={index} />)}</span>
        </Tile>

        <Tile id="players" tone="olive" plate="green">
          <span className="gt-input"><b>&gt;</b> {t('players.searchPlaceholder')}</span>
        </Tile>

        <Tile id="compare" tone="dark" plate="rose">
          <span className="gt-duel gt-duel--trio">
            {popular.slice(0, 3).map((hero) => <HeroIcon key={hero.id} hero={hero} size="lg" decorative />)}
          </span>
        </Tile>
      </div>
    </section>
  );
}

export default HomeTiles;
