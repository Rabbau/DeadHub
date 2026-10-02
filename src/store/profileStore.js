import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * «Мой профиль»: запомненный Account ID посетителя. Хранится только в его браузере (localStorage) —
 * ни аккаунта, ни входа через Steam на сайте нет, поэтому профиль можно открыть и чужой.
 */
export const useProfileStore = create(
  persist(
    (set) => ({
      /** { id, name, avatar } или null, пока профиль не выбран */
      me: null,

      setMe: (player) => set({ me: { id: player.id, name: player.name ?? null, avatar: player.avatar ?? null } }),

      clearMe: () => set({ me: null }),
    }),
    { name: 'dlhub_profile' },
  ),
);
