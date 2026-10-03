import { useEffect, useMemo, useState } from 'react';
import { fetchSteamProfiles } from '../api/index.js';

const EMPTY = {};

/**
 * Имена и аватары игроков одним запросом (players/steam принимает несколько Account ID сразу). Запрос уходит,
 * только когда `enabled` — например, когда посетитель раскрыл список игроков матча. Игроков без открытого профиля
 * в ответе нет: для них вызывающий показывает Account ID.
 * @param {number[]} ids
 * @param {boolean} [enabled]
 * @returns {{ names: Record<number, { name: string, avatar: string|null }>, loading: boolean, error: boolean }}
 */
export function usePlayerNames(ids, enabled = true) {
  const key = useMemo(() => [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b).join(','), [ids]);
  const [state, setState] = useState({ key: '', names: EMPTY, loading: false, error: false });

  useEffect(() => {
    if (!enabled || !key) return undefined;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: false }));
    fetchSteamProfiles(key.split(',').map(Number))
      .then((profiles) => {
        if (cancelled) return;
        setState({ key, names: Object.fromEntries(profiles.map((p) => [p.id, { name: p.name, avatar: p.avatar }])), loading: false, error: false });
      })
      .catch(() => { if (!cancelled) setState({ key, names: EMPTY, loading: false, error: true }); });
    return () => { cancelled = true; };
  }, [key, enabled]);

  // Имена от прошлого набора игроков не показываем: пока идёт новый запрос, пусто
  return state.key === key ? { names: state.names, loading: state.loading, error: state.error } : { names: EMPTY, loading: enabled && Boolean(key), error: false };
}
