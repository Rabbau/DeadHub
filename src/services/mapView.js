/**
 * @fileoverview Математика масштабирования и перемещения карты. Без React и DOM.
 *
 * Вид — это { scale, x, y }: квадратный мир размером `size` пикселей при scale = 1
 * сдвинут на (x, y) и увеличен в scale раз. Мир всегда накрывает окно целиком.
 */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 10;

export const INITIAL_VIEW = { scale: MIN_ZOOM, x: 0, y: 0 };

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/** Приводит вид к допустимому: масштаб в пределах, края мира не уходят внутрь окна. */
export function clampView(view, size) {
  const scale = clamp(view.scale, MIN_ZOOM, MAX_ZOOM);
  const min = size - size * scale; // ≤ 0: на сколько мир шире окна
  return { scale, x: clamp(view.x, min, 0), y: clamp(view.y, min, 0) };
}

/** Меняет масштаб в `factor` раз так, чтобы точка (px, py) окна осталась на месте. */
export function zoomAt(view, factor, px, py, size) {
  const scale = clamp(view.scale * factor, MIN_ZOOM, MAX_ZOOM);
  const k = scale / view.scale;
  return clampView({ scale, x: px - (px - view.x) * k, y: py - (py - view.y) * k }, size);
}

export function panBy(view, dx, dy, size) {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, size);
}

/**
 * Вид на пути от `from` к `to` при прогрессе `progress` (0..1): масштаб меняется в геометрической прогрессии
 * (приближение «равномерно» на глаз), сдвиг — линейно.
 */
export function lerpView(from, to, progress) {
  const p = Math.min(1, Math.max(0, progress));
  return { scale: from.scale * (to.scale / from.scale) ** p, x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p };
}

/** Центрирует вид на точке мира (0..1) при заданном масштабе. */
export function centerOn(rx, ry, scale, size) {
  return clampView({ scale, x: size / 2 - rx * size * scale, y: size / 2 - ry * size * scale }, size);
}
