import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_VIEW, MIN_ZOOM, centerOn, clampView, lerpView, panBy, zoomAt } from '../services/mapView.js';

const WHEEL_SENSITIVITY = 0.0018; // множитель масштаба на пиксель прокрутки колеса
const DRAG_THRESHOLD_PX = 5;      // сдвиг меньше этого — клик, а не перетаскивание
const BUTTON_ZOOM = 1.6;
const DOUBLE_CLICK_ZOOM = 2;
const KEY_PAN_FRACTION = 0.15;
const ANIMATION_MS = 200;       // сколько длится плавный переход (кнопки, клавиши, двойной щелчок, сброс)

const easeOut = (p) => 1 - (1 - p) ** 3;
const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Масштаб и перемещение карты: колесо, перетаскивание, щипок двумя пальцами, двойной клик и клавиши.
 *
 * Вид (масштаб и сдвиг) хранится в ref и применяется прямо к DOM: карта с сотнями маркеров не должна
 * перерисовываться React-ом на каждое движение пальца. В состоянии лежит одно значение — «приближено
 * ли»: от него зависят touch-action и кнопка сброса. Размер маркеров не растёт вместе с картой —
 * им задаётся обратный масштаб через переменную --inv.
 *
 * Колесо, перетаскивание и щипок отзываются сразу; кнопки, клавиши, двойной щелчок и сброс плавно переходят к
 * нужному виду за 200 мс (без анимации, если в системе включено «уменьшить движение»). Любой жест прерывает переход.
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
  const animation = useRef(null); // идущий переход: { frame, target }

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

  const cancelAnimation = useCallback(() => {
    if (animation.current) cancelAnimationFrame(animation.current.frame);
    animation.current = null;
  }, []);

  /** Плавный переход от текущего вида к `target`; быстрый повторный переход начинается с того, где остановился прежний. */
  const animate = useCallback((target) => {
    cancelAnimation();
    if (prefersReducedMotion()) {
      apply(target);
      return;
    }
    const from = view.current;
    const startedAt = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / ANIMATION_MS);
      apply(lerpView(from, target, easeOut(progress)));
      animation.current = progress < 1 ? { frame: requestAnimationFrame(step), target } : null;
    };
    animation.current = { frame: requestAnimationFrame(step), target };
  }, [apply, cancelAnimation]);

  /**
   * Приближение в `factor` раз вокруг точки окна (px, py) — плавно. Если прежний переход ещё идёт, отсчёт ведётся
   * от его цели: клавиша, которую держат нажатой, приближает карту на столько нажатий, сколько их было.
   */
  const zoomAnimated = useCallback((factor, px, py) => {
    const base = animation.current?.target ?? view.current;
    animate(zoomAt(base, factor, px, py, sizeOf()));
  }, [animate]);

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
      cancelAnimation();
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
      cancelAnimation();
      gesture();
      const [x, y] = local(event.clientX, event.clientY);
      apply(zoomAt(view.current, Math.exp(-delta * WHEEL_SENSITIVITY), x, y, sizeOf()));
    }

    function onDoubleClick(event) {
      if (event.target.closest?.('[data-no-pan]')) return;
      gesture();
      const [x, y] = local(event.clientX, event.clientY);
      zoomAnimated(DOUBLE_CLICK_ZOOM, x, y);
    }

    function onKeyDown(event) {
      if (event.target !== el || event.ctrlKey || event.metaKey || event.altKey) return;
      const size = sizeOf();
      const step = size * KEY_PAN_FRACTION;
      const isZoomed = view.current.scale > MIN_ZOOM + 0.001;
      switch (event.key) {
        case '+': case '=':
          zoomAnimated(BUTTON_ZOOM, size / 2, size / 2);
          break;
        case '-': case '_':
          zoomAnimated(1 / BUTTON_ZOOM, size / 2, size / 2);
          break;
        case '0':
          animate(INITIAL_VIEW);
          break;
        // Стрелки сдвигают карту, только пока она приближена: иначе они нужны странице для прокрутки
        case 'ArrowLeft': if (!isZoomed) return; cancelAnimation(); apply(panBy(view.current, step, 0, size)); break;
        case 'ArrowRight': if (!isZoomed) return; cancelAnimation(); apply(panBy(view.current, -step, 0, size)); break;
        case 'ArrowUp': if (!isZoomed) return; cancelAnimation(); apply(panBy(view.current, 0, step, size)); break;
        case 'ArrowDown': if (!isZoomed) return; cancelAnimation(); apply(panBy(view.current, 0, -step, size)); break;
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
      cancelAnimation();
      observer.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDoubleClick);
      el.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply, animate, cancelAnimation, zoomAnimated]);

  const zoomBy = useCallback((factor) => {
    const size = sizeOf();
    gestureRef.current?.();
    zoomAnimated(factor, size / 2, size / 2);
  }, [zoomAnimated]);

  const reset = useCallback(() => {
    gestureRef.current?.();
    animate(INITIAL_VIEW);
  }, [animate]);

  /** Подводит камеру к точке карты (0..1). */
  const focusOn = useCallback((x, y, scale) => {
    gestureRef.current?.();
    animate(centerOn(x, y, scale, sizeOf()));
  }, [animate]);

  const wasDragged = useCallback(() => dragged.current, []);

  return { viewportRef, worldRef, pinsRef, viewRef: view, zoomed, zoomBy, reset, focusOn, wasDragged };
}

export { BUTTON_ZOOM };
