/**
 * @fileoverview Форматирование чисел и дат с учётом языка интерфейса. Без React и без API.
 */

/** Язык интерфейса → локаль для Intl. */
export function localeFor(language) {
  return language === 'russian' ? 'ru-RU' : 'en-US';
}

/** 1 340 353 → «1,3 млн» / «1.3M». */
export function formatCompact(value, language) {
  return new Intl.NumberFormat(localeFor(language), { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** 17616 → «17 616» / «17,616». */
export function formatNumber(value, language) {
  return new Intl.NumberFormat(localeFor(language)).format(value);
}

/** Изменение доли в процентных пунктах: 0.0124 → «+1.2», −0.007 → «−0.7» (настоящий минус), ничтожное → «0.0». */
export function formatPoints(fraction, digits = 1) {
  if (fraction == null || Number.isNaN(fraction)) return '—';
  const text = Math.abs(fraction * 100).toFixed(digits);
  if (Number(text) === 0) return text;
  return `${fraction > 0 ? '+' : '−'}${text}`;
}

/** 2217 → «36:57». */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(s / 60);
  const seconds = String(s % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** «29 сент.» / «Sep 29». */
export function formatShortDate(unixSeconds, language) {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleDateString(localeFor(language), { day: 'numeric', month: 'short' });
}

/** «17 сент., 21:32» / «Sep 17, 9:32 PM». */
export function formatMatchDate(unixSeconds, language) {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleString(localeFor(language), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** «17 сент. 2026 г., 21:32» / «Sep 17, 2026, 9:32 PM» — для страницы, на которую приходят по ссылке и спустя время. */
export function formatFullDate(unixSeconds, language) {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleString(localeFor(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
