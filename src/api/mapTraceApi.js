import { buildGround, buildTunnels } from '../services/mapTrace.js';

/** Уже начатая или законченная трассировка по картинке и виду: страница карты открывается не раз, а картинка одна. */
const jobs = new Map();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Без crossOrigin canvas «портится» и пиксели не прочитать; хранилище картинок отдаёт CORS на запрос с Origin
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('map image failed'));
    image.src = url;
  });
}

function pixelsOf(image) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  return { width, height, data: context.getImageData(0, 0, width, height).data };
}

/**
 * Картинка миникарты → векторные контуры (см. services/mapTrace.js). Не получилось (картинка недоступна, нет
 * CORS) — промис отклоняется, и карта остаётся на растровой картинке.
 * @param {string} url
 * @param {'ground'|'tunnels'} kind улицы города или слой туннелей
 * @returns {Promise<{ size: number, ground?: string, holes?: string, d?: string }>}
 */
export function traceMapImage(url, kind) {
  const key = `${kind}:${url}`;
  if (!jobs.has(key)) {
    const job = loadImage(url).then((image) => {
      const { width, height, data } = pixelsOf(image);
      return kind === 'ground' ? buildGround(data, width, height) : buildTunnels(data, width, height);
    });
    // Неудачу не запоминаем: при следующем открытии страницы попытка повторится
    job.catch(() => jobs.delete(key));
    jobs.set(key, job);
  }
  return jobs.get(key);
}
