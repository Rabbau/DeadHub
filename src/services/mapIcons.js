/**
 * @fileoverview Значки маркеров карты. Основа — официальные иконки миникарты из самой игры: их отдаёт
 * хранилище картинок API (то же, что и картинки героев и предметов). Для слоёв, у которых иконки на миникарте
 * нет, — собственные белые значки: они вшиты в код как data-URI и запросов не делают.
 *
 * `fit` — размер значка внутри круглого маркера в процентах: у официальных PNG много прозрачных полей
 * (лагерь занимает треть холста 64×64), поэтому их приходится увеличивать, чтобы значок читался.
 * Не знает ни про React, ни про canvas.
 */

const ICONS_BASE = 'https://assets-bucket.deadlock-api.com/assets-api-res/icons';

const game = (file, fit) => ({ src: `${ICONS_BASE}/${file}`, fit });

// Явные width/height нужны canvas: без них размер значка при drawImage берётся «по умолчанию»
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;
const own = (body, fit = 66) => ({ src: `data:image/svg+xml,${encodeURIComponent(wrap(body))}`, fit });
const line = (paths) => `<g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">${paths}</g>`;

/** Собственные значки (сетка 24×24, белые). */
const OWN = {
  bell: own('<path fill="#fff" d="M12 2.6a1.3 1.3 0 0 1 1.3 1.3v.5a6.4 6.4 0 0 1 5.1 6.3v3.9l1.7 2.5c.5.7 0 1.6-.8 1.6H4.7c-.8 0-1.3-.9-.8-1.6l1.7-2.5v-3.9a6.4 6.4 0 0 1 5.1-6.3v-.5A1.3 1.3 0 0 1 12 2.6Z"/><path fill="#fff" d="M9.6 19.6h4.8a2.4 2.4 0 0 1-4.8 0Z"/>'),
  patron: own('<path fill="#fff" d="m2.8 7.6 4.8 3.8L12 4.4l4.4 7 4.8-3.8-1.9 11H4.7Z"/>', 70),
  turret: own(`${line('<circle cx="12" cy="12" r="5.6"/><path d="M12 2.6v4.2M12 17.2v4.2M2.6 12h4.2M17.2 12h4.2"/>')}<circle cx="12" cy="12" r="1.6" fill="#fff"/>`),
  bolt: own('<path fill="#fff" d="M13.6 2 5.5 13.4h5L9.4 22l9.1-12.1h-5.2Z"/>'),
  bounce: own('<path fill="#fff" d="M12 3.6 19.4 11l-2 2L12 7.6 6.6 13l-2-2Z"/><path fill="#fff" d="m12 11.4 7.4 7.4-2 2-5.4-5.4-5.4 5.4-2-2Z"/>'),
  rope: own(line('<path d="M8 3v18M16 3v18M8 7.5h8M8 12h8M8 16.5h8"/>')),
  vent: own(line('<path d="M7 19.5h10"/><path d="M8.5 16c-1.8-2 1.8-3.4 0-5.4s1.8-3.4 0-5.4"/><path d="M12 16c-1.8-2 1.8-3.4 0-5.4s1.8-3.4 0-5.4"/><path d="M15.5 16c-1.8-2 1.8-3.4 0-5.4s1.8-3.4 0-5.4"/>')),
  veil: own('<path fill="#fff" d="M12 2.8 18.6 12 12 21.2 5.4 12Z"/><path fill="#0b0a09" d="M12 7.4 15.2 12 12 16.6 8.8 12Z"/>', 70),
  rift: own(`${line('<path d="M12 3.6a8.4 8.4 0 1 0 8.4 8.4"/><path d="M12 8a4 4 0 1 0 4 4"/>')}<circle cx="12" cy="12" r="1.7" fill="#fff"/>`),
};

const OBJECTIVE_ICONS = {
  guardian: game('minimap/objective_icon_t1.svg', 72),
  walker: game('minimap/objective_icon_t2.svg', 72),
  patron: OWN.patron,
};

const URN_ICONS = {
  spawn: game('minimap/soul_jar_marker_psd.png', 92),
  pad: game('minimap/soul_jar_marker_return_psd.png', 130),
};

const CRATE = game('minimap/item_crate_spawn_psd.png', 74);

/** Значок слоя целиком; у слоёв с несколькими видами значков (цели, урны) — см. iconOf. */
const BY_LAYER = {
  sentries: OWN.turret,
  shops: game('minimap/minimap_shop_psd.png', 80),
  camp_weak: game('minimap/neutral_small_psd.png', 170),
  camp_medium: game('minimap/neutral_medium_psd.png', 150),
  camp_strong: game('minimap/neutral_large_psd.png', 125),
  camp_vault: game('minimap/neutral_vault_psd.png', 160),
  landmarks: game('minimap/neutral_vault_psd.png', 160),
  bells: OWN.bell,
  statues: game('gold_crate_marker.png', 118),
  tough_crates: CRATE,
  crates: CRATE,
  snacks: game('minimap/health_pad_psd.png', 74),
  bridge_buffs: OWN.bolt,
  bounce_pads: OWN.bounce,
  teleporters: game('minimap/minimap_teleporter_highlight.svg', 78),
  ropes: OWN.rope,
  vents: OWN.vent,
  veils: OWN.veil,
  rifts: OWN.rift,
};

/**
 * Значок маркера: по слою и особенностям объекта.
 * @param {string} layerId
 * @param {{ type?: string, kind?: string }} [item]
 * @returns {{ src: string, fit: number }|null} null — у слоя нет значка (линии, картинки, тепловая карта)
 */
export function iconOf(layerId, item) {
  if (layerId === 'objectives') return OBJECTIVE_ICONS[item?.type] ?? null;
  if (layerId === 'urns') return URN_ICONS[item?.kind] ?? URN_ICONS.spawn;
  return BY_LAYER[layerId] ?? null;
}

/** Стиль DOM-маркера: значок и его размер приходят в CSS переменными (см. .map-pin--badge). */
export function iconStyle(icon) {
  return icon ? { '--icon': `url("${icon.src}")`, '--fit': `${icon.fit}%` } : {};
}

/** Все значки по одному разу — для предзагрузки на canvas и для тестов. */
export function allIcons() {
  const seen = new Map();
  [...Object.values(OBJECTIVE_ICONS), ...Object.values(URN_ICONS), ...Object.values(BY_LAYER)].forEach((icon) => {
    if (!seen.has(icon.src)) seen.set(icon.src, icon);
  });
  return [...seen.values()];
}
