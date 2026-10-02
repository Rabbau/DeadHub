/**
 * @fileoverview Карта города: разбор ответа API, список слоёв, пресеты и тепловая карта.
 * Не знает ни про React, ни про fetch.
 *
 * Все координаты относительные (0..1): x — слева направо, y — сверху вниз, как на миникарте.
 */

const FALLBACK_RADIUS = 10752; // половина стороны карты в мировых единицах
export const HEAT_CELL = 128;  // сторона клетки растра в kill-death-stats, мировых единиц

const round4 = (n) => Math.round(n * 10000) / 10000;
const round1 = (n) => Math.round(n * 10) / 10;
const isNum = Number.isFinite;

// ── Слои ──────────────────────────────────────────────────────────

/**
 * Слои карты в порядке показа. kind: pin — крупный маркер, dot — мелкая точка,
 * line — линии, image — картинка поверх карты, heat — тепловая карта.
 * color — цвет маркера и его образца в списке слоёв; isNew — появилось или изменилось в текущем
 * обновлении; hint — у слоя есть пояснение механики (map.layers.<id>.hint в локалях).
 */
export const LAYERS = [
  { id: 'objectives', group: 'structures', kind: 'pin', color: 'var(--amber)' },
  { id: 'sentries', group: 'structures', kind: 'dot', color: 'var(--red)' },
  { id: 'shops', group: 'structures', kind: 'pin', color: '#f3f4ed' },

  { id: 'camp_weak', group: 'camps', kind: 'pin', color: '#b6bccf' },
  { id: 'camp_medium', group: 'camps', kind: 'pin', color: 'var(--acid)' },
  { id: 'camp_strong', group: 'camps', kind: 'pin', color: 'var(--red)' },
  { id: 'camp_vault', group: 'camps', kind: 'pin', color: '#b48cff' },
  { id: 'landmarks', group: 'camps', kind: 'pin', color: 'var(--sky)', isNew: true },

  { id: 'urns', group: 'interactables', kind: 'pin', color: '#ffd84a' },
  { id: 'bells', group: 'interactables', kind: 'pin', color: 'var(--sky)', isNew: true, hint: true },
  { id: 'statues', group: 'interactables', kind: 'dot', color: '#e8b85a', isNew: true, hint: true },
  { id: 'tough_crates', group: 'interactables', kind: 'dot', color: 'var(--red)', isNew: true, hint: true },
  { id: 'crates', group: 'interactables', kind: 'dot', color: '#8e8a7c' },
  { id: 'snacks', group: 'interactables', kind: 'dot', color: '#7be07b', isNew: true, hint: true },
  { id: 'bridge_buffs', group: 'interactables', kind: 'pin', color: 'var(--acid)' },

  { id: 'ziplines', group: 'movement', kind: 'line', color: '#29b1cc' },
  { id: 'bounce_pads', group: 'movement', kind: 'dot', color: '#7be07b', hint: true },
  { id: 'teleporters', group: 'movement', kind: 'pin', color: 'var(--violet)', hint: true },
  { id: 'ropes', group: 'movement', kind: 'dot', color: '#c9b79a' },
  { id: 'vents', group: 'movement', kind: 'dot', color: 'var(--sky)', isNew: true, hint: true },
  { id: 'veils', group: 'movement', kind: 'dot', color: 'var(--violet)' },
  { id: 'rifts', group: 'movement', kind: 'pin', color: 'var(--violet)' },

  { id: 'tunnels_mid', group: 'underground', kind: 'image', color: '#9bd8c4' },
  { id: 'tunnels_rat', group: 'underground', kind: 'image', color: '#d8b49b' },

  { id: 'heat', group: 'analytics', kind: 'heat', color: 'var(--red)' },
];

export const LAYER_GROUPS = ['structures', 'camps', 'interactables', 'movement', 'underground', 'analytics'];

export const LAYER_IDS = LAYERS.map((layer) => layer.id);

/** Виды магазинов, о которых знают локали. */
export const SHOP_KINDS = ['lane', 'secret', 'base'];

export const DEFAULT_PRESET = 'overview';

/** Готовые наборы слоёв. Список слоёв хранится в порядке LAYERS. */
export const PRESETS = [
  { id: 'overview', layers: ['objectives', 'shops', 'camp_weak', 'camp_medium', 'camp_strong', 'camp_vault', 'landmarks', 'urns', 'ziplines'] },
  { id: 'farm', layers: ['camp_weak', 'camp_medium', 'camp_strong', 'camp_vault', 'landmarks', 'urns', 'bells', 'tough_crates'] },
  { id: 'loot', layers: ['urns', 'bells', 'statues', 'tough_crates', 'crates', 'snacks', 'bridge_buffs'] },
  { id: 'movement', layers: ['ziplines', 'bounce_pads', 'teleporters', 'ropes', 'vents', 'veils', 'rifts'] },
  { id: 'new', layers: ['landmarks', 'bells', 'statues', 'tough_crates', 'snacks', 'vents'] },
  { id: 'fights', layers: ['objectives', 'heat'] },
  { id: 'clear', layers: [] },
];

/** Слои в каноническом порядке, только известные и без повторов. */
export function normalizeLayers(ids) {
  const wanted = new Set(Array.isArray(ids) ? ids : []);
  return LAYER_IDS.filter((id) => wanted.has(id));
}

/**
 * Слои из адреса страницы: `?layers=a,b` — свой набор, `?preset=new` — готовый, без параметров —
 * обзор. Пустой `?layers=` означает «ничего не показывать».
 * @param {URLSearchParams} params
 */
export function layersFromSearch(params) {
  const list = params.get('layers');
  if (list !== null) return normalizeLayers(list.split(','));
  const preset = PRESETS.find((p) => p.id === params.get('preset')) ?? PRESETS.find((p) => p.id === DEFAULT_PRESET);
  return normalizeLayers(preset.layers);
}

/** Обратное преобразование: набор слоёв → параметры адреса (готовый набор записывается именем). */
export function searchForLayers(ids) {
  const layers = normalizeLayers(ids);
  const key = layers.join(',');
  const preset = PRESETS.find((p) => normalizeLayers(p.layers).join(',') === key);
  if (preset) return preset.id === DEFAULT_PRESET ? {} : { preset: preset.id };
  return { layers: key };
}

/** Какой готовый набор сейчас включён (для подсветки кнопки), либо null. */
export function activePreset(ids) {
  const key = normalizeLayers(ids).join(',');
  return PRESETS.find((p) => normalizeLayers(p.layers).join(',') === key)?.id ?? null;
}

// ── Разбор ответа /v1/assets/map ──────────────────────────────────

/** Достопримечательности обновления по внутренним названиям лагерей. */
const LANDMARKS = { chinatown_bell_1: 'bellTower', plaza_pit_vault1: 'sunkenPlaza', plaza_pit_vault2: 'sunkenPlaza' };

export function landmarkOf(camp) {
  return LANDMARKS[camp?.id] ?? null;
}

const OBJECTIVE_TYPES = { tier1: 'guardian', tier2: 'walker', titan: 'patron' };
// Номера линий в ключах объектов (team0_tier1_3) идут слева направо: 1, 3, 4
const LANE_BY_NUMBER = { 1: 'left', 3: 'center', 4: 'right' };

/**
 * Координаты объектов в ответе API смещены относительно миникарты: центр симметрии объектов лежит
 * в (0.45, 0.45), а не в (0.5, 0.5). Возвращаем объекты на место по их же симметрии — если API
 * поправит смещение, поправка станет нулевой сама.
 */
function recenter(objectives) {
  if (!objectives.length) return objectives;
  const mean = (key) => objectives.reduce((sum, o) => sum + o[key], 0) / objectives.length;
  const dx = 0.5 - mean('x');
  const dy = 0.5 - mean('y');
  // Больше нескольких процентов — это уже не знакомое смещение, а чужие данные: не трогаем
  if (Math.abs(dx) > 0.08 || Math.abs(dy) > 0.08) return objectives;
  return objectives.map((o) => ({ ...o, x: round4(o.x + dx), y: round4(o.y + dy) }));
}

function parseObjectives(positions) {
  const result = [];
  Object.entries(positions && typeof positions === 'object' ? positions : {}).forEach(([key, value]) => {
    // team0_core и прочее неизвестное пропускаем: расположение «ядра» не совпадает с симметрией карты
    const match = /^team(\d)_(tier1|tier2|titan)(?:_(\d))?$/.exec(key);
    if (!match || !isNum(value?.left_relative) || !isNum(value?.top_relative)) return;
    result.push({
      id: key,
      team: Number(match[1]),
      type: OBJECTIVE_TYPES[match[2]],
      lane: LANE_BY_NUMBER[match[3]] ?? null,
      x: round4(value.left_relative),
      y: round4(value.top_relative),
    });
  });
  return recenter(result);
}

/**
 * Зиплайн — кубический сплайн: P0 — узлы (смещения от origin), P1 и P2 — входящая и исходящая
 * касательные в каждом узле, заданные векторами от узла. Возвращаем путь SVG в координатах 1000×1000.
 * @returns {{ d: string, meanX: number }|null}
 */
function zipline(raw, radius) {
  const { origin, P0_points: nodes, P1_points: tin, P2_points: tout } = raw ?? {};
  if (!Array.isArray(origin) || !Array.isArray(nodes) || nodes.length < 2) return null;

  const k = 1000 / (2 * radius);
  const px = (x) => (x + radius) * k;
  const py = (y) => (radius - y) * k;
  const node = (i) => [origin[0] + nodes[i][0], origin[1] + nodes[i][1]];
  const vec = (list, i) => (Array.isArray(list) && Array.isArray(list[i]) ? list[i] : [0, 0]);
  const pt = ([x, y]) => `${round1(px(x))} ${round1(py(y))}`;

  let d = `M${pt(node(0))}`;
  let sumX = px(node(0)[0]);
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = node(i);
    const b = node(i + 1);
    const out = vec(tout, i);
    const inn = vec(tin, i + 1);
    d += `C${pt([a[0] + out[0], a[1] + out[1]])} ${pt([b[0] + inn[0], b[1] + inn[1]])} ${pt(b)}`;
    sumX += px(b[0]);
  }
  return { d, meanX: sumX / nodes.length / 1000 };
}

function laneOfZipline(meanX) {
  if (meanX < 0.4) return 'left';
  if (meanX > 0.6) return 'right';
  return 'center';
}

/**
 * Облегчённая карта для кеша и отрисовки: всё в относительных координатах, слои под ключами
 * из LAYERS. Группы, которых нет в ответе (старые версии клиента), остаются пустыми.
 * @param {any} raw ответ /v1/assets/map
 */
export function slimMap(raw) {
  const radius = Number(raw?.radius) > 0 ? Number(raw.radius) : FALLBACK_RADIUS;
  const toRel = (x, y) => [round4((x + radius) / (2 * radius)), round4((radius - y) / (2 * radius))];
  const hasXY = (list) => Array.isArray(list) && isNum(list[0]) && isNum(list[1]);

  // Готовые left/top из API, иначе считаем по мировым координатам
  const pointOf = (e) => {
    if (isNum(e?.left_relative) && isNum(e?.top_relative)) return [round4(e.left_relative), round4(e.top_relative)];
    return hasXY(e?.position) ? toRel(e.position[0], e.position[1]) : null;
  };

  /** Список сущностей → точки; extra дописывает поля сущности. */
  const points = (rows, extra) => (Array.isArray(rows) ? rows : [])
    .map((e) => {
      const p = pointOf(e);
      return p ? { x: p[0], y: p[1], ...(extra ? extra(e) : null) } : null;
    })
    .filter(Boolean);

  const withTarget = (e) => {
    if (!hasXY(e?.target)) return null;
    const [tx, ty] = toRel(e.target[0], e.target[1]);
    return { tx, ty };
  };
  const withTeam = (e) => (e?.team === 0 || e?.team === 1 ? { team: e.team } : null);

  const entities = raw?.entities && typeof raw.entities === 'object' ? raw.entities : {};

  // Достопримечательности обновления — тоже хранилища, но на карте они отдельным слоем
  const camps = { weak: [], medium: [], strong: [], vault: [], landmarks: [] };
  (Array.isArray(raw?.neutral_camps) ? raw.neutral_camps : []).forEach((camp) => {
    const p = pointOf(camp);
    if (!p || !camps[camp.kind]) return;
    const id = String(camp.name || '');
    const landmark = landmarkOf({ id });
    if (landmark) camps.landmarks.push({ id, landmark, x: p[0], y: p[1] });
    else camps[camp.kind].push({ id, x: p[0], y: p[1] });
  });

  const ziplines = (Array.isArray(raw?.zipline_paths) ? raw.zipline_paths : [])
    .map((z, index) => {
      const geometry = zipline(z, radius);
      return geometry
        ? { id: index, color: String(z.color || '#29b1cc'), lane: laneOfZipline(geometry.meanX), d: geometry.d }
        : null;
    })
    .filter(Boolean);

  const images = raw?.images && typeof raw.images === 'object' ? raw.images : {};

  return {
    radius,
    images: {
      base: images.minimap || images.plain || images.mid || null,
      tunnelsMid: images.mid_tunnels || null,
      tunnelsRat: images.rat_tunnels || null,
    },
    ziplines,
    layers: {
      objectives: parseObjectives(raw?.objective_positions),
      sentries: points(entities.base_sentries, withTeam),
      shops: points(entities.shops, (e) => ({ kind: String(e.kind || 'lane'), ...withTeam(e) })),
      camp_weak: camps.weak,
      camp_medium: camps.medium,
      camp_strong: camps.strong,
      camp_vault: camps.vault,
      landmarks: camps.landmarks,
      urns: [
        ...points(entities.soul_urn_spawns, () => ({ kind: 'spawn' })),
        ...points(entities.soul_urn_pads, () => ({ kind: 'pad' })),
      ],
      bells: points(entities.bells),
      statues: points(entities.golden_statues),
      tough_crates: points(entities.tough_crates),
      crates: points(entities.crates),
      snacks: points(entities.healing_snacks),
      bridge_buffs: points(entities.bridge_buffs),
      bounce_pads: points(entities.bounce_pads, withTarget),
      teleporters: points(entities.teleporters, withTarget),
      ropes: points(entities.climb_ropes),
      vents: points(entities.steam_vents),
      veils: points(entities.cosmic_veils),
      rifts: points(entities.unstable_rifts),
    },
  };
}

/** Цвета линий: слева направо по положению зиплайна. */
export function laneColors(map) {
  const colors = {};
  (map?.ziplines ?? []).forEach((line) => { colors[line.lane] = line.color; });
  return colors;
}

/** Известные цвета линий → привычные игрокам названия («жёлтая», «синяя», «зелёная»). */
const LANE_COLOR_NAMES = { '#f1cc30': 'yellow', '#29b1cc': 'blue', '#59b247': 'green' };

export function laneColorName(color) {
  return LANE_COLOR_NAMES[String(color || '').toLowerCase()] ?? null;
}

// ── Тепловая карта убийств и смертей ──────────────────────────────

/** Окна игрового времени для тепловой карты: [от, до) в секундах, null — без границы. */
export const HEAT_PHASES = {
  all: { min: null, max: null },
  early: { min: null, max: 600 },
  mid: { min: 600, max: 1500 },
  late: { min: 1500, max: null },
};

/**
 * Ответ kill-death-stats — это 29 тысяч строк (2,3 МБ): клетка растра 128×128 мировых единиц
 * по каждой из двух команд. Складываем команды и оставляем плоский массив
 * [столбец, строка, смерти, убийства, …] — так в кеш уходит около 200 КБ.
 * @param {any[]} rows
 * @param {number} [radius]
 * @returns {{ size: number, cells: number[], deaths: number, kills: number }} deaths и kills — итоги по всей карте
 */
export function slimHeat(rows, radius = FALLBACK_RADIUS) {
  const size = Math.round((2 * radius) / HEAT_CELL);
  const acc = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!isNum(row?.position_x) || !isNum(row?.position_y)) return;
    // Клетка занимает [y, y + 128), поэтому строку считаем по её верхней кромке
    const col = Math.floor((row.position_x + radius) / HEAT_CELL);
    const line = Math.floor((radius - row.position_y) / HEAT_CELL) - 1;
    if (col < 0 || col >= size || line < 0 || line >= size) return;
    const key = line * size + col;
    const cell = acc.get(key) ?? [0, 0];
    cell[0] += Number(row.deaths) || 0;
    cell[1] += Number(row.kills) || 0;
    acc.set(key, cell);
  });

  const cells = [];
  let deaths = 0;
  let kills = 0;
  acc.forEach(([cellDeaths, cellKills], key) => {
    deaths += cellDeaths;
    kills += cellKills;
    if (cellDeaths + cellKills >= 2) cells.push(key % size, Math.floor(key / size), cellDeaths, cellKills);
  });
  return { size, cells, deaths, kills };
}

/**
 * Верхняя граница шкалы: 99-й перцентиль, чтобы одна клетка в центре карты
 * (где решаются бои за босса) не «выжигала» всю остальную карту.
 * @param {{ cells: number[] }} heat
 * @param {'deaths'|'kills'} metric
 */
export function heatMax(heat, metric) {
  const offset = metric === 'kills' ? 3 : 2;
  const values = [];
  for (let i = 0; i < heat.cells.length; i += 4) values.push(heat.cells[i + offset]);
  if (!values.length) return 1;
  values.sort((a, b) => a - b);
  return Math.max(1, values[Math.floor(0.99 * (values.length - 1))]);
}

/** Яркость клетки 0..1 (корень сглаживает разброс: средние клетки остаются видны). */
export function heatLevel(value, max) {
  return Math.min(1, Math.sqrt(Math.max(0, value) / max));
}

/** Цвет клетки по яркости: холодный синий → кислотный → янтарный → красный; прозрачность растёт вместе с ней. */
export function heatColor(level) {
  const stops = [
    [0, [97, 173, 255, 0]],
    [0.25, [97, 173, 255, 90]],
    [0.5, [189, 255, 50, 150]],
    [0.75, [255, 181, 49, 190]],
    [1, [255, 75, 120, 225]],
  ];
  const t = Math.min(1, Math.max(0, level));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (t - t0) / (t1 - t0);
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * f));
    }
  }
  return stops[stops.length - 1][1];
}
