import { Outlet } from 'react-router-dom'
import Nav from './Nav'

function Layout() {
  return (
    <div className="layout">
      <Nav />
      <main className="layout__main">
        <Outlet />
      </main>
      <footer className="footer">
        Deadlock Hub &bull; Неофициальный проект
      </footer>
    </div>
  )
}

export default Layout