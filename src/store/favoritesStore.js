import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addPlayer, normalizeFavorites, refreshPlayer, removePlayer, toggleHero } from '../services/favoritesService.js';

/**
 * Избранные игроки и герои. Хранятся только в этом браузере (localStorage): ни аккаунта, ни входа на сайте нет.
 * Всё, что читается из localStorage, проходит через normalizeFavorites.
 */
export const useFavoritesStore = create(
  persist(
    (set, get) => ({
      /** [{ id, name, avatar }], новые первыми */
      players: [],
      /** id героев в порядке добавления */
      heroes: [],

      /** Добавляет игрока в избранное или убирает его. Возвращает 'added' | 'removed' | 'full' | 'invalid'. */
      togglePlayer: (player) => {
        const { players } = get();
        if (players.some((p) => p.id === player?.id)) {
          set({ players: removePlayer(players, player.id) });
          return 'removed';
        }
        const { players: next, result } = addPlayer(players, player);
        if (result === 'added') set({ players: next });
        return result;
      },

      /** Свежее имя и аватар для игрока, который уже в избранном. */
      refreshPlayer: (player) => {
        const next = refreshPlayer(get().players, player);
        if (next !== get().players) set({ players: next });
      },

      removePlayer: (id) => set({ players: removePlayer(get().players, id) }),

      /** Добавляет героя в избранное или убирает его. Возвращает 'added' | 'removed' | 'full' | 'invalid'. */
      toggleHero: (id) => {
        const { heroes, result } = toggleHero(get().heroes, id);
        if (result === 'added' || result === 'removed') set({ heroes });
        return result;
      },

      clear: () => set({ players: [], heroes: [] }),
    }),
    {
      name: 'dlhub_favorites',
      version: 1,
      partialize: (state) => ({ players: state.players, heroes: state.heroes }),
      merge: (persisted, current) => ({ ...current, ...normalizeFavorites(persisted) }),
    },
  ),
);
