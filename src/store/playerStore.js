// src/store/playerStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT = 8;

export const usePlayerStore = create(
  persist(
    (set, get) => ({
      // Недавно открытые профили: { id, name, avatar }
      recent: [],

      remember: (player) => {
        const rest = get().recent.filter((p) => p.id !== player.id);
        set({ recent: [{ id: player.id, name: player.name, avatar: player.avatar ?? null }, ...rest].slice(0, MAX_RECENT) });
      },

      forget: (id) => set({ recent: get().recent.filter((p) => p.id !== id) }),

      clear: () => set({ recent: [] }),
    }),
    { name: 'player-storage' }
  )
);
