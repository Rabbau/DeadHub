import { Routes, Route } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";   // ← правильный импорт
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import HeroPage from './pages/HeroPage';
import BuildPage from './pages/BuildPage';
import ItemsPage from './pages/ItemsPage';
import ItemPage from './pages/ItemPage';
import MetaPage from './pages/MetaPage';
import TierListPage from './pages/TierListPage';
import ComparePage from './pages/ComparePage';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="hero/:id" element={<HeroPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="items/:id" element={<ItemPage />} />
          <Route path="meta" element={<MetaPage />} />
          <Route path="build" element={<BuildPage />} />
          <Route path="tierlist" element={<TierListPage />} />
          <Route path="compare" element={<ComparePage />} />
        </Route>
      </Routes>
      <Analytics />
    </>
  );
}

export default App;