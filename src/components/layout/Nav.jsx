import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';

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

  const toggleLanguage = () => {
    const newLang = language === 'english' ? 'russian' : 'english';
    setLanguage(newLang);
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <nav className="nav">
        <div className="nav__inner">
          <div className="nav__logo">
            Dead<span>Hub</span>
          </div>

          <div className="nav__links">
            <NavLink to="/" className="nav__link" end>{t('nav.heroes')}</NavLink>
            <NavLink to="/meta" className="nav__link">{t('nav.meta')}</NavLink>
            <NavLink to="/items" className="nav__link">{t('nav.items')}</NavLink>
            <NavLink to="/build" className="nav__link">{t('nav.randomBuild')}</NavLink>
            <NavLink to="/tierlist" className="nav__link">{t('nav.tierlist')}</NavLink>
            <NavLink to="/compare" className="nav__link">{t('nav.compare')}</NavLink>
          </div>

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
          <NavLink to="/" className="nav__link" end onClick={closeDrawer}>{t('nav.heroes')}</NavLink>
          <NavLink to="/meta" className="nav__link" onClick={closeDrawer}>{t('nav.meta')}</NavLink>
          <NavLink to="/items" className="nav__link" onClick={closeDrawer}>{t('nav.items')}</NavLink>
          <NavLink to="/build" className="nav__link" onClick={closeDrawer}>{t('nav.randomBuild')}</NavLink>
          <NavLink to="/tierlist" className="nav__link" onClick={closeDrawer}>{t('nav.tierlist')}</NavLink>
          <NavLink to="/compare" className="nav__link" onClick={closeDrawer}>{t('nav.compare')}</NavLink>
        </div>

        <div className="nav__drawer-lang">
          <LangToggle language={language} onToggle={toggleLanguage} />
        </div>
      </div>
    </>
  );
}

export default Nav;