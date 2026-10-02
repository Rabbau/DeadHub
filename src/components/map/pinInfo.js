import { LAYERS, SHOP_KINDS, laneColorName } from '../../services/mapService.js';

const LAYER_BY_ID = Object.fromEntries(LAYERS.map((layer) => [layer.id, layer]));

/** Цвет маркера: у построек и турелей — цвет команды, у остальных — цвет слоя. */
const TEAM_COLORS = ['var(--amber)', 'var(--sky)'];

export function pinColor(layer, item) {
  if ((layer.id === 'objectives' || layer.id === 'sentries') && TEAM_COLORS[item.team]) return TEAM_COLORS[item.team];
  return layer.color;
}

/** Классы маркера: слой и особенности конкретного объекта (тип постройки, вид магазина, команда). */
export function pinClass(layer, item, selected) {
  const parts = ['map-pin', `map-pin--${layer.id}`];
  if (layer.kind === 'dot') parts.push('map-pin--dot');
  if (item.type) parts.push(`map-pin--${item.type}`);
  if (item.kind && (layer.id === 'shops' || layer.id === 'urns')) parts.push(`map-pin--${item.kind}`);
  if (selected) parts.push('is-selected');
  return parts.join(' ');
}

/**
 * Подпись маркера для подсказки и карточки.
 * @param {string} layerId
 * @param {any} item точка слоя из map.layers
 * @param {(key: string, params?: object) => string} t
 * @param {Record<string, string>} laneColors цвета линий по положению (left/center/right)
 * @returns {{ title: string, meta: string[], hint: string|null, isNew: boolean }}
 */
export function describePin(layerId, item, t, laneColors = {}) {
  const layer = LAYER_BY_ID[layerId];
  const side = (team) => (team === 0 || team === 1 ? t(`map.side.${team}`) : null);
  // Линию называем по цвету, как её знают игроки; неизвестный цвет — по положению
  const lane = (position) => (position ? t(`map.lane.${laneColorName(laneColors[position]) ?? position}`) : null);

  let title = t(`map.layers.${layerId}.name`);
  let meta = [];
  let hint = layer?.hint ? t(`map.layers.${layerId}.hint`) : null;

  switch (layerId) {
    case 'objectives':
      title = t(`map.objective.${item.type}`);
      meta = [lane(item.lane), side(item.team)];
      break;
    case 'sentries':
      meta = [side(item.team)];
      break;
    case 'shops':
      if (SHOP_KINDS.includes(item.kind)) title = t(`map.shopKind.${item.kind}`);
      meta = [side(item.team)];
      break;
    case 'urns':
      title = t(`map.urnKind.${item.kind}`);
      break;
    case 'landmarks':
      title = t(`map.landmark.${item.landmark}.name`);
      meta = [t('map.layers.camp_vault.name')];
      hint = t(`map.landmark.${item.landmark}.hint`);
      break;
    default:
      break;
  }

  return { title, meta: meta.filter(Boolean), hint, isNew: Boolean(layer?.isNew) };
}
