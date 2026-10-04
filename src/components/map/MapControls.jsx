import { useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { CLOCK_MAX, LEVELS, TIMER_KEYS, formatClock, spawnTicks } from '../../services/mapService';

/**
 * Уровень карты (все / улицы / под землёй) и счётчик показанных объектов.
 * @param {{ level: 'all'|'street'|'under', onChange: (level: string) => void, shown: number }} props
 */
export function MapLevels({ level, onChange, shown }) {
  const t = useTranslation();
  return (
    <div className="map-level">
      <div className="map-level__row">
        <span className="map-level__label" id="map-level-label">{t('map.level.label')}</span>
        <div className="chip-group" role="group" aria-labelledby="map-level-label">
          {LEVELS.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip ${level === id ? 'active' : ''}`}
              aria-pressed={level === id}
              onClick={() => onChange(id)}
            >
              {t(`map.level.${id}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="map-level__shown" aria-live="polite">{t('map.shown', { count: shown })}</p>
    </div>
  );
}

/** Название строки таймера: у лагерей — те же слова, что в списке слоёв. */
export function timerName(t, key) {
  return t(`map.timers.rows.${key}`);
}

/**
 * Время матча под картой: включается кнопкой, дальше ползунок и «играть». Объекты, которых к этому времени ещё
 * нет, на карте затемнены. Под ползунком — быстрые переходы к моментам, когда на карте что-то появляется.
 * Без данных о таймерах (API не ответил) блок не показывается.
 * @param {{ timers: any, clock: number|null, playing: boolean, onClock: (value: number|null) => void, onPlaying: (on: boolean) => void }} props
 */
export function MapClock({ timers, clock, playing, onClock, onPlaying }) {
  const t = useTranslation();
  const ticks = useMemo(() => spawnTicks(timers), [timers]);
  if (!timers) return null;
  const on = clock !== null;

  return (
    <div className={`map-clock${on ? ' is-on' : ''}`}>
      <div className="map-clock__bar">
        <button
          type="button"
          className={`chip map-clock__toggle ${on ? 'active' : ''}`}
          aria-pressed={on}
          title={on ? t('map.clock.off') : undefined}
          onClick={() => { onPlaying(false); onClock(on ? null : 0); }}
        >
          {t('map.clock.toggle')}
        </button>

        {on && (
          <>
            <button
              type="button"
              className="map-btn map-clock__play"
              aria-label={playing ? t('map.clock.pause') : t('map.clock.play')}
              title={playing ? t('map.clock.pause') : t('map.clock.play')}
              onClick={() => onPlaying(!playing)}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              className="map-clock__range"
              min={0}
              max={CLOCK_MAX}
              step={5}
              value={clock}
              aria-label={t('map.clock.slider')}
              aria-valuetext={formatClock(clock)}
              onChange={(event) => { onPlaying(false); onClock(Number(event.target.value)); }}
            />
            <output className="map-clock__time">{formatClock(clock)}</output>
          </>
        )}
      </div>

      {on && (
        <>
          <div className="map-clock__ticks">
            {ticks.map(({ at, keys }) => (
              <button
                key={at}
                type="button"
                className={`map-clock__tick${clock >= at ? ' is-up' : ''}`}
                aria-label={t('map.clock.jump', { time: formatClock(at) })}
                onClick={() => { onPlaying(false); onClock(at); }}
              >
                <b>{formatClock(at)}</b>
                {keys.map((key) => timerName(t, key)).join(' · ')}
              </button>
            ))}
          </div>
          <p className="map-clock__hint">{t('map.clock.hint')}</p>
        </>
      )}
    </div>
  );
}

/**
 * Таблица «Таймеры спавна»: первое появление и интервал по видам лагерей, ящиков и усилений — как в конфигурации игры.
 * Когда включено время матча, строки, которые уже появились, подсвечены.
 * @param {{ timers: any, clock: number|null }} props
 */
export function SpawnTimers({ timers, clock }) {
  const t = useTranslation();
  if (!timers) return null;
  const rows = TIMER_KEYS.filter((key) => timers[key]);
  if (rows.length === 0) return null;

  return (
    <section className="map-timers">
      <h3 className="map-layers__title">{t('map.timers.title')}</h3>
      <table className="map-timers__table">
        <thead>
          <tr>
            <th scope="col">{t('map.timers.name')}</th>
            <th scope="col">{t('map.timers.first')}</th>
            <th scope="col">{t('map.timers.every')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((key) => {
            const { first, every } = timers[key];
            const up = clock !== null && Number.isFinite(first) && clock >= first;
            return (
              <tr key={key} className={up ? 'is-up' : undefined}>
                <th scope="row">{timerName(t, key)}</th>
                <td>{Number.isFinite(first) ? formatClock(first) : '—'}</td>
                <td>{Number.isFinite(every) ? formatClock(every) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="map-timers__note">{t('map.timers.note')}</p>
    </section>
  );
}
