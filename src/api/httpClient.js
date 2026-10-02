/**
 * @fileoverview HTTP-клиент с кешированием в localStorage.
 * Абстрагирует fetch() — при замене на axios или другой клиент меняется только этот файл.
 *
 * Бесплатный API с общим для всех посетителей лимитом — самое слабое место сайта, поэтому клиент осторожен:
 *  - у каждого запроса есть таймаут: зависший запрос не держит страницу в «загрузке» вечно;
 *  - устаревший кеш не выбрасывается, а остаётся запасным вариантом: если API отказал (таймаут, сбой сети,
 *    5xx, 429), страница покажет прежние данные вместо ошибки (stale-if-error);
 *  - после ответа 429 клиент на время перестаёт обращаться к API: лимит общий, и лишние запросы только
 *    продлили бы отказ для всех.
 */

// 3: ответы списков героев и предметов теперь «облегчаются» перед записью (раньше сырой
// ответ в 1,8–5,7 МБ не помещался в localStorage); старые записи purgeLegacyCache() удалит.
// Формат записи дополнен сроком жизни ("ttl") — старые записи без него читаются как раньше, версию поднимать не нужно.
const CACHE_VERSION = '3';
const CACHE_PREFIX = `dlhub_v${CACHE_VERSION}_`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 час

/** Сколько живёт запись как запасной вариант на случай сбоя API. Данные старше недели — уже не данные. */
export const STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
/** Сколько ждём ответ целиком (заголовки и тело). Самые тяжёлые ответы — 1–6 МБ, на Vercel их сжимают в разы. */
export const REQUEST_TIMEOUT_MS = 30 * 1000;
/** Пауза после 429, если API не сказал, сколько ждать, и пределы того, что он сказал. */
export const RATE_LIMIT_PAUSE_MS = 30 * 1000;
const RATE_LIMIT_MIN_MS = 5 * 1000;
const RATE_LIMIT_MAX_MS = 120 * 1000;

// Уже летящие запросы: одинаковые параллельные вызовы делят один fetch.
const inflight = new Map();

// До этого момента (мс) к API не обращаемся: он ответил 429 «слишком много запросов».
let pausedUntil = 0;

/**
 * Время записи берём из начала строки ({"ts":123,"ttl":456,...}) — без парсинга всего значения.
 * @param {string} raw
 * @returns {number} 0, если формат не распознан (запись считается негодной)
 */
function entryTs(raw) {
  const match = /^\{"ts":(\d+)/.exec(raw.slice(0, 60));
  return match ? Number(match[1]) : 0;
}

/**
 * Срок жизни, с которым запись была сохранена. Записи прежнего формата (без него) считаются часовыми.
 * @param {string} raw
 * @returns {number}
 */
function entryTtl(raw) {
  const match = /^\{"ts":\d+,"ttl":(\d+)/.exec(raw.slice(0, 60));
  return match ? Number(match[1]) : CACHE_TTL_MS;
}

/**
 * Запись кеша без разбора значения: сырая строка и время сохранения. Запись старше STALE_MAX_MS и нечитаемая
 * удаляются — запасным вариантом им уже не быть.
 * @param {string} key
 * @returns {{ raw: string, ts: number }|null}
 */
function peekCache(key) {
  const storageKey = `${CACHE_PREFIX}${key}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const ts = entryTs(raw);
    if (!ts || Date.now() - ts > STALE_MAX_MS) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return { raw, ts };
  } catch {
    return null;
  }
}

/**
 * Значение из сырой записи.
 * @param {string} raw
 * @returns {any} undefined, если запись повреждена
 */
function entryData(raw) {
  try {
    return JSON.parse(raw).data;
  } catch {
    return undefined;
  }
}

/**
 * Освобождает место в localStorage: устаревшие записи (каждая — по своему сроку жизни, а не по общему часу)
 * либо самую старую треть.
 * @param {boolean} onlyExpired
 */
function evict(onlyExpired) {
  try {
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        const raw = localStorage.getItem(key) || '';
        entries.push({ key, ts: entryTs(raw), ttl: entryTtl(raw) });
      }
    }
    const victims = onlyExpired
      ? entries.filter((e) => now - e.ts > e.ttl)
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
 * @param {number} ttl срок жизни записи: по нему её узнают устаревшей при вытеснении
 */
function writeCache(key, data, ttl) {
  let payload;
  try {
    payload = JSON.stringify({ ts: Date.now(), ttl, data });
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

/**
 * Пауза после 429 по заголовку Retry-After (секунды или дата), в мс. Без заголовка или с непонятным — обычная
 * пауза; слишком короткую и слишком длинную приводим к пределам.
 * @param {string|null|undefined} header
 * @param {number} [now]
 * @returns {number}
 */
export function pauseFromRetryAfter(header, now = Date.now()) {
  let ms = RATE_LIMIT_PAUSE_MS;
  const text = header == null ? '' : String(header).trim();
  // Дата в формате HTTP всегда содержит буквы (день недели, месяц); «-5» или «3.5» Date.parse принял бы за дату
  // из XX века — это не наш случай, такие значения считаем непонятными
  const parsed = /^\d+$/.test(text) ? Number(text) * 1000 : /[A-Za-z]/.test(text) ? Date.parse(text) - now : NaN;
  if (Number.isFinite(parsed)) ms = parsed;
  return Math.min(RATE_LIMIT_MAX_MS, Math.max(RATE_LIMIT_MIN_MS, ms));
}

/**
 * Можно ли в ответ на эту ошибку показать устаревшие данные. Сбой сети, таймаут, 408, 429 и 5xx — да: это
 * «API сейчас не отвечает». 400/404 и прочие 4xx — нет: они говорят «такого нет» или «запрос неверный», и
 * прежние данные скрыли бы правду (например, страницу несуществующего героя).
 * @param {{ status?: number }|null|undefined} error
 */
export function isRecoverable(error) {
  const status = error?.status;
  if (status == null) return true;
  return status === 408 || status === 429 || status >= 500;
}

async function fetchJson(url, transform, revalidate, timeoutMs) {
  if (Date.now() < pausedUntil) {
    throw Object.assign(new Error(`HTTP 429: пауза после ответа «слишком много запросов» — ${url}`), { status: 429 });
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      // no-cache — не «без кеша», а «сначала спроси у сервера»: если данные не менялись, ответ 304 без тела
      ...(revalidate ? { cache: 'no-cache' } : {}),
    });

    if (!res.ok) {
      if (res.status === 429) pausedUntil = Date.now() + pauseFromRetryAfter(res.headers.get('Retry-After'));
      // status в ошибке нужен вызывающим: например, 404 у поиска игроков — это «ничего не найдено»
      const error = new Error(`HTTP ${res.status}: ${res.statusText} — ${url}`);
      error.status = res.status;
      throw error;
    }

    const data = await res.json();
    return transform ? transform(data) : data;
  } catch (error) {
    if (timedOut) {
      throw Object.assign(new Error(`Таймаут ${timeoutMs} мс — ${url}`), { name: 'TimeoutError', code: 'timeout' });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Универсальный HTTP GET с кешированием.
 * `transform` применяется до записи в кеш — так в localStorage попадает только нужное
 * (ответы аналитики бывают по сотням килобайт).
 * @param {string} url
 * `revalidate` — перепроверять ответ у сервера, не полагаясь на HTTP-кеш браузера (у API он живёт
 * час): для данных, которые меняются в известные моменты, например при выходе героя.
 * `timeoutMs` — сколько ждать ответ целиком; по истечении запрос прерывается ошибкой TimeoutError.
 * Если запись в кеше устарела, а API отказал (см. isRecoverable), вернётся она — не старше STALE_MAX_MS.
 * @param {{ cache?: boolean, cacheKey?: string, ttl?: number, revalidate?: boolean, timeoutMs?: number, transform?: (data: any) => any }} options
 * @returns {Promise<any>}
 */
export function httpGet(url, { cache = true, cacheKey, ttl = CACHE_TTL_MS, revalidate = false, timeoutMs = REQUEST_TIMEOUT_MS, transform } = {}) {
  const key = cacheKey || url;

  // Устаревшая запись — запасной вариант на случай, если API не ответит
  let fallback = null;
  if (cache) {
    const entry = peekCache(key);
    if (entry) {
      if (Date.now() - entry.ts <= ttl) {
        const cached = entryData(entry.raw);
        // null — «записи нет» (так было всегда): пустой результат лучше перепроверить
        if (cached !== undefined && cached !== null) return Promise.resolve(cached);
      } else {
        fallback = entry;
      }
    }
  }

  if (inflight.has(key)) return inflight.get(key);

  const request = fetchJson(url, transform, revalidate, timeoutMs)
    .then((data) => {
      if (cache) writeCache(key, data, ttl);
      return data;
    })
    .catch((error) => {
      if (fallback && isRecoverable(error)) {
        const stale = entryData(fallback.raw);
        if (stale !== undefined && stale !== null) return stale;
      }
      throw error;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

/**
 * Очистить всё, что сайт хранит в браузере: кеш ответов и настройки (ключи dlhub_*), чужие ключи не трогаются.
 */
export function clearAppCache() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dlhub_')) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage недоступен — чистить нечего
  }
}
