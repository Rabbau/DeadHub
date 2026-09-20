/**
 * @fileoverview HTTP-клиент с кешированием в localStorage.
 * Абстрагирует fetch() — при замене на axios или другой клиент меняется только этот файл.
 */

const CACHE_VERSION = '2';
const CACHE_PREFIX = `dlhub_v${CACHE_VERSION}_`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 час

// Уже летящие запросы: одинаковые параллельные вызовы делят один fetch.
const inflight = new Map();

/**
 * Время записи берём из начала строки ({"ts":123,...}) — без парсинга всего значения.
 * @param {string} raw
 * @returns {number} 0, если формат не распознан (запись считается протухшей)
 */
function entryTs(raw) {
  const match = /^\{"ts":(\d+)/.exec(raw.slice(0, 40));
  return match ? Number(match[1]) : 0;
}

/**
 * Читает кеш из localStorage.
 * @param {string} key
 * @param {number} ttl
 * @returns {any|null}
 */
function readCache(key, ttl) {
  const storageKey = `${CACHE_PREFIX}${key}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    if (Date.now() - entryTs(raw) > ttl) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return JSON.parse(raw).data;
  } catch {
    return null;
  }
}

/**
 * Освобождает место в localStorage: протухшие записи либо самую старую треть.
 * @param {boolean} onlyExpired
 */
function evict(onlyExpired) {
  try {
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        entries.push({ key, ts: entryTs(localStorage.getItem(key) || '') });
      }
    }
    const victims = onlyExpired
      ? entries.filter((e) => now - e.ts > CACHE_TTL_MS)
      : entries.sort((a, b) => a.ts - b.ts).slice(0, Math.max(1, Math.ceil(entries.length / 3)));
    victims.forEach((e) => localStorage.removeItem(e.key));
  } catch {
    // localStorage недоступен — нечего чистить
  }
}

/**
 * Записывает данные в кеш. Если место закончилось — вытесняет старое и пробует ещё раз.
 * @param {string} key
 * @param {any} data
 */
function writeCache(key, data) {
  let payload;
  try {
    payload = JSON.stringify({ ts: Date.now(), data });
  } catch {
    return;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      localStorage.setItem(`${CACHE_PREFIX}${key}`, payload);
      return;
    } catch {
      if (attempt === 2) return; // кеш — оптимизация, не критично
      evict(attempt === 0);
    }
  }
}

/** Кеш прошлых версий формата больше не читается — не даём ему занимать место. */
function purgeLegacyCache() {
  try {
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /^dlhub_v\d+_/.test(key) && !key.startsWith(CACHE_PREFIX)) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage недоступен
  }
}

purgeLegacyCache();

async function fetchJson(url, transform) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    // status в ошибке нужен вызывающим: например, 404 у поиска игроков — это «ничего не найдено»
    const error = new Error(`HTTP ${res.status}: ${res.statusText} — ${url}`);
    error.status = res.status;
    throw error;
  }

  const data = await res.json();
  return transform ? transform(data) : data;
}

/**
 * Универсальный HTTP GET с кешированием.
 * `transform` применяется до записи в кеш — так в localStorage попадает только нужное
 * (ответы аналитики бывают по сотням килобайт).
 * @param {string} url
 * @param {{ cache?: boolean, cacheKey?: string, ttl?: number, transform?: (data: any) => any }} options
 * @returns {Promise<any>}
 */
export function httpGet(url, { cache = true, cacheKey, ttl = CACHE_TTL_MS, transform } = {}) {
  const key = cacheKey || url;

  if (cache) {
    const cached = readCache(key, ttl);
    if (cached !== null) return Promise.resolve(cached);
  }

  if (inflight.has(key)) return inflight.get(key);

  const request = fetchJson(url, transform)
    .then((data) => {
      if (cache) writeCache(key, data);
      return data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

/**
 * Очистить весь кеш приложения.
 */
export function clearAppCache() {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('dlhub_'));
  keys.forEach((k) => localStorage.removeItem(k));
}
