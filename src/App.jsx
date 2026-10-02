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
import MatchupsPage from './pages/MatchupsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import PlayersPage from './pages/PlayersPage';
import PlayerPage from './pages/PlayerPage';
import UpdatePage from './pages/UpdatePage';
import MapPage from './pages/MapPage';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/layout/ErrorBoundary';

function App() {
  return (
    <>
      {/* Запасная сетка: если упадёт сам Layout (меню), всё равно покажем экран ошибки, а не пустую страницу */}
      <ErrorBoundary>
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
            <Route path="matchups" element={<MatchupsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="player/:id" element={<PlayerPage />} />
            <Route path="update" element={<UpdatePage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ErrorBoundary>
      <Analytics />
    </>
  );
}

export default App;