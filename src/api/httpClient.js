/**
 * @fileoverview HTTP-клиент с кешированием в localStorage.
 * Абстрагирует fetch() — при замене на axios или другой клиент меняется только этот файл.
 */

const CACHE_VERSION = '1';
const CACHE_PREFIX = `dlhub_v${CACHE_VERSION}_`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 час

/**
 * Читает кеш из localStorage.
 * @param {string} key
 * @returns {any|null}
 */
function readCache(key) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Записывает данные в кеш.
 * @param {string} key
 * @param {any} data
 */
function writeCache(key, data) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage может быть заполнен — не критично
  }
}

/**
 * Универсальный HTTP GET с кешированием.
 * @param {string} url
 * @param {{ cache?: boolean, cacheKey?: string }} options
 * @returns {Promise<any>}
 */
export async function httpGet(url, { cache = true, cacheKey } = {}) {
  const key = cacheKey || url;

  if (cache) {
    const cached = readCache(key);
    if (cached !== null) return cached;
  }

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText} — ${url}`);
  }

  const data = await res.json();

  if (cache) writeCache(key, data);

  return data;
}

/**
 * Очистить весь кеш приложения.
 */
export function clearAppCache() {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('dlhub_'));
  keys.forEach((k) => localStorage.removeItem(k));
}