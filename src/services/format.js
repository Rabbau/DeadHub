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

/**
 * «3 дня назад» / «3 days ago»: до двух месяцев считаем в днях («вчера», «сегодня»), дальше — в месяцах.
 * @param {number} unixSeconds
 * @param {string} language
 * @param {number} [nowMs]
 */
export function formatAge(unixSeconds, language, nowMs = Date.now()) {
  const days = Math.max(0, Math.round((nowMs / 1000 - unixSeconds) / 86400));
  const rtf = new Intl.RelativeTimeFormat(localeFor(language), { numeric: 'auto' });
  return days < 60 ? rtf.format(-days, 'day') : rtf.format(-Math.round(days / 30), 'month');
}

/**
 * «12 мин. назад» / «12 min. ago»: до часа считаем в минутах, до суток — в часах, дальше как formatAge («вчера», «3 дня назад»).
 * В отличие от formatAge принимает миллисекунды: так хранятся метки времени, которые ставит сам сайт.
 * @param {number} timestampMs
 * @param {string} language
 * @param {number} [nowMs]
 */
export function formatAgo(timestampMs, language, nowMs = Date.now()) {
  const seconds = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  const rtf = new Intl.RelativeTimeFormat(localeFor(language), { numeric: 'auto', style: 'short' });
  if (seconds < 60) return rtf.format(0, 'second');
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
  return formatAge(timestampMs / 1000, language, nowMs);
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
