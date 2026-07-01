import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';

function LangToggle({ language, onToggle }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '2px',
        cursor: 'pointer',
        transition: 'border-color var(--t-fast)',
      }}
      onClick={onToggle}
    >
      <span style={{
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        background: language === 'english' ? 'var(--neon)' : 'transparent',
        color: language === 'english' ? '#000' : 'var(--text-2)',
        fontWeight: 600,
        fontSize: '0.75rem',
        transition: 'all var(--t-fast)',
      }}>EN</span>
      <span style={{
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        background: language === 'russian' ? 'var(--neon)' : 'transparent',
        color: language === 'russian' ? '#000' : 'var(--text-2)',
        fontWeight: 600,
        fontSize: '0.75rem',
        transition: 'all var(--t-fast)',
      }}>RU</span>
    </div>
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
            <NavLink to="/items" className="nav__link">{t('nav.items')}</NavLink>
            <NavLink to="/build" className="nav__link">{t('nav.randomBuild')}</NavLink>
            <NavLink to="/tierlist" className="nav__link">{t('nav.tierlist')}</NavLink>
            <NavLink to="/compare" className="nav__link">{t('nav.compare')}</NavLink>
          </div>

          <div className="nav__desktop-lang" style={{ display: 'flex' }}>
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
          <NavLink to="/items" className="nav__link" onClick={closeDrawer}>{t('nav.items')}</NavLink>
          <NavLink to="/build" className="nav__link" onClick={closeDrawer}>{t('nav.randomBuild')}</NavLink>
          <NavLink to="/tierlist" className="nav__link" onClick={closeDrawer}>{t('nav.tierlist')}</NavLink>
          <NavLink to="/compare" className="nav__link">{t('nav.compare')}</NavLink>
        </div>

        <div className="nav__drawer-lang">
          <LangToggle language={language} onToggle={toggleLanguage} />
        </div>
      </div>
    </>
  );
}

export default Nav;