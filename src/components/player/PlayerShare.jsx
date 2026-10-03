import { useEffect, useRef, useState } from 'react';
import { canvasToBlob, drawShareCard, loadImage } from './shareCardCanvas';
import { useRanks } from '../../hooks/useRanks';
import { useTranslation } from '../../hooks/useTranslation';
import { buildShareModel, cardFileName } from '../../services/shareCardService';

/** Скачивает blob файлом: временная ссылка с атрибутом download. */
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const canCopyImage = () => typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write);

/**
 * Картинка профиля для публикации: рисуется на canvas в браузере по кнопке (картинки аватара, ранга и героев
 * подгружаются только тогда), скачивается PNG-файлом или копируется в буфер обмена. На сервер ничего не уходит.
 * @param {{ accountId: number, steam: any, rank: any, history: any[], heroStats: any[], heroes: any[], language: string, name: string }} props
 */
function PlayerShare({ accountId, steam, rank, history, heroStats, heroes, language, name }) {
  const t = useTranslation();
  const ranks = useRanks();
  const canvasRef = useRef(null);
  const timer = useRef(null);
  const [state, setState] = useState('idle'); // idle | working | ready | error
  const [copyState, setCopyState] = useState('idle'); // idle | copied | failed

  useEffect(() => () => clearTimeout(timer.current), []);
  // Другой игрок — картинка прежнего больше не показывается
  useEffect(() => { setState('idle'); setCopyState('idle'); }, [accountId]);

  const make = async () => {
    setState('working');
    setCopyState('idle');
    try {
      const model = buildShareModel({ accountId, steam, rank, history, heroStats, heroes, ranks }, t, language);
      const [avatar, badge, ...heroImages] = await Promise.all([
        loadImage(model.avatarUrl),
        loadImage(model.badge?.image),
        ...model.heroes.map((hero) => loadImage(hero.icon)),
      ]);
      await drawShareCard(canvasRef.current, model, { avatar, badge, heroes: heroImages });
      setState('ready');
    } catch {
      setState('error');
    }
  };

  const download = async () => {
    const blob = await canvasToBlob(canvasRef.current);
    if (blob) downloadBlob(blob, cardFileName(steam?.name, accountId));
    else setState('error');
  };

  const copy = async () => {
    let ok = false;
    try {
      const blob = await canvasToBlob(canvasRef.current);
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        ok = true;
      }
    } catch {
      ok = false;
    }
    setCopyState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState('idle'), 2500);
  };

  return (
    <section id="share" className="section player-section" aria-labelledby="share-title">
      <h2 className="section__title" id="share-title">{t('player.shareCard.title')}</h2>
      <p className="player-section__lead">{t('player.shareCard.lead')}</p>

      <div className="share-actions">
        <button type="button" className="btn btn-primary" onClick={make} disabled={state === 'working'}>
          {state === 'working' ? t('player.shareCard.working') : state === 'ready' ? t('player.shareCard.remake') : t('player.shareCard.make')}
        </button>
        {state === 'ready' && (
          <>
            <button type="button" className="btn btn-secondary" onClick={download}>{t('player.shareCard.download')}</button>
            {canCopyImage() && (
              <button type="button" className="btn btn-secondary" onClick={copy}>
                {copyState === 'copied' ? `✓ ${t('player.shareCard.copied')}` : t('player.shareCard.copy')}
              </button>
            )}
          </>
        )}
      </div>
      {state === 'error' && <p className="share-error" role="alert">{t('player.shareCard.error')}</p>}
      {copyState === 'failed' && <p className="share-error" role="alert">{t('player.shareCard.copyFailed')}</p>}

      {/* Холст всегда в разметке (рисуем в него по кнопке), но показывается только готовым */}
      <canvas
        ref={canvasRef}
        className="share-canvas"
        hidden={state !== 'ready'}
        role="img"
        aria-label={t('player.shareCard.alt', { name })}
      />
    </section>
  );
}

export default PlayerShare;
