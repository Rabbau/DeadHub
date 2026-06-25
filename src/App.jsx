import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import HeroPage from './pages/HeroPage'
import BuildPage from './pages/BuildPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="hero/:id" element={<HeroPage />} />
        <Route path="build" element={<BuildPage />} />
      </Route>
    </Routes>
  )
}

export default App