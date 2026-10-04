import { memo } from 'react';

/** Улицы и здания города: векторный контур миникарты, чёткий при любом приближении. */
export const MapGround = memo(function MapGround({ shape }) {
  return (
    <svg className="map-ground" viewBox={`0 0 ${shape.size} ${shape.size}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="map-ground__glow map-ground__glow--wide" d={shape.ground} />
      <path className="map-ground__glow" d={shape.ground} />
      <path className="map-ground__floor" d={shape.ground} />
      <path className="map-ground__walls" d={shape.holes} />
    </svg>
  );
});

/** Один слой туннелей: коридоры контуром и заливкой цвета слоя. */
export const MapTunnels = memo(function MapTunnels({ shape, color }) {
  return (
    <svg className="map-tunnels-vector" viewBox={`0 0 ${shape.size} ${shape.size}`} preserveAspectRatio="none" aria-hidden="true" style={{ '--c': color }}>
      <path className="map-tunnels-vector__path" d={shape.d} />
    </svg>
  );
});
