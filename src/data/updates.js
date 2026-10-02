/**
 * @fileoverview Редакционные данные о текущем крупном обновлении игры.
 * Единственное место, которое нужно править вручную, когда выходит следующее большое обновление.
 * Всё остальное (последний патч, статус героев, карта) сайт берёт из API сам.
 */

/**
 * Официальная страница обновления. Корень сайта Valve сам перенаправляет на страницу последнего
 * обновления, поэтому ссылка всегда актуальна. Встроить страницу в iframe нельзя: сервер Valve
 * отдаёт X-Frame-Options: SAMEORIGIN.
 */
export const OFFICIAL_UPDATE_URL = 'https://www.playdeadlock.com';

export const CURRENT_UPDATE = {
  name: 'City Never Sleeps',
  date: '2026-09-29',

  // Герои из голосования этого обновления. Вышел герой или ещё нет — определяют флаги из API.
  heroIds: [78, 84, 85, 86, 87, 88],

  // Анонс Valve: «Two heroes release a week on Tuesdays and Fridays @ 2:00pm PT»,
  // первый релиз — 2 октября. weekdays: 0 — воскресенье … 6 — суббота (по времени timeZone).
  releases: { timeZone: 'America/Los_Angeles', weekdays: [2, 5], hour: 14, first: '2026-10-02' },

  // Карточки «что нового»; тексты лежат в локалях (update.highlights.<key>), `to` — раздел сайта.
  highlights: [
    { key: 'heroes', to: '/heroes' },
    { key: 'map', to: '/map' },
    { key: 'broker', to: '/items?corruptible=1' },
    { key: 'objectives', to: '/map?preset=new' },
    { key: 'shop' },
    { key: 'hud' },
    { key: 'tools' },
  ],

  // Сколько дней после выхода показывать блок «что нового»
  highlightsDays: 90,
};

/** Показывать ли блок «что нового»: пока обновление не устарело. */
export function isHighlightsActive(nowMs = Date.now(), update = CURRENT_UPDATE) {
  const releasedAt = Date.parse(`${update.date}T00:00:00Z`);
  return Number.isFinite(releasedAt) && nowMs - releasedAt < update.highlightsDays * 24 * 60 * 60 * 1000;
}
