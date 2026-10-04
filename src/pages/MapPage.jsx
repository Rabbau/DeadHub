import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import MapCanvas from '../components/map/MapCanvas';
import MapLayers from '../components/map/MapLayers';
import { MapClock, MapLevels, SpawnTimers } from '../components/map/MapControls';
import StatsFilters from '../components/ui/StatsFilters';
import { useHeat } from '../hooks/useHeat';
import { useMap } from '../hooks/useMap';
import { useSpawnTimers } from '../hooks/useSpawnTimers';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import { CURRENT_UPDATE } from '../data/updates';
import {
  CLOCK_MAX,
  LAYERS,
  PRESETS,
  activePreset,
  clockFromSearch,
  layersFromSearch,
  levelFromSearch,
  levelMatches,
  pendingLayers,
  searchForState,
} from '../services/mapService';

const CLOCK_STEP_S = 15;       // на сколько секунд матча сдвигается время за один шаг «игры»
const CLOCK_TICK_MS = 250;     // как часто: минута матча за секунду
const URL_DELAY_MS = 250;      // время в адресе обновляется, когда ползунок остановился

/** Строка адреса вручную, чтобы запятые остались читаемыми (URLSearchParams превратил бы их в %2C). */
function searchString(state) {
  const search = Object.entries(searchForState(state)).map(([key, value]) => `${key}=${value}`).join('&');
  return search ? `?${search}` : '';
}

function MapPage() {
  const t = useTranslation();
  usePageMeta('map');
  const { map, loading, error } = useMap();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [heatMetric, setHeatMetric] = useState('deaths');
  const [heatPhase, setHeatPhase] = useState('all');
  // Время матча живёт в состоянии (ползунок и «игра» обновляют его часто), в адрес оно попадает, когда остановилось
  const [clock, setClock] = useState(() => clockFromSearch(params));
  const [playing, setPlaying] = useState(false);

  // Набор слоёв и уровень живут в адресе: им можно поделиться, а ссылки «Что нового» ведут сразу на нужный вид
  const layers = useMemo(() => layersFromSearch(params), [params]);
  const visible = useMemo(() => new Set(layers), [layers]);
  const level = levelFromSearch(params);
  const preset = activePreset(layers);
  const heatOn = visible.has('heat');
  const heat = useHeat(heatOn, heatPhase);
  const timers = useSpawnTimers();
  const pending = useMemo(() => pendingLayers(clock, timers), [clock, timers]);

  // Замена, а не новая запись: щелчки по слоям не засоряют историю браузера
  const apply = useCallback((state) => navigate({ search: searchString(state) }, { replace: true }), [navigate]);
  const setLayers = (ids) => apply({ layers: ids, level, clock });
  const toggle = (id) => setLayers(visible.has(id) ? layers.filter((x) => x !== id) : [...layers, id]);
  const setMany = (ids, on) => setLayers(on ? [...layers, ...ids] : layers.filter((id) => !ids.includes(id)));
  const changeLevel = (next) => { setSelected(null); apply({ layers, level: next, clock }); };

  // Время матча → адрес, когда оно перестало меняться (пока идёт «игра», адрес не трогаем)
  useEffect(() => {
    if (playing || !map) return undefined;
    const current = params.has('t') ? clockFromSearch(params) : null;
    if (current === clock) return undefined;
    const timer = setTimeout(() => apply({ layers, level, clock }), URL_DELAY_MS);
    return () => clearTimeout(timer);
    // params, layers и level читаем, но не следим за ними: адрес меняют и слои, а нам важно только время
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, playing, map]);

  // «Игра»: минута матча за секунду, на сороковой минуте останавливается
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      setClock((value) => {
        const next = (value ?? 0) + CLOCK_STEP_S;
        if (next >= CLOCK_MAX) { setPlaying(false); return CLOCK_MAX; }
        return next;
      });
    }, CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [playing]);

  // Сколько объектов на карте сейчас: включённые слои с учётом уровня
  const shown = useMemo(() => {
    if (!map) return 0;
    return LAYERS.reduce((sum, layer) => {
      if (!visible.has(layer.id) || (layer.kind !== 'pin' && layer.kind !== 'dot')) return sum;
      return sum + (map.layers[layer.id] ?? []).filter((item) => levelMatches(level, item)).length;
    }, 0);
  }, [map, visible, level]);

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
          level={level}
          pending={pending}
          timers={timers}
          heat={heat.heat}
          heatMetric={heatMetric}
          selected={selected}
          onSelect={setSelected}
        >
          <MapClock timers={timers} clock={clock} playing={playing} onClock={setClock} onPlaying={setPlaying} />
        </MapCanvas>
        <aside className="map-side" aria-label={t('map.layersTitle')}>
          <h2 className="section__title">{t('map.layersTitle')}</h2>
          <MapLevels level={level} onChange={changeLevel} shown={shown} />
          <MapLayers
            map={map}
            visible={visible}
            level={level}
            onToggle={toggle}
            onSetMany={setMany}
            heat={{ ...heat, metric: heatMetric, setMetric: setHeatMetric, phase: heatPhase, setPhase: setHeatPhase, data: heat.heat }}
          />
          <SpawnTimers timers={timers} clock={clock} />
        </aside>
      </div>
    </div>
  );
}

export default MapPage;
