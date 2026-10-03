import { useTranslation } from '../../hooks/useTranslation';
import { HARD, SLIDER, hexToRgb, rgbToHex } from '../../services/crosshairService';

/** Число с ползунком: ползунок рассчитан на привычные значения, а в числовое поле можно ввести и другие. */
function NumberField({ id, label, value, max, step, onChange }) {
  const sliderMax = Math.max(max, Math.ceil(value));
  return (
    <div className="cx-field">
      <label className="cx-field__label" htmlFor={`${id}-num`}>{label}</label>
      <input
        type="range"
        className="cx-field__range"
        min={0}
        max={sliderMax}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
      <input
        id={`${id}-num`}
        type="number"
        className="cx-field__num"
        min={0}
        max={step < 1 ? 1 : HARD.sizeMax}
        step={step}
        value={value}
        onChange={(event) => {
          // Пустое поле — «пока ничего»: значение не меняем, пока не введено число
          if (event.target.value !== '') onChange(Number(event.target.value));
        }}
      />
    </div>
  );
}

function ColorField({ id, label, r, g, b, onChange }) {
  return (
    <div className="cx-field cx-field--color">
      <label className="cx-field__label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="color"
        className="cx-field__color"
        value={rgbToHex(r, g, b)}
        onChange={(event) => {
          const rgb = hexToRgb(event.target.value);
          if (rgb) onChange(rgb);
        }}
      />
      <code className="cx-field__hex">{rgbToHex(r, g, b)}</code>
    </div>
  );
}

const GROUP_KEYS = {
  pips: ['pip_width', 'pip_height', 'pip_gap', 'pip_opacity', 'pip_outline_border', 'pip_outline_gap', 'pip_outline_opacity'],
  dot: ['dot_size', 'dot_opacity', 'dot_outline_border', 'dot_outline_gap', 'dot_outline_opacity'],
};

/**
 * Поля настроек прицела: линии, точка, цвета и два переключателя. Само состояние хранит страница.
 * @param {{ settings: import('../../services/crosshairService.js').CROSSHAIR_DEFAULTS, onChange: (patch: object) => void }} props
 */
function CrosshairControls({ settings, onChange }) {
  const t = useTranslation();

  return (
    <div className="cx-controls">
      <div className="cx-toggles">
        <label className="cx-check">
          <input type="checkbox" checked={settings.themed} onChange={(event) => onChange({ themed: event.target.checked })} />
          <span>{t('crosshair.themed')}</span>
        </label>
        <p className="cx-hint">{t('crosshair.themedHint')}</p>
      </div>

      {Object.entries(GROUP_KEYS).map(([group, keys]) => (
        <fieldset key={group} className="cx-group">
          <legend className="cx-group__title">{t(`crosshair.groups.${group}`)}</legend>
          {keys.map((key) => (
            <NumberField
              key={key}
              id={`cx-${key}`}
              label={t(`crosshair.fields.${key}`)}
              value={settings[key]}
              max={SLIDER[key].max}
              step={SLIDER[key].step}
              onChange={(value) => onChange({ [key]: value })}
            />
          ))}
          {group === 'pips' && (
            <div className="cx-toggles">
              <label className="cx-check">
                <input type="checkbox" checked={settings.pip_gap_static} onChange={(event) => onChange({ pip_gap_static: event.target.checked })} />
                <span>{t('crosshair.gapStatic')}</span>
              </label>
              <p className="cx-hint">{t('crosshair.gapStaticHint')}</p>
            </div>
          )}
        </fieldset>
      ))}

      <fieldset className="cx-group">
        <legend className="cx-group__title">{t('crosshair.groups.colors')}</legend>
        <ColorField
          id="cx-color"
          label={t('crosshair.color')}
          r={settings.color_r}
          g={settings.color_g}
          b={settings.color_b}
          onChange={({ r, g, b }) => onChange({ color_r: r, color_g: g, color_b: b })}
        />
        <ColorField
          id="cx-outline-color"
          label={t('crosshair.outlineColor')}
          r={settings.outline_color_r}
          g={settings.outline_color_g}
          b={settings.outline_color_b}
          onChange={({ r, g, b }) => onChange({ outline_color_r: r, outline_color_g: g, outline_color_b: b })}
        />
      </fieldset>
    </div>
  );
}

export default CrosshairControls;
