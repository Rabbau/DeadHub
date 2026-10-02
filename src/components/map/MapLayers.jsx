import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { formatCompact } from '../../services/format';
import { HEAT_PHASES, LAYERS, LAYER_GROUPS, heatColor, laneColors } from '../../services/mapService';
import { pinClass, pinColor } from './pinInfo';

// Как выглядит маркер слоя в списке: берём тот же класс, что и на карте, — образец не расходится с картой
const SAMPLE_ITEMS = {
  objectives: { type: 'walker', team: 0 },
  sentries: { team: 0 },
  shops: { kind: 'lane' },
  urns: { kind: 'spawn' },
};

const RAMP = [0, 0.25, 0.5, 0.75, 1]
  .map((level) => {
    const [r, g, b, a] = heatColor(level);
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)}) ${level * 100}%`;
  })
  .join(', ');

function Sample({ layer, colors }) {
  if (layer.id === 'ziplines') {
    return (
      <span className="map-sample map-sample--lines" aria-hidden="true">
        {['left', 'center', 'right'].map((lane) => <i key={lane} style={{ background: colors[lane] ?? layer.color }} />)}
      </span>
    );
  }
  if (layer.kind === 'image' || layer.kind === 'heat') {
    return <span className={`map-sample map-sample--${layer.kind}`} style={{ '--c': layer.color }} aria-hidden="true" />;
  }
  const item = SAMPLE_ITEMS[layer.id] ?? {};
  return (
    <span
      className={`${pinClass(layer, item, false)} map-pin--sample`}
      style={{ '--c': pinColor(layer, item) }}
      aria-hidden="true"
    />
  );
}

function layerCount(map, layer) {
  if (layer.id === 'ziplines') return map.ziplines.length;
  if (layer.id === 'tunnels_mid') return map.images.tunnelsMid ? null : 0;
  if (layer.id === 'tunnels_rat') return map.images.tunnelsRat ? null : 0;
  if (layer.kind === 'heat') return null;
  return map.layers[layer.id]?.length ?? 0;
}

function HeatControls({ heat }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);

  return (
    <div className="map-heat-controls">
      <div className="map-heat-controls__row">
        <span className="map-heat-controls__label">{t('map.heat.metric')}</span>
        <div className="chip-group">
          {['deaths', 'kills'].map((metric) => (
            <button
              key={metric}
              type="button"
              className={`chip ${heat.metric === metric ? 'active' : ''}`}
              aria-pressed={heat.metric === metric}
              onClick={() => heat.setMetric(metric)}
            >
              {t(`map.heat.${metric}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="map-heat-controls__row">
        <span className="map-heat-controls__label">{t('map.heat.phase')}</span>
        <div className="chip-group">
          {Object.keys(HEAT_PHASES).map((phase) => (
            <button
              key={phase}
              type="button"
              className={`chip ${heat.phase === phase ? 'active' : ''}`}
              aria-pressed={heat.phase === phase}
              onClick={() => heat.setPhase(phase)}
            >
              {t(`map.heat.phases.${phase}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="map-heat-legend" aria-hidden="true">
        <span>{t('map.heat.low')}</span>
        <span className="map-heat-legend__bar" style={{ background: `linear-gradient(90deg, ${RAMP})` }} />
        <span>{t('map.heat.high')}</span>
      </div>

      <p className="map-heat-controls__note">
        {heat.error && !heat.data && t('map.heat.error')}
        {heat.loading && !heat.data && t('map.heat.loading')}
        {heat.data && t('map.heat.total', { count: formatCompact(heat.metric === 'kills' ? heat.data.kills : heat.data.deaths, language) })}
        {heat.data && heat.loading && ` · ${t('map.heat.loading')}`}
      </p>
      <p className="map-heat-controls__note">{t('map.heat.hint')}</p>
    </div>
  );
}

/**
 * Список слоёв по группам. У слоя с данными, которых нет в ответе API (старая версия клиента),
 * строки нет — чекбокс, включающий пустоту, только путал бы.
 * @param {{ map: any, visible: Set<string>, onToggle: (id: string) => void, heat: any }} props
 */
function MapLayers({ map, visible, onToggle, heat }) {
  const t = useTranslation();
  const colors = laneColors(map);

  return (
    <div className="map-layers">
      {LAYER_GROUPS.map((group) => {
        const rows = LAYERS.filter((layer) => layer.group === group)
          .map((layer) => ({ layer, count: layerCount(map, layer) }))
          .filter((row) => row.count !== 0);
        if (rows.length === 0) return null;

        return (
          <section key={group} className="map-layers__group">
            <h3 className="map-layers__title">{t(`map.groups.${group}`)}</h3>
            {rows.map(({ layer, count }) => {
              const on = visible.has(layer.id);
              return (
                <div key={layer.id}>
                  <label className={`map-layer${on ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => onToggle(layer.id)} />
                    <span className="map-layer__mark"><Sample layer={layer} colors={colors} /></span>
                    <span className="map-layer__name">{t(`map.layers.${layer.id}.name`)}</span>
                    {layer.isNew && <span className="map-layer__new">{t('map.new')}</span>}
                    {count !== null && <span className="map-layer__count">{count}</span>}
                  </label>
                  {layer.id === 'heat' && on && <HeatControls heat={heat} />}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

export default MapLayers;
