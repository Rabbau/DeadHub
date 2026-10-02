/**
 * @fileoverview Расписание выхода героев из голосования. Valve: «Two heroes release a week on
 * Tuesdays and Fridays @ 2:00pm PT». Считаем ближайший релиз по этому правилу, не зная заранее,
 * какой герой выйдет (порядок решает голосование). Без React и без API.
 */

const MINUTE_MS = 60 * 1000;

/** Дата и время «на стенных часах» часового пояса в момент utcMs. */
function zonedParts(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Смещение часового пояса от UTC (в минутах) в момент utcMs; для Лос-Анджелеса −420 летом и −480 зимой. */
function zoneOffsetMinutes(utcMs, timeZone) {
  const p = zonedParts(utcMs, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((wallAsUtc - utcMs) / MINUTE_MS);
}

/**
 * Момент в UTC (мс), когда стенные часы часового пояса показывают указанные дату и час.
 * Смещение уточняется вторым проходом, поэтому дни перехода на летнее время считаются верно.
 * @param {{ year: number, month: number, day: number, hour: number }} wall
 * @param {string} timeZone
 */
export function zonedTimeToUtc({ year, month, day, hour }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour);
  const firstPass = guess - zoneOffsetMinutes(guess, timeZone) * MINUTE_MS;
  return guess - zoneOffsetMinutes(firstPass, timeZone) * MINUTE_MS;
}

/**
 * Ближайший релиз строго после nowMs или null.
 * @param {{ timeZone: string, weekdays: number[], hour: number, first: string }} schedule
 *   weekdays: 0 — воскресенье … 6 — суббота (по календарю timeZone), first — дата первого релиза YYYY-MM-DD
 * @param {number} [nowMs]
 * @returns {number|null} UTC-время в миллисекундах
 */
export function nextRelease(schedule, nowMs = Date.now()) {
  const { timeZone, weekdays, hour, first } = schedule;
  const firstDay = Date.parse(`${first}T00:00:00Z`);
  const today = zonedParts(nowMs, timeZone);

  // Перебираем календарные дни по часовому поясу расписания; через 3 недели повтор бессмыслен
  for (let offset = 0; offset < 21; offset++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (day.getTime() < firstDay || !weekdays.includes(day.getUTCDay())) continue;
    const at = zonedTimeToUtc(
      { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour },
      timeZone,
    );
    if (at > nowMs) return at;
  }
  return null;
}

/**
 * Последний релиз по расписанию не позже nowMs (или null, если до первого релиза ещё далеко).
 * Зеркало nextRelease: идёт по календарным дням назад.
 * @param {{ timeZone: string, weekdays: number[], hour: number, first: string }} schedule
 * @param {number} [nowMs]
 * @returns {number|null}
 */
export function previousRelease(schedule, nowMs = Date.now()) {
  const { timeZone, weekdays, hour, first } = schedule;
  const firstDay = Date.parse(`${first}T00:00:00Z`);
  const today = zonedParts(nowMs, timeZone);

  for (let offset = 0; offset < 21; offset++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day - offset));
    if (day.getTime() < firstDay) return null; // раньше первого релиза ничего не было
    if (!weekdays.includes(day.getUTCDay())) continue;
    const at = zonedTimeToUtc(
      { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour },
      timeZone,
    );
    if (at <= nowMs) return at;
  }
  return null;
}

/**
 * «Окно релиза»: вот-вот по расписанию выходит герой или он вышел только что. Только в эти минуты имеет
 * смысл часто проверять, не появился ли герой в данных API: каждая проверка — запрос к бесплатному
 * API с лимитом, поэтому в остальное время сайт их не делает.
 * @param {{ timeZone: string, weekdays: number[], hour: number, first: string }} schedule
 * @param {number} [nowMs]
 * @param {{ beforeMs?: number, afterMs?: number }} [window] за сколько до релиза и как долго после него
 */
export function isReleaseWindow(schedule, nowMs = Date.now(), { beforeMs = 2 * MINUTE_MS, afterMs = 45 * MINUTE_MS } = {}) {
  const next = nextRelease(schedule, nowMs);
  if (next != null && next - nowMs <= beforeMs) return true;
  const previous = previousRelease(schedule, nowMs);
  return previous != null && nowMs - previous <= afterMs;
}

/** Остаток времени в днях, часах и минутах (округляется вниз до минуты). */
export function splitDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / MINUTE_MS));
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}
