import { NavLink } from 'react-router-dom';
import { useHeroStore } from '../../store/heroStore';

function Nav() {
  const language = useHeroStore(state => state.language);
  const setLanguage = useHeroStore(state => state.setLanguage);

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
          <NavLink to="/" className="nav__link" end>Герои</NavLink>
          <NavLink to="/items" className="nav__link">Предметы</NavLink>
          <NavLink to="/build" className="nav__link">Случайный билд</NavLink>
        </div>
        <button 
          onClick={toggleLanguage} 
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-1)',
            padding: '4px 12px',
            fontFamily: 'var(--font-display)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'border-color var(--t-fast)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--neon-dim)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          {language === 'english' ? '🇬🇧 EN' : '🇷🇺 RU'}
        </button>
      </div>
    </nav>
  );
}

export default Nav;