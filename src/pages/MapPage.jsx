import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import MapCanvas from '../components/map/MapCanvas';
import MapLayers from '../components/map/MapLayers';
import StatsFilters from '../components/ui/StatsFilters';
import { useHeat } from '../hooks/useHeat';
import { useMap } from '../hooks/useMap';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import { CURRENT_UPDATE } from '../data/updates';
import { PRESETS, activePreset, layersFromSearch, searchForLayers } from '../services/mapService';

function MapPage() {
  const t = useTranslation();
  usePageMeta('map');
  const { map, loading, error } = useMap();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [heatMetric, setHeatMetric] = useState('deaths');
  const [heatPhase, setHeatPhase] = useState('all');

  // Набор слоёв живёт в адресе: им можно поделиться, а ссылки «Что нового» ведут сразу на нужный вид
  const layers = useMemo(() => layersFromSearch(params), [params]);
  const visible = useMemo(() => new Set(layers), [layers]);
  const preset = activePreset(layers);
  const heatOn = visible.has('heat');
  const heat = useHeat(heatOn, heatPhase);

  const setLayers = useCallback((ids) => {
    // Строка собирается вручную, чтобы запятые в адресе остались читаемыми (URLSearchParams превратил бы их в %2C).
    // Значения — только известные идентификаторы слоёв, экранировать нечего. Замена, а не новая запись:
    // щелчки по слоям не засоряют историю браузера.
    const search = Object.entries(searchForLayers(ids)).map(([key, value]) => `${key}=${value}`).join('&');
    navigate({ search: search ? `?${search}` : '' }, { replace: true });
  }, [navigate]);

  const toggle = (id) => setLayers(visible.has(id) ? layers.filter((x) => x !== id) : [...layers, id]);

  if (loading) {
    return (
      <div className="page state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !map) {
    return (
      <div className="page">
        <div className="state-center state-error">
          {t('common.error')}: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="page map-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('map.title')}</h1>
          <div className="page-subtitle">{t('map.subtitle')}</div>
        </div>
        {/* Украшение: постеры Патронов — главных целей на карте */}
        <div className="map-patrons" aria-hidden="true">
          <img src="/art/patron-hidden-king.webp" alt="" width="520" height="390" loading="lazy" decoding="async" />
          <img src="/art/patron-archmother.webp" alt="" width="520" height="390" loading="lazy" decoding="async" />
        </div>
      </div>

      {/* Тепловая карта строится только по обычным матчам: у Street Brawl другая арена */}
      {heatOn && <StatsFilters modes={false} />}

      <div className="map-presets" role="group" aria-label={t('map.presetsLabel')}>
        <span className="map-presets__label">{t('map.presetsLabel')}</span>
        <div className="chip-group">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${preset === item.id ? 'active' : ''}`}
              aria-pressed={preset === item.id}
              onClick={() => { setSelected(null); setLayers(item.layers); }}
            >
              {t(`map.presets.${item.id}`)}
            </button>
          ))}
        </div>
      </div>

      {preset === 'new' && (
        <p className="map-note">
          {t('map.newNote', { name: CURRENT_UPDATE.name })} <Link to="/update">{t('map.newNoteLink')}</Link>
        </p>
      )}

      <div className="map-layout">
        <MapCanvas
          map={map}
          visible={visible}
          heat={heat.heat}
          heatMetric={heatMetric}
          selected={selected}
          onSelect={setSelected}
        />
        <aside className="map-side" aria-label={t('map.layersTitle')}>
          <h2 className="section__title">{t('map.layersTitle')}</h2>
          <MapLayers
            map={map}
            visible={visible}
            onToggle={toggle}
            heat={{ ...heat, metric: heatMetric, setMetric: setHeatMetric, phase: heatPhase, setPhase: setHeatPhase, data: heat.heat }}
          />
        </aside>
      </div>
    </div>
  );
}

export default MapPage;
