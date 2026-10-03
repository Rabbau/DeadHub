import { useCallback, useEffect, useRef, useState } from 'react';

/** Запасной способ копирования для браузеров без Clipboard API (или когда он запрещён страницей-рамкой). */
function legacyCopy(text) {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Копирование текста в буфер обмена с подтверждением: состояние 'idle' → 'copied' (или 'failed'), через
 * `resetMs` снова 'idle'. Работает по щелчку посетителя (так требуют браузеры).
 * @param {number} [resetMs]
 * @returns {['idle'|'copied'|'failed', (text: string) => Promise<boolean>]}
 */
export function useCopy(resetMs = 2000) {
  const [state, setState] = useState('idle');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = legacyCopy(text);
    }
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), resetMs);
    return ok;
  }, [resetMs]);

  return [state, copy];
}
