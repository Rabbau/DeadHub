import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUTTON_ZOOM, useMapViewport } from '../../hooks/useMapViewport';
import { useMapTrace } from '../../hooks/useMapTrace';
import { useTranslation } from '../../hooks/useTranslation';
import { LAYERS, heatColor, heatLevel, heatMax, laneColors, levelMatches } from '../../services/mapService';
import { iconOf } from '../../services/mapIcons';
import { MapGround, MapTunnels } from './MapBase';
import { iconImage, onIconLoaded } from './iconCache';
import { describePin, pinClass, pinStyle } from './pinInfo';

const LAYER_BY_ID = Object.fromEntries(LAYERS.map((layer) => [layer.id, layer]));

const DOT_RADIUS = 3.4;       // радиус мелкой точки, CSS-пиксели
const BADGE_RADIUS = 10;      // радиус значка, в который точка превращается при приближении
const ICON_ZOOM = 2.2;        // с какого масштаба мелкие точки рисуются значками
const HIT_RADIUS = 9;         // насколько близко к точке нужно навести мышь
const HIT_RADIUS_TOUCH = 14;  // и палец
const FADED_ALPHA = 0.28;     // прозрачность объектов, которые ещё не появились (таймер матча)
const OUTLINE = '#060709';
const BADGE_FILL = 'rgba(11, 10, 9, 0.92)';
const RING = '#f3f4ed';
const TAU = Math.PI * 2;

/** Цвет слоя в виде, понятном canvas: var(--red) → #ff4b78. */
function cssColor(styles, value) {
  const match = /^var\((--[\w-]+)\)$/.exec(value);
  return match ? styles.getPropertyValue(match[1]).trim() || '#fff' : value;
}

/** Крупные маркеры одного слоя. Перерисовываются, только если изменился слой, выбранный в нём маркер, уровень или время матча. */
const Pins = memo(function Pins({ layer, items, selectedIndex, level, pending }) {
  return items.map((item, index) => (
    levelMatches(level, item) ? (
      <span
        key={index}
        data-pin={`${layer.id}:${index}`}
        className={`${pinClass(layer, item, index === selectedIndex)}${pending ? ' is-pending' : ''}`}
        style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, ...pinStyle(layer, item) }}
      />
    ) : null
  ));
});

/** Тепловая карта: растр 168×168 клеток, растянутый на всю карту (браузер сглаживает переходы). */
const HeatCanvas = memo(function HeatCanvas({ heat, metric }) {
  const ref = useRef(null);
  const size = heat?.size ?? 1;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !heat) return;
    const context = canvas.getContext('2d');
    const image = context.createImageData(size, size);
    const max = heatMax(heat, metric);
    const offset = metric === 'kills' ? 3 : 2;
    for (let i = 0; i < heat.cells.length; i += 4) {
      const [r, g, b, a] = heatColor(heatLevel(heat.cells[i + offset], max));
      const at = (heat.cells[i + 1] * size + heat.cells[i]) * 4;
      image.data[at] = r;
      image.data[at + 1] = g;
      image.data[at + 2] = b;
      image.data[at + 3] = a;
    }
    context.putImageData(image, 0, 0);
  }, [heat, metric, size]);

  return <canvas ref={ref} className="map-heat" width={size} height={size} aria-hidden="true" />;
});

/** Выбранный маркер → слой и сам объект (или null, если слой выключен, маркера нет или он на другом уровне). */
function resolvePin(map, visible, key, level) {
  if (!key) return null;
  const [layerId, index] = key.split(':');
  const layer = LAYER_BY_ID[layerId];
  const item = map.layers[layerId]?.[Number(index)];
  return layer && item && visible.has(layerId) && levelMatches(level, item) ? { layer, item, index: Number(index) } : null;
}

/**
 * Карта города: векторный контур миникарты, слои и маркеры с масштабированием и перетаскиванием.
 *
 * Слои устроены по-разному ради скорости. Крупных маркеров немного (до сотни) — это элементы DOM
 * со своей формой и цветом. Мелких точек бывает до тысячи (ящики, статуи) — их рисует один canvas,
 * иначе каждый шаг масштабирования пересчитывал бы стили у сотен элементов; при приближении точки на
 * canvas превращаются в такие же значки, как у крупных маркеров. Слои без данных (старая версия
 * клиента) просто пусты.
 *
 * @param {{
 *   map: any, visible: Set<string>, level: 'all'|'street'|'under', pending: Set<string>, timers: any,
 *   heat: any, heatMetric: 'deaths'|'kills', selected: string|null, onSelect: (key: string|null) => void, children?: any,
 * }} props
 *   pending — слои, которые к выбранному времени матча ещё не появились (рисуются приглушёнными);
 *   children — то, что стоит под картой (шкала времени)
 */
function MapCanvas({ map, visible, level, pending, timers, heat, heatMetric, selected, onSelect, children }) {
  const t = useTranslation();
  const [hover, setHover] = useState(null); // { key, x, y, r } — центр маркера в координатах окна
  const [imageState, setImageState] = useState('loading'); // запасная растровая картинка: loading | ready | failed
  const canvasRef = useRef(null);
  const drawRef = useRef(() => {});
  const dotsRef = useRef([]);        // [{ layer, items }] — мелкие точки включённых слоёв
  const paletteRef = useRef({});     // id слоя → цвет
  const chosenDotRef = useRef(null); // выбранная мелкая точка
  const metricsRef = useRef({ size: 0, scale: 1 });
  const stateRef = useRef({ level, pending }); // то, что нужно рисующей функции и поиску точки под указателем
  stateRef.current = { level, pending };

  const clearHover = useCallback(() => setHover(null), []);
  const redraw = useCallback(() => drawRef.current(), []);
  const { viewportRef, worldRef, pinsRef, viewRef, zoomed, zoomBy, reset, wasDragged } = useMapViewport({
    onGesture: clearHover,
    onView: redraw,
  });
  const colors = useMemo(() => laneColors(map), [map]);

  // Векторный контур города и туннелей; не вышло (нет CORS, картинка недоступна) — остаётся растр
  const ground = useMapTrace(map.images.base, 'ground');
  const wantMid = visible.has('tunnels_mid') || level === 'under';
  const wantRat = visible.has('tunnels_rat') || level === 'under';
  const tunnelsMid = useMapTrace(map.images.tunnelsMid, 'tunnels', wantMid);
  const tunnelsRat = useMapTrace(map.images.tunnelsRat, 'tunnels', wantRat);
  const rawBase = ground.status === 'failed';
  const baseLoading = ground.status === 'loading' || (rawBase && imageState === 'loading');

  const chosen = resolvePin(map, visible, selected, level);
  const hovered = hover ? resolvePin(map, visible, hover.key, level) : null;
  const card = chosen ? describePin(chosen.layer.id, chosen.item, t, colors, timers) : null;
  const tip = hovered ? describePin(hovered.layer.id, hovered.item, t, colors, timers) : null;

  const dotLayers = useMemo(
    () => LAYERS.filter((layer) => layer.kind === 'dot' && visible.has(layer.id)).map((layer) => ({ layer, items: map.layers[layer.id] })),
    [map, visible],
  );
  dotsRef.current = dotLayers;
  chosenDotRef.current = chosen && chosen.layer.kind === 'dot' ? chosen : null;

  /** Радиус мелкой точки при текущем масштабе: точка или значок. */
  const dotRadius = () => (viewRef.current.scale >= ICON_ZOOM ? BADGE_RADIUS : DOT_RADIUS) * metricsRef.current.scale;

  // ── Мелкие точки на canvas ──────────────────────────────────────
  drawRef.current = () => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    const size = viewport?.clientWidth ?? 0;
    if (!canvas || !size) return;

    // Масштаб маркеров на узких экранах задаёт CSS (--ps); читаем его только при смене размера
    const metrics = metricsRef.current;
    if (metrics.size !== size) {
      metrics.size = size;
      metrics.scale = parseFloat(getComputedStyle(viewport).getPropertyValue('--ps')) || 1;
    }
    const dpr = window.devicePixelRatio || 1;
    const pixels = Math.round(size * dpr);
    if (canvas.width !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }

    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);
    const { scale, x, y } = viewRef.current;
    const world = size * scale;
    const badges = scale >= ICON_ZOOM;
    const radius = dotRadius();
    const { level: shownLevel, pending: faded } = stateRef.current;
    const inside = (px, py) => px >= -radius && px <= size + radius && py >= -radius && py <= size + radius;

    dotsRef.current.forEach(({ layer, items }) => {
      context.globalAlpha = faded.has(layer.id) ? FADED_ALPHA : 1;
      const color = paletteRef.current[layer.id] ?? '#fff';

      if (!badges) {
        context.fillStyle = color;
        context.lineWidth = 1;
        context.strokeStyle = OUTLINE;
        context.beginPath();
        items.forEach((item) => {
          if (!levelMatches(shownLevel, item)) return;
          const px = item.x * world + x;
          const py = item.y * world + y;
          if (!inside(px, py)) return;
          context.moveTo(px + radius, py);
          context.arc(px, py, radius, 0, TAU);
        });
        context.fill();
        context.stroke();
        return;
      }

      // Приближено: значок на тёмной подложке в кольце цвета слоя, как у крупных маркеров
      const spec = iconOf(layer.id);
      const image = spec ? iconImage(spec.src) : null;
      const side = radius * 2 * ((spec?.fit ?? 66) / 100);
      context.lineWidth = 2;
      items.forEach((item) => {
        if (!levelMatches(shownLevel, item)) return;
        const px = item.x * world + x;
        const py = item.y * world + y;
        if (!inside(px, py)) return;
        context.beginPath();
        context.arc(px, py, radius - 1, 0, TAU);
        context.fillStyle = BADGE_FILL;
        context.fill();
        if (image) {
          context.save();
          context.clip();
          context.drawImage(image, px - side / 2, py - side / 2, side, side);
          context.restore();
        }
        context.strokeStyle = color;
        context.beginPath();
        context.arc(px, py, radius - 1, 0, TAU);
        context.stroke();
      });
    });
    context.globalAlpha = 1;

    const picked = chosenDotRef.current;
    if (picked) {
      context.strokeStyle = RING;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(picked.item.x * world + x, picked.item.y * world + y, radius + 4, 0, TAU);
      context.stroke();
    }
  };

  useEffect(() => {
    const styles = getComputedStyle(viewportRef.current);
    paletteRef.current = Object.fromEntries(dotLayers.map(({ layer }) => [layer.id, cssColor(styles, layer.color)]));
    redraw();
  }, [dotLayers, level, pending, chosen?.layer.id, chosen?.index, redraw, viewportRef]);

  // Значки грузятся по требованию: как только очередной готов, точки на canvas перерисовываются
  useEffect(() => onIconLoaded(redraw), [redraw]);

  /** Ближайшая к точке экрана мелкая точка (координаты окна), если она в пределах досягаемости. */
  const dotAt = (clientX, clientY, coarse) => {
    const viewport = viewportRef.current;
    if (!viewport || dotsRef.current.length === 0) return null;
    const rect = viewport.getBoundingClientRect();
    const { scale, x, y } = viewRef.current;
    const world = rect.width * scale;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const radius = dotRadius();
    const reach = Math.max(coarse ? HIT_RADIUS_TOUCH : HIT_RADIUS, radius + (coarse ? 6 : 3));
    let best = null;
    let bestDistance = reach ** 2;
    dotsRef.current.forEach(({ layer, items }) => {
      items.forEach((item, index) => {
        if (!levelMatches(stateRef.current.level, item)) return;
        const dx = item.x * world + x - px;
        const dy = item.y * world + y - py;
        const distance = dx * dx + dy * dy;
        if (distance <= bestDistance) { // при равенстве побеждает слой, нарисованный выше
          bestDistance = distance;
          best = { key: `${layer.id}:${index}`, x: px + dx, y: py + dy, r: radius };
        }
      });
    });
    return best;
  };

  /** Маркер под указателем: сначала крупный (элемент DOM), потом мелкая точка. */
  const pinAt = (event) => {
    const element = event.target.closest?.('[data-pin]');
    if (element) {
      const box = element.getBoundingClientRect();
      const frame = viewportRef.current.getBoundingClientRect();
      return { key: element.dataset.pin, x: box.left + box.width / 2 - frame.left, y: box.top + box.height / 2 - frame.top, r: box.height / 2 };
    }
    return dotAt(event.clientX, event.clientY, event.pointerType === 'touch' || event.pointerType === 'pen');
  };

  const handlePointerMove = (event) => {
    if (event.pointerType !== 'mouse' || event.buttons) return; // подсказки — для мыши; при перетаскивании не нужны
    const hit = pinAt(event);
    if ((hit?.key ?? null) === (hover?.key ?? null)) return;
    setHover(hit);
  };

  const handleClick = (event) => {
    if (wasDragged() || event.target.closest?.('[data-no-pan]')) return;
    const hit = event.target.closest?.('[data-pin]')
      ? { key: event.target.closest('[data-pin]').dataset.pin }
      : dotAt(event.clientX, event.clientY, event.nativeEvent.pointerType === 'touch' || event.nativeEvent.pointerType === 'pen');
    onSelect(hit && hit.key !== selected ? hit.key : null);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && selected) onSelect(null);
  };

  const link = chosen && typeof chosen.item.tx === 'number' ? chosen.item : null;
  const frameWidth = viewportRef.current?.clientWidth ?? 0;
  const tipX = hover ? Math.min(Math.max(hover.x, 130), Math.max(130, frameWidth - 130)) : 0;
  const tipBelow = hover ? hover.y < 110 : false;

  return (
    <div className="map-stage">
      <div
        ref={viewportRef}
        className={`map-viewport${zoomed ? ' is-zoomed' : ''}${hover ? ' has-hover' : ''}${level === 'under' ? ' is-under' : ''}`}
        style={{ touchAction: zoomed ? 'none' : 'pan-y' }}
        tabIndex={0}
        role="application"
        aria-label={t('map.canvasLabel')}
        onPointerMove={handlePointerMove}
        onPointerLeave={clearHover}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <div ref={worldRef} className="map-world">
          {ground.status === 'ready' && <MapGround shape={ground.shape} />}
          {rawBase && map.images.base && (
            <img
              className="map-base"
              src={map.images.base}
              alt=""
              draggable={false}
              onLoad={() => setImageState('ready')}
              onError={() => setImageState('failed')}
            />
          )}
          {wantMid && tunnelsMid.status === 'ready' && <MapTunnels shape={tunnelsMid.shape} color={LAYER_BY_ID.tunnels_mid.color} />}
          {wantMid && tunnelsMid.status === 'failed' && <img className="map-tunnels" src={map.images.tunnelsMid} alt="" draggable={false} />}
          {wantRat && tunnelsRat.status === 'ready' && <MapTunnels shape={tunnelsRat.shape} color={LAYER_BY_ID.tunnels_rat.color} />}
          {wantRat && tunnelsRat.status === 'failed' && <img className="map-tunnels" src={map.images.tunnelsRat} alt="" draggable={false} />}
          {visible.has('heat') && heat && <HeatCanvas heat={heat} metric={heatMetric} />}

          <svg className="map-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            {visible.has('ziplines') && map.ziplines.map((line) => (
              <g key={line.id}>
                <path className="map-zipline map-zipline--casing" d={line.d} />
                <path className="map-zipline" d={line.d} stroke={line.color} />
              </g>
            ))}
            {link && (
              <line
                className="map-link"
                x1={chosen.item.x * 1000}
                y1={chosen.item.y * 1000}
                x2={link.tx * 1000}
                y2={link.ty * 1000}
              />
            )}
          </svg>
        </div>

        <canvas ref={canvasRef} className="map-dots" aria-hidden="true" />

        <div ref={pinsRef} className="map-world">
          {LAYERS.filter((layer) => layer.kind === 'pin' && visible.has(layer.id)).map((layer) => (
            <Pins
              key={layer.id}
              layer={layer}
              items={map.layers[layer.id]}
              selectedIndex={chosen?.layer.id === layer.id ? chosen.index : -1}
              level={level}
              pending={pending.has(layer.id)}
            />
          ))}
          {link && (
            <span
              className="map-pin map-pin--target"
              style={{ left: `${link.tx * 100}%`, top: `${link.ty * 100}%` }}
            />
          )}
        </div>

        {baseLoading && <div className="map-status"><div className="spinner" /></div>}
        {rawBase && imageState === 'failed' && <div className="map-status map-status--error">{t('map.imageError')}</div>}

        <div className="map-controls" data-no-pan>
          <button type="button" className="map-btn" onClick={() => zoomBy(BUTTON_ZOOM)} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}>+</button>
          <button type="button" className="map-btn" onClick={() => zoomBy(1 / BUTTON_ZOOM)} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}>−</button>
          {zoomed && (
            <button type="button" className="map-btn map-btn--wide" onClick={reset} aria-label={t('map.resetView')} title={t('map.resetView')}>1:1</button>
          )}
        </div>

        {tip && (
          <div
            className={`map-tip${tipBelow ? ' map-tip--below' : ''}`}
            style={{ left: tipX, top: tipBelow ? hover.y + hover.r + 10 : hover.y - hover.r - 10 }}
            role="tooltip"
          >
            <div className="map-tip__title">{tip.title}</div>
            {tip.meta.length > 0 && <div className="map-tip__meta">{tip.meta.join(' · ')}</div>}
            {tip.hint && <div className="map-tip__hint">{tip.hint}</div>}
          </div>
        )}

        {card && (
          <div className="map-card" data-no-pan>
            <div className="map-card__head">
              <span className="map-card__title">{card.title}</span>
              {card.isNew && <span className="tag tag--role">{t('map.new')}</span>}
              <button type="button" className="map-card__close" onClick={() => onSelect(null)} aria-label={t('map.close')}>✕</button>
            </div>
            {card.meta.length > 0 && <div className="map-card__meta">{card.meta.join(' · ')}</div>}
            {card.hint && <p className="map-card__hint">{card.hint}</p>}
          </div>
        )}
      </div>
      {children}
      <p className="map-help">{t('map.help')}<span className="map-help__keys">{t('map.helpKeys')}</span></p>
    </div>
  );
}

export default MapCanvas;
