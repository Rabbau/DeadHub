import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useHeroStore } from '../../store/heroStore';
import { useProfileStore } from '../../store/profileStore';
import { useTranslation } from '../../hooks/useTranslation';
import { isFreshPatch } from '../../services/patchService';
import GlobalSearch from './GlobalSearch';

// Основное меню. also — префикс адреса, на котором пункт тоже считается активным (профиль → «Игроки»);
// badge — пункт, у которого может гореть значок NEW.
const MAIN_LINKS = [
  { to: '/', key: 'nav.heroes', end: true },
  { to: '/meta', key: 'nav.meta' },
  { to: '/matchups', key: 'nav.matchups' },
  { to: '/items', key: 'nav.items' },
  { to: '/map', key: 'nav.map' },
  { to: '/leaderboard', key: 'nav.leaderboard' },
  { to: '/players', key: 'nav.players', also: '/player/' },
  { to: '/update', key: 'nav.update', badge: true },
];

// Инструменты второго плана: в шапке они уходят в выпадающее «Ещё», в мобильном меню идут общим списком
const MORE_LINKS = [
  { to: '/build', key: 'nav.randomBuild' },
  { to: '/tierlist', key: 'nav.tierlist' },
  { to: '/compare', key: 'nav.compare' },
  { to: '/draft', key: 'nav.draft' },
  { to: '/ranks', key: 'nav.ranks' },
];

// «Мой профиль» появляется в меню, только когда посетитель его выбрал
const MY_PROFILE_LINK = { to: '/me', key: 'nav.myProfile' };

function LangToggle({ language, onToggle }) {
  return (
    <button type="button" className="lang-toggle" onClick={onToggle} aria-label="Switch language">
      <span className={`lang-option ${language === 'english' ? 'active' : ''}`}>EN</span>
      <span className={`lang-option ${language === 'russian' ? 'active' : ''}`}>RU</span>
    </button>
  );
}

/** Выпадающее меню «Ещё»: закрывается по клику снаружи, Esc и при переходе на другую страницу. */
function MoreMenu({ links, renderLink, active }) {
  const t = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="nav__more" ref={rootRef}>
      <button
        type="button"
        className={`nav__link nav__more-btn${active ? ' active' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        {t('nav.more')} <span aria-hidden="true">▾</span>
      </button>
      {open && <div className="nav__more-menu">{links.map(renderLink)}</div>}
    </div>
  );
}

function Nav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const language = useHeroStore(state => state.language);
  const setLanguage = useHeroStore(state => state.setLanguage);
  const patch = useHeroStore(state => state.patch);
  const seenUpdate = useHeroStore(state => state.seenUpdate);
  const me = useProfileStore(state => state.me);
  const t = useTranslation();
  const { pathname } = useLocation();

  // Значок NEW на «Обновлении» зависит от последнего патча, поэтому подгружаем его на любой странице
  useEffect(() => {
    useHeroStore.getState().loadPatch();
  }, []);

  const hasNewUpdate = Boolean(patch) && isFreshPatch(patch) && seenUpdate !== patch.id;

  const toggleLanguage = () => {
    const newLang = language === 'english' ? 'russian' : 'english';
    setLanguage(newLang);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const renderLink = (link, onClick) => (
    <NavLink
      key={link.to}
      to={link.to}
      end={link.end}
      onClick={onClick}
      className={({ isActive }) => {
        const active = isActive || (link.also && pathname.startsWith(link.also));
        const isNew = link.badge && hasNewUpdate;
        return `nav__link${active ? ' active' : ''}${isNew ? ' nav__link--new' : ''}`;
      }}
    >
      {t(link.key)}
    </NavLink>
  );

  const moreLinks = me ? [MY_PROFILE_LINK, ...MORE_LINKS] : MORE_LINKS;
  const moreActive = moreLinks.some((link) => pathname.startsWith(link.to));

  return (
    <>
      <nav className="nav">
        <div className="nav__inner">
          <div className="nav__logo">
            Dead<span>Hub</span>
          </div>

          <div className="nav__links">
            {MAIN_LINKS.map((link) => renderLink(link))}
            <MoreMenu links={moreLinks} renderLink={(link) => renderLink(link)} active={moreActive} />
          </div>

          <GlobalSearch />

          <div className="nav__desktop-lang">
            <LangToggle language={language} onToggle={toggleLanguage} />
          </div>

          <button
            className="nav__burger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
      </nav>

      <div className={`nav__overlay ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer} />

      <div className={`nav__drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="nav__drawer-header">
          <div className="nav__logo">
            Dead<span>Hub</span>
          </div>
          <button className="nav__drawer-close" onClick={closeDrawer} aria-label="Close menu">
            ✕
          </button>
        </div>

        <div className="nav__drawer-links">
          {[...MAIN_LINKS, ...moreLinks].map((link) => renderLink(link, closeDrawer))}
        </div>

        <div className="nav__drawer-lang">
          <LangToggle language={language} onToggle={toggleLanguage} />
        </div>
      </div>
    </>
  );
}

export default Nav;
