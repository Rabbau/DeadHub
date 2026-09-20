import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';

// also — префикс адреса, на котором пункт тоже считается активным (профиль игрока → «Игроки»)
const NAV_LINKS = [
  { to: '/', key: 'nav.heroes', end: true },
  { to: '/meta', key: 'nav.meta' },
  { to: '/matchups', key: 'nav.matchups' },
  { to: '/items', key: 'nav.items' },
  { to: '/build', key: 'nav.randomBuild' },
  { to: '/tierlist', key: 'nav.tierlist' },
  { to: '/compare', key: 'nav.compare' },
  { to: '/leaderboard', key: 'nav.leaderboard' },
  { to: '/players', key: 'nav.players', also: '/player/' },
];

function LangToggle({ language, onToggle }) {
  return (
    <button type="button" className="lang-toggle" onClick={onToggle} aria-label="Switch language">
      <span className={`lang-option ${language === 'english' ? 'active' : ''}`}>EN</span>
      <span className={`lang-option ${language === 'russian' ? 'active' : ''}`}>RU</span>
    </button>
  );
}

function Nav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const language = useHeroStore(state => state.language);
  const setLanguage = useHeroStore(state => state.setLanguage);
  const t = useTranslation();
  const { pathname } = useLocation();

  const toggleLanguage = () => {
    const newLang = language === 'english' ? 'russian' : 'english';
    setLanguage(newLang);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const renderLinks = (onClick) =>
    NAV_LINKS.map((link) => (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        onClick={onClick}
        className={({ isActive }) =>
          `nav__link${isActive || (link.also && pathname.startsWith(link.also)) ? ' active' : ''}`
        }
      >
        {t(link.key)}
      </NavLink>
    ));

  return (
    <>
      <nav className="nav">
        <div className="nav__inner">
          <div className="nav__logo">
            Dead<span>Hub</span>
          </div>

          <div className="nav__links">{renderLinks()}</div>

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

        <div className="nav__drawer-links">{renderLinks(closeDrawer)}</div>

        <div className="nav__drawer-lang">
          <LangToggle language={language} onToggle={toggleLanguage} />
        </div>
      </div>
    </>
  );
}

export default Nav;
