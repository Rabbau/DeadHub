/**
 * Картинки значков для canvas: грузятся при первом обращении и запоминаются. Пока значок не загрузился,
 * iconImage возвращает null (рисуется кольцо без значка), а по готовности зовёт подписчиков — карта перерисуется.
 */
const cache = new Map();
const listeners = new Set();

export function iconImage(src) {
  let entry = cache.get(src);
  if (!entry) {
    const image = new Image();
    entry = { image, ready: false };
    image.onload = () => {
      entry.ready = true;
      listeners.forEach((listener) => listener());
    };
    image.src = src;
    cache.set(src, entry);
  }
  return entry.ready ? entry.image : null;
}

export function onIconLoaded(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
