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
        <div 
          className="lang-toggle"
          onClick={toggleLanguage}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && toggleLanguage()}
        >
          <span className={`lang-option ${language === 'english' ? 'active' : ''}`}>EN</span>
          <div className="lang-slider">
            <div className={`lang-slider-thumb ${language === 'russian' ? 'right' : ''}`} />
          </div>
          <span className={`lang-option ${language === 'russian' ? 'active' : ''}`}>RU</span>
        </div>
      </div>
    </nav>
  );
}

export default Nav;