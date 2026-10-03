import { httpGet } from './httpClient.js';
import { API_BASE } from './config.js';
import { toQueryString } from '../services/statsFilters.js';
import { DEFAULT_SCREEN_HEIGHT, normalizeSettings, settingsParams } from '../services/crosshairService.js';

// Прицел рисует и кодирует сам API: сайт только собирает запросы. Ответы зависят лишь от запроса, поэтому
// vercel.json держит их на CDN сутки; в localStorage они не нужны (картинки вообще грузит браузер через <img>).

/** Масштаб предпросмотра: каждый пиксель прицела рисуется квадратом такого размера (картинка остаётся чёткой). */
export const PREVIEW_SCALE = 8;

/**
 * Адрес картинки прицела по настройкам: PNG с прозрачным фоном, квадрат с прицелом в центре — «пиксель в пиксель»,
 * как его рисует игра на экране заданной высоты.
 * @param {Partial<import('../services/crosshairService.js').CROSSHAIR_DEFAULTS>} settings
 */
export function crosshairImageUrl(settings, { screenHeight = DEFAULT_SCREEN_HEIGHT, scale = PREVIEW_SCALE } = {}) {
  const qs = toQueryString({ ...settingsParams(settings), screen_height: screenHeight, scale });
  return `${API_BASE}/v1/crosshair/settings/image?${qs}`;
}

/**
 * Код прицела по настройкам: строку «DL.…», которую можно вставить в игру.
 * @returns {Promise<string>}
 */
export function fetchCrosshairCode(settings) {
  const qs = toQueryString(settingsParams(settings));
  // Без параметров запрос остаётся с «?» на конце — API отвечает на него кодом настроек по умолчанию
  return httpGet(`${API_BASE}/v1/crosshair/settings/code?${qs}`, {
    cache: false,
    transform: (data) => {
      if (typeof data?.code !== 'string' || !data.code) throw new Error('crosshair code missing');
      return data.code;
    },
  });
}

/**
 * Настройки по коду «DL.…» (или по командам консоли); значения проходят проверку normalizeSettings.
 * @param {string} code
 * @returns {Promise<ReturnType<typeof normalizeSettings>>}
 */
export function decodeCrosshairCode(code) {
  return httpGet(`${API_BASE}/v1/crosshair/code/settings?${toQueryString({ code })}`, {
    cache: false,
    transform: normalizeSettings,
  });
}
