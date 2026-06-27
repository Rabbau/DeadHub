import { NavLink } from 'react-router-dom';
import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';

function Nav() {
  const language = useHeroStore(state => state.language);
  const setLanguage = useHeroStore(state => state.setLanguage);
  const t = useTranslation();

  const toggleLanguage = () => {
    const newLang = language === 'english' ? 'russian' : 'english';
    setLanguage(newLang);
  };

  return (
    <nav className="nav">
      <div className="nav__inner">
        <div className="nav__logo">
          Dead<span>Hub</span>
        </div>
        <div className="nav__links">
          <NavLink to="/" className="nav__link" end>{t('nav.heroes')}</NavLink>
          <NavLink to="/items" className="nav__link">{t('nav.items')}</NavLink>
          <NavLink to="/build" className="nav__link">{t('nav.randomBuild')}</NavLink>
        </div>
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
          onClick={toggleLanguage}
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
      </div>
    </nav>
  );
}

export default Nav;