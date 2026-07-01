import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import HeroPage from './pages/HeroPage';
import BuildPage from './pages/BuildPage';
import ItemsPage from './pages/ItemsPage';
import TierListPage from './pages/TierListPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="hero/:id" element={<HeroPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="build" element={<BuildPage />} />
        <Route path="tierlist" element={<TierListPage />} />
      </Route>
    </Routes>
  );
}

export default App;