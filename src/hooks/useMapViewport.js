import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_VIEW, MIN_ZOOM, centerOn, clampView, panBy, zoomAt } from '../services/mapView.js';

const WHEEL_SENSITIVITY = 0.0018; // множитель масштаба на пиксель прокрутки колеса
const DRAG_THRESHOLD_PX = 5;      // сдвиг меньше этого — клик, а не перетаскивание
const BUTTON_ZOOM = 1.6;
const DOUBLE_CLICK_ZOOM = 2;
const KEY_PAN_FRACTION = 0.15;

/**
 * Масштаб и перемещение карты: колесо, перетаскивание, щипок двумя пальцами, двойной клик и клавиши.
 *
 * Вид (масштаб и сдвиг) хранится в ref и применяется прямо к DOM: карта с сотнями маркеров не должна
 * перерисовываться React-ом на каждое движение пальца. В состоянии лежит одно значение — «приближено
 * ли»: от него зависят touch-action и кнопка сброса. Размер маркеров не растёт вместе с картой —
 * им задаётся обратный масштаб через переменную --inv.
 *
 * Движущихся слоёв два (картинка с линиями и слой крупных маркеров): между ними лежит canvas с мелкими
 * точками, который сам пересчитывает координаты — он подписывается на вид через onView.
 *
 * @param {{ onGesture?: () => void, onView?: (view: { scale: number, x: number, y: number }) => void }} [options]
 *   onGesture вызывается в начале жеста (скрыть подсказку), onView — после каждого изменения вида
 */
export function useMapViewport({ onGesture, onView } = {}) {
  const viewportRef = useRef(null); // окно с событиями
  const worldRef = useRef(null);    // движущийся слой: картинка, тепловая карта, линии
  const pinsRef = useRef(null);     // движущийся слой: крупные маркеры
  const view = useRef(INITIAL_VIEW);
  const lastSize = useRef(0);
  const dragged = useRef(false);
  const gestureRef = useRef(onGesture);
  gestureRef.current = onGesture;
  const viewListenerRef = useRef(onView);
  viewListenerRef.current = onView;
  const [zoomed, setZoomed] = useState(false);

  const sizeOf = () => viewportRef.current?.clientWidth ?? 0;

  const apply = useCallback((next) => {
    const clamped = clampView(next, sizeOf());
    view.current = clamped;
    const transform = `translate(${clamped.x}px, ${clamped.y}px) scale(${clamped.scale})`;
    [worldRef.current, pinsRef.current].forEach((world) => {
      if (!world) return;
      world.style.transform = transform;
      world.style.setProperty('--inv', String(1 / clamped.scale));
    });
    setZoomed(clamped.scale > MIN_ZOOM + 0.001);
    viewListenerRef.current?.(clamped);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const pointers = new Map(); // id → { x, y } в координатах страницы
    let pinch = null;
    let dragStart = null;

    const gesture = () => gestureRef.current?.();
    const local = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      return [clientX - rect.left, clientY - rect.top];
    };
    const pinchState = () => {
      const [a, b] = [...pointers.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    function onPointerMove(event) {
      const prev = pointers.get(event.pointerId);
      if (!prev) return;
      const next = { x: event.clientX, y: event.clientY };

      if (pointers.size === 1) {
        if (!dragged.current) {
          if (Math.hypot(next.x - dragStart.x, next.y - dragStart.y) < DRAG_THRESHOLD_PX) return;
          dragged.current = true;
          el.classList.add('is-dragging');
          gesture();
        }
        pointers.set(event.pointerId, next);
        apply(panBy(view.current, next.x - prev.x, next.y - prev.y, sizeOf()));
      } else if (pointers.size === 2 && pinch) {
        pointers.set(event.pointerId, next);
        const now = pinchState();
        const [px, py] = local(pinch.x, pinch.y);
        const zoomedView = zoomAt(view.current, now.dist / pinch.dist, px, py, sizeOf());
        apply(panBy(zoomedView, now.x - pinch.x, now.y - pinch.y, sizeOf()));
        pinch = now;
      }
    }

    function onPointerUp(event) {
      pointers.delete(event.pointerId);
      pinch = null;
      if (pointers.size === 1) dragStart = [...pointers.values()][0]; // остался один палец — продолжаем с него
      if (pointers.size === 0) {
        el.classList.remove('is-dragging');
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        // dragged не сбрасываем: клик сразу после жеста должен его увидеть и не выбирать маркер
      }
    }

    function onPointerDown(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest?.('[data-no-pan]')) return; // кнопки и карточка поверх карты
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        dragged.current = false;
        dragStart = { x: event.clientX, y: event.clientY };
      } else if (pointers.size === 2) {
        dragged.current = true;
        pinch = pinchState();
        gesture();
      }
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    }

    function onWheel(event) {
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const delta = event.deltaY * lines;
      // Карта не приближена, а колесо крутят «вниз» — это прокрутка страницы, не мешаем ей
      if (view.current.scale <= MIN_ZOOM && delta > 0) return;
      event.preventDefault();
      gesture();
      const [x, y] = local(event.clientX, event.clientY);
      apply(zoomAt(view.current, Math.exp(-delta * WHEEL_SENSITIVITY), x, y, sizeOf()));
    }

    function onDoubleClick(event) {
      if (event.target.closest?.('[data-no-pan]')) return;
      gesture();
      const [x, y] = local(event.clientX, event.clientY);
      apply(zoomAt(view.current, DOUBLE_CLICK_ZOOM, x, y, sizeOf()));
    }

    function onKeyDown(event) {
      if (event.target !== el || event.ctrlKey || event.metaKey || event.altKey) return;
      const size = sizeOf();
      const step = size * KEY_PAN_FRACTION;
      const isZoomed = view.current.scale > MIN_ZOOM + 0.001;
      switch (event.key) {
        case '+': case '=':
          apply(zoomAt(view.current, BUTTON_ZOOM, size / 2, size / 2, size));
          break;
        case '-': case '_':
          apply(zoomAt(view.current, 1 / BUTTON_ZOOM, size / 2, size / 2, size));
          break;
        case '0':
          apply(INITIAL_VIEW);
          break;
        // Стрелки сдвигают карту, только пока она приближена: иначе они нужны странице для прокрутки
        case 'ArrowLeft': if (!isZoomed) return; apply(panBy(view.current, step, 0, size)); break;
        case 'ArrowRight': if (!isZoomed) return; apply(panBy(view.current, -step, 0, size)); break;
        case 'ArrowUp': if (!isZoomed) return; apply(panBy(view.current, 0, step, size)); break;
        case 'ArrowDown': if (!isZoomed) return; apply(panBy(view.current, 0, -step, size)); break;
        default: return;
      }
      gesture();
      event.preventDefault();
    }

    // При смене размера окна сдвиг пересчитываем пропорционально — карта остаётся на том же месте
    const observer = new ResizeObserver(() => {
      const size = sizeOf();
      if (!size) return;
      if (lastSize.current && lastSize.current !== size) {
        const k = size / lastSize.current;
        apply({ scale: view.current.scale, x: view.current.x * k, y: view.current.y * k });
      }
      lastSize.current = size;
    });
    observer.observe(el);

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('wheel', onWheel, { passive: false }); // preventDefault в пассивном слушателе не работает
    el.addEventListener('dblclick', onDoubleClick);
    el.addEventListener('keydown', onKeyDown);

    return () => {
      observer.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDoubleClick);
      el.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply]);

  const zoomBy = useCallback((factor) => {
    const size = sizeOf();
    gestureRef.current?.();
    apply(zoomAt(view.current, factor, size / 2, size / 2, size));
  }, [apply]);

  const reset = useCallback(() => {
    gestureRef.current?.();
    apply(INITIAL_VIEW);
  }, [apply]);

  /** Подводит камеру к точке карты (0..1). */
  const focusOn = useCallback((x, y, scale) => {
    gestureRef.current?.();
    apply(centerOn(x, y, scale, sizeOf()));
  }, [apply]);

  const wasDragged = useCallback(() => dragged.current, []);

  return { viewportRef, worldRef, pinsRef, viewRef: view, zoomed, zoomBy, reset, focusOn, wasDragged };
}

export { BUTTON_ZOOM };
