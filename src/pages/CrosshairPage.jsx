import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CrosshairControls from '../components/crosshair/CrosshairControls';
import { crosshairImageUrl, decodeCrosshairCode, fetchCrosshairCode } from '../api/index.js';
import { useCopy } from '../hooks/useCopy';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePageMeta } from '../hooks/usePageMeta';
import { useStoredChoice } from '../hooks/useStoredChoice';
import { useTranslation } from '../hooks/useTranslation';
import {
  CROSSHAIR_DEFAULTS, CROSSHAIR_PRESETS, DEFAULT_SCREEN_HEIGHT, SCREEN_HEIGHTS, activePreset, codeFromSearch, importInput,
  normalizeSettings, presetSettings, sameSettings,
} from '../services/crosshairService';

const BACKGROUNDS = ['dark', 'light', 'green', 'city'];

/**
 * Студия прицела (адрес /crosshair): настройки слева, справа предпросмотр, который рисует API, и код для игры.
 * Код из адреса (?code=DL…) открывает чужой прицел; кнопка «Скопировать ссылку» делает такой адрес.
 * Запросы к API уходят, когда посетитель остановился (useDebouncedValue), а не на каждое движение ползунка.
 */
function CrosshairPage() {
  const t = useTranslation();
  usePageMeta('crosshair');
  const [params] = useSearchParams();
  const [initialCode] = useState(() => codeFromSearch(params));

  const [settings, setSettings] = useState(CROSSHAIR_DEFAULTS);
  const [background, setBackground] = useStoredChoice('dlhub_crosshair_bg', BACKGROUNDS, 'dark');
  const [screenHeight, setScreenHeight] = useState(DEFAULT_SCREEN_HEIGHT);
  const [code, setCode] = useState({ value: null, state: 'loading' });
  const [picture, setPicture] = useState({ url: '', state: 'loading' });
  const [importText, setImportText] = useState('');
  const [importState, setImportState] = useState('idle'); // idle | loading | error
  const [codeCopy, copyCode] = useCopy();
  const [linkCopy, copyLink] = useCopy();

  const settled = useDebouncedValue(settings, 350);
  const imageUrl = crosshairImageUrl(settled, { screenHeight });
  const pictureState = picture.url === imageUrl ? picture.state : 'loading';
  const preset = activePreset(settings);

  const change = (patch) => setSettings((prev) => normalizeSettings({ ...prev, ...patch }));

  // Код для игры по успокоившимся настройкам
  useEffect(() => {
    let cancelled = false;
    setCode((prev) => ({ ...prev, state: 'loading' }));
    fetchCrosshairCode(settled)
      .then((value) => { if (!cancelled) setCode({ value, state: 'ready' }); })
      .catch(() => { if (!cancelled) setCode((prev) => ({ ...prev, state: 'error' })); });
    return () => { cancelled = true; };
  }, [settled]);

  // Прицел из адреса: расшифровать код и подставить настройки
  useEffect(() => {
    if (!initialCode) return undefined;
    let cancelled = false;
    setImportState('loading');
    decodeCrosshairCode(initialCode)
      .then((decoded) => { if (!cancelled) { setSettings(decoded); setImportState('idle'); } })
      .catch(() => { if (!cancelled) setImportState('error'); });
    return () => { cancelled = true; };
  }, [initialCode]);

  const runImport = (event) => {
    event.preventDefault();
    const text = importInput(importText);
    if (!text) { setImportState('error'); return; }
    setImportState('loading');
    decodeCrosshairCode(text)
      .then((decoded) => { setSettings(decoded); setImportState('idle'); setImportText(''); })
      .catch(() => setImportState('error'));
  };

  const shareLink = code.value ? `${window.location.origin}${window.location.pathname}?code=${encodeURIComponent(code.value)}` : '';

  return (
    <div className="page cx-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('crosshair.title')} <em>{t('crosshair.titleAccent')}</em></h1>
          <div className="page-subtitle">{t('crosshair.subtitle')}</div>
        </div>
      </div>

      <div className="cx-layout">
        <div className="cx-side">
          <section className="cx-panel cx-import-panel" aria-labelledby="cx-import">
            <h2 className="cx-panel__title" id="cx-import">{t('crosshair.importTitle')}</h2>
            <form className="cx-import" onSubmit={runImport}>
              <input
                type="text"
                className="input cx-import__input"
                value={importText}
                placeholder={t('crosshair.importPlaceholder')}
                aria-label={t('crosshair.importTitle')}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => { setImportText(event.target.value); if (importState === 'error') setImportState('idle'); }}
              />
              <button type="submit" className="btn btn-secondary" disabled={importState === 'loading' || !importText.trim()}>
                {importState === 'loading' ? t('crosshair.importWorking') : t('crosshair.importButton')}
              </button>
            </form>
            {importState === 'error' && <p className="cx-hint cx-hint--error" role="alert">{t('crosshair.importError')}</p>}
            <p className="cx-hint">{t('crosshair.importHint')}</p>
          </section>

          <section className="cx-panel" aria-labelledby="cx-presets">
            <h2 className="cx-panel__title" id="cx-presets">{t('crosshair.presets')}</h2>
            <div className="chip-group">
              {CROSSHAIR_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip${preset === item.id ? ' active' : ''}`}
                  aria-pressed={preset === item.id}
                  onClick={() => setSettings(presetSettings(item.id))}
                >
                  {t(`crosshair.presetNames.${item.id}`)}
                </button>
              ))}
            </div>
            {!sameSettings(settings, CROSSHAIR_DEFAULTS) && (
              <button type="button" className="cx-link" onClick={() => setSettings(CROSSHAIR_DEFAULTS)}>{t('crosshair.reset')}</button>
            )}
          </section>

          <CrosshairControls settings={settings} onChange={change} />
        </div>

        <div className="cx-main">
          <section className="cx-panel cx-stage-panel" aria-labelledby="cx-preview">
            <h2 className="cx-panel__title" id="cx-preview">{t('crosshair.preview')}</h2>
            <div className={`cx-stage cx-stage--${background}`}>
              <img
                key={imageUrl}
                className="cx-stage__img"
                src={imageUrl}
                alt={t('crosshair.previewAlt')}
                onLoad={() => setPicture({ url: imageUrl, state: 'ready' })}
                onError={() => setPicture({ url: imageUrl, state: 'error' })}
              />
              {pictureState === 'loading' && <span className="cx-stage__status">{t('crosshair.imageLoading')}</span>}
              {pictureState === 'error' && <span className="cx-stage__status cx-stage__status--error">{t('crosshair.imageError')}</span>}
            </div>
            <p className="cx-hint">{t('crosshair.previewHint')}</p>
          </section>

          <section className="cx-panel cx-stage-options" aria-label={t('crosshair.background')}>
            <div className="cx-row cx-row--flush">
              <div className="chip-group" role="group" aria-label={t('crosshair.background')}>
                {BACKGROUNDS.map((key) => (
                  <button key={key} type="button" className={`chip${background === key ? ' active' : ''}`} aria-pressed={background === key} onClick={() => setBackground(key)}>
                    {t(`crosshair.backgrounds.${key}`)}
                  </button>
                ))}
              </div>
              <label className="cx-field cx-field--inline">
                <span className="cx-field__label">{t('crosshair.screenHeight')}</span>
                <select className="select" value={screenHeight} onChange={(event) => setScreenHeight(Number(event.target.value))}>
                  {SCREEN_HEIGHTS.map((height) => <option key={height} value={height}>{height} px</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="cx-panel cx-code-panel" aria-labelledby="cx-code">
            <h2 className="cx-panel__title" id="cx-code">{t('crosshair.code')}</h2>
            <div className="cx-code" aria-live="polite">
              {code.value ? <code className="cx-code__text">{code.value}</code> : <span className="cx-hint">{t('crosshair.codeWorking')}</span>}
            </div>
            {code.state === 'error' && <p className="cx-hint cx-hint--error" role="alert">{t('crosshair.codeError')}</p>}
            <div className="cx-row">
              <button type="button" className="btn btn-primary" disabled={!code.value || code.state !== 'ready'} onClick={() => copyCode(code.value)}>
                {codeCopy === 'copied' ? `✓ ${t('crosshair.copied')}` : codeCopy === 'failed' ? t('crosshair.copyFailed') : t('crosshair.copyCode')}
              </button>
              <button type="button" className="btn btn-secondary" disabled={!shareLink || code.state !== 'ready'} onClick={() => copyLink(shareLink)}>
                {linkCopy === 'copied' ? `✓ ${t('crosshair.copied')}` : linkCopy === 'failed' ? t('crosshair.copyFailed') : t('crosshair.copyLink')}
              </button>
            </div>
            <p className="cx-hint">{t('crosshair.codeHint')}</p>
          </section>
        </div>
      </div>

      <p className="cx-note">{t('crosshair.note')}</p>
    </div>
  );
}

export default CrosshairPage;
