import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";   // ← правильный импорт
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import HeroPage from './pages/HeroPage';
import ItemsPage from './pages/ItemsPage';
import ItemPage from './pages/ItemPage';
import MetaPage from './pages/MetaPage';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/layout/ErrorBoundary';

// Главные страницы (список героев, герой, предметы, мета) лежат в основном файле — с них начинают почти все.
// Остальное скачивается при первом заходе: карта, лидерборд, тир-лист и прочее не тянут за собой первую загрузку.
const BuildPage = lazy(() => import('./pages/BuildPage'));
const TierListPage = lazy(() => import('./pages/TierListPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const MatchupsPage = lazy(() => import('./pages/MatchupsPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const PlayersPage = lazy(() => import('./pages/PlayersPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));
const UpdatePage = lazy(() => import('./pages/UpdatePage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const RanksPage = lazy(() => import('./pages/RanksPage'));
const MePage = lazy(() => import('./pages/MePage'));
const DraftPage = lazy(() => import('./pages/DraftPage'));
const MatchPage = lazy(() => import('./pages/MatchPage'));

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
            <Route path="match/:id" element={<MatchPage />} />
            <Route path="update" element={<UpdatePage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="ranks" element={<RanksPage />} />
            <Route path="me" element={<MePage />} />
            <Route path="draft" element={<DraftPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ErrorBoundary>
      <Analytics />
    </>
  );
}

export default App;