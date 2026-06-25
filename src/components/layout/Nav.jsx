import { NavLink } from 'react-router-dom';

function Nav() {
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
      </div>
    </nav>
  );
}

export default Nav;