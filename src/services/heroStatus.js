/**
 * @fileoverview Вышел герой или нет: правила по флагам каталога героев и по матчам. Без React и без запросов.
 *
 * Флаги `/v1/assets/heroes` меняются вместе со сборкой игры и врут в обе стороны. Реальный случай: Буся (id 88)
 * вышла 9 октября 2026, у неё сотни тысяч матчей и `player_selectable: true`, а флаг `in_development` в данных
 * остался `true` — по нему сайт считал героя заготовкой и неделю показывал «скоро». Поэтому порядок такой:
 * отключённый герой — всегда скрыт; реальные матчи — вышел; «в разработке» скрывает героя только пока его
 * нельзя выбрать в игре.
 */

/**
 * Статус героя: `released` — играют все; `upcoming` — новый герой из голосования (`prerelease_only`), ещё не вышел;
 * `hidden` — заготовки в разработке и отключённые герои (страницы у них нет).
 * @param {{ disabled?: boolean, in_development?: boolean, prerelease_only?: boolean, player_selectable?: boolean }} flags
 * @param {number} [games] матчи героя в выбранном периоде (0, если статистики нет)
 * @returns {'released'|'upcoming'|'hidden'}
 */
export function heroStatus(flags, games = 0) {
  if (flags.disabled === true) return 'hidden';
  if (games > 0) return 'released';
  if (flags.in_development === true && flags.player_selectable !== true) return 'hidden';
  if (flags.prerelease_only === true) return 'upcoming';
  return flags.player_selectable === true ? 'released' : 'hidden';
}

/**
 * Есть ли у героя страница на сайте, когда матчей под рукой нет (поиск, пререндер): не отключён, и «в разработке»
 * считается заготовкой только пока героя нельзя выбрать в игре.
 * @param {{ disabled?: boolean, in_development?: boolean, player_selectable?: boolean }} flags
 */
export function isListedHero(flags) {
  return flags.disabled !== true && (flags.in_development !== true || flags.player_selectable === true);
}
