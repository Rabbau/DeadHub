import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllItems, fetchMatch, fetchSteamProfiles } from '../api/index.js';
import { useHeroStore } from '../store/heroStore.js';
import { matchErrorKey } from '../services/matchService.js';

/**
 * Матч по id. Запрос один (около мегабайта, дальше — из кеша на неделю).
 * @param {number|null} matchId null — адрес с неверным id: запроса нет, ошибка «notFound»
 * @returns {{ match: object|null, loading: boolean, error: string|null, retry: () => void }}
 */
export function useMatch(matchId) {
  const [state, setState] = useState({ match: null, loading: true, error: null });
  // «Повторить» после сбоя или лимита запросов: смена номера попытки перезапускает загрузку
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!matchId) {
      setState({ match: null, loading: false, error: 'notFound' });
      return undefined;
    }
    let cancelled = false;
    setState({ match: null, loading: true, error: null });
    fetchMatch(matchId)
      .then((match) => { if (!cancelled) setState({ match, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ match: null, loading: false, error: matchErrorKey(e) }); });
    return () => { cancelled = true; };
  }, [matchId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/**
 * Имена и аватары игроков матча: один запрос на всех (кешируется). Без профиля (закрытый, бот) игрока
 * показывают по Account ID — сбой запроса таблицу не ломает.
 * @returns {Map<number, { id: number, name: string, avatar: string|null }>}
 */
export function usePlayerNames(match) {
  const [profiles, setProfiles] = useState([]);
  const accounts = useMemo(() => (match ? match.players.map((player) => player.account).filter(Boolean) : []), [match]);

  useEffect(() => {
    if (accounts.length === 0) return undefined;
    let cancelled = false;
    fetchSteamProfiles(accounts)
      .then((list) => { if (!cancelled) setProfiles(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accounts]);

  return useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
}

/**
 * Каталог предметов (по id) для названий и картинок в сборках. Грузится, когда матч уже на экране, —
 * без него таблица игроков показывается сразу, предметы появляются следом.
 * @returns {Map<number, object>|null} null, пока каталог не загрузился
 */
export function useItemCatalog(enabled) {
  const language = useHeroStore((state) => state.language);
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetchAllItems(language)
      .then((items) => { if (!cancelled) setCatalog(new Map(items.map((item) => [item.id, item]))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, language]);

  return catalog;
}
