/**
 * @fileoverview Векторная трассировка растровой карты: «marching squares» по скалярному полю → замкнутые
 * контуры → упрощённый путь SVG. Не знает ни про React, ни про DOM и canvas: получает массив чисел.
 *
 * Зачем. Миникарта в API — картинка 1024×1024: при десятикратном приближении её пиксели превращаются в
 * кашу. Контур, вынутый из неё, — это ломаная, и она остаётся чёткой при любом масштабе. Картинка остаётся
 * единственным источником: с новой картой в игре контуры перестраиваются сами.
 *
 * Координаты контуров — в пикселях картинки; центр пикселя (x, y) лежит в (x + 0.5, y + 0.5), так что
 * контур ложится ровно на исходное изображение.
 */

// Рёбра клетки: 0 — верхнее, 1 — правое, 2 — нижнее, 3 — левое. Угол TL = 8, TR = 4, BR = 2, BL = 1.
const CORNER_BITS = [8, 4, 2, 1];

/**
 * Для каждого из 16 случаев — пары [откуда, куда] (номера рёбер) по правилу «выход → следующий вход при обходе
 * клетки по часовой стрелке»: так внутренняя область всегда остаётся справа от движения, а внешние контуры
 * получаются с положительной площадью, дыры — с отрицательной. Для седловых случаев (5 и 10) две схемы:
 * [0] — внутренние углы разделены (каждый отсекается своим отрезком), [1] — соединены (отсекаются внешние углы).
 */
const SEGMENTS = (() => {
  const table = [];
  for (let code = 0; code < 16; code += 1) {
    const inside = CORNER_BITS.map((bit) => (code & bit) !== 0);
    // Ребро e лежит между углами e и (e + 1) % 4, обход идёт TL → TR → BR → BL
    const crossings = [];
    for (let edge = 0; edge < 4; edge += 1) {
      const from = inside[edge];
      const to = inside[(edge + 1) % 4];
      if (from !== to) crossings.push({ edge, exit: from });
    }
    // Выход ведёт к предыдущему входу (отсекает свой внутренний угол) или к следующему (отсекает внешний угол)
    const pair = (separated) => {
      const result = [];
      crossings.forEach((c, i) => {
        if (!c.exit) return;
        const target = separated
          ? crossings[(i - 1 + crossings.length) % crossings.length]
          : crossings[(i + 1) % crossings.length];
        result.push([c.edge, target.edge]);
      });
      return result;
    };
    table.push(crossings.length === 4 ? [pair(true), pair(false)] : [pair(false)]);
  }
  return table;
})();

/**
 * Контуры уровня `level` скалярного поля: «внутри» — значения не меньше уровня.
 * Края картинки считаются «снаружи», поэтому все контуры замкнуты.
 * @param {ArrayLike<number>} field значения построчно, width × height штук
 * @param {number} width
 * @param {number} height
 * @param {number} level
 * @returns {Array<{ points: number[], area: number }>} points — [x0, y0, x1, y1, …]; area > 0 — внешний контур, < 0 — дыра
 */
export function traceContours(field, width, height, level) {
  const value = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : field[y * width + x]);
  const isIn = (x, y) => value(x, y) >= level;
  // Рёбра нумеруются по клетке-владельцу с запасом в одну клетку по краям: горизонтальное ребро H(x, y) идёт
  // от узла (x, y) к (x + 1, y), вертикальное V(x, y) — от (x, y) к (x, y + 1)
  const stride = width + 3;
  const idOf = (x, y, vertical) => (((y + 1) * stride + (x + 1)) << 1) | (vertical ? 1 : 0);

  /** Идентификатор ребра клетки (cx, cy) по номеру ребра. */
  const edgeId = (cx, cy, edge) => {
    if (edge === 0) return idOf(cx, cy, false);
    if (edge === 1) return idOf(cx + 1, cy, true);
    if (edge === 2) return idOf(cx, cy + 1, false);
    return idOf(cx, cy, true);
  };

  /** @type {Map<number, number>} ребро → ребро, к которому идёт контур */
  const next = new Map();
  for (let cy = -1; cy < height; cy += 1) {
    for (let cx = -1; cx < width; cx += 1) {
      const tl = isIn(cx, cy);
      const tr = isIn(cx + 1, cy);
      const br = isIn(cx + 1, cy + 1);
      const bl = isIn(cx, cy + 1);
      const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const schemes = SEGMENTS[code];
      let scheme = schemes[0];
      if (schemes.length === 2) {
        const centre = (value(cx, cy) + value(cx + 1, cy) + value(cx + 1, cy + 1) + value(cx, cy + 1)) / 4;
        scheme = schemes[centre >= level ? 1 : 0];
      }
      for (let i = 0; i < scheme.length; i += 1) {
        next.set(edgeId(cx, cy, scheme[i][0]), edgeId(cx, cy, scheme[i][1]));
      }
    }
  }

  /** Точка пересечения уровня на ребре, в пикселях картинки. */
  const pointOf = (id) => {
    const vertical = (id & 1) === 1;
    const cell = id >> 1;
    const x = (cell % stride) - 1;
    const y = Math.floor(cell / stride) - 1;
    const a = value(x, y);
    const b = vertical ? value(x, y + 1) : value(x + 1, y);
    const t = a === b ? 0.5 : (level - a) / (b - a);
    return vertical ? [x + 0.5, y + t + 0.5] : [x + t + 0.5, y + 0.5];
  };

  const rings = [];
  const seen = new Set();
  next.forEach((_, start) => {
    if (seen.has(start)) return;
    const points = [];
    let id = start;
    do {
      seen.add(id);
      const [x, y] = pointOf(id);
      points.push(x, y);
      id = next.get(id);
    } while (id !== undefined && id !== start && !seen.has(id));
    if (points.length >= 6) rings.push({ points, area: ringArea(points) });
  });
  return rings;
}

/** Площадь замкнутой ломаной со знаком (формула шнурования; в координатах «y вниз» по часовой стрелке — плюс). */
export function ringArea(points) {
  let sum = 0;
  const count = points.length / 2;
  for (let i = 0; i < count; i += 1) {
    const j = (i + 1) % count;
    sum += points[2 * i] * points[2 * j + 1] - points[2 * j] * points[2 * i + 1];
  }
  return sum / 2;
}

/**
 * Упрощение замкнутой ломаной (Рамер — Дуглас — Пейкер): точки, отклоняющиеся от прямой не больше чем на
 * `tolerance`, выбрасываются. Кольцо делится на две цепочки по самой далёкой от начала точке.
 * @param {number[]} points [x0, y0, x1, y1, …]
 * @param {number} tolerance в тех же единицах, что и координаты
 * @returns {number[]}
 */
export function simplifyRing(points, tolerance) {
  const count = points.length / 2;
  if (count <= 4 || !(tolerance > 0)) return points;

  let far = 0;
  let farDistance = -1;
  for (let i = 1; i < count; i += 1) {
    const d = (points[2 * i] - points[0]) ** 2 + (points[2 * i + 1] - points[1]) ** 2;
    if (d > farDistance) { farDistance = d; far = i; }
  }

  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[far] = 1;
  const limit = tolerance * tolerance;

  /** Квадрат расстояния от точки i до отрезка (a, b). */
  const distanceSq = (i, a, b) => {
    const ax = points[2 * a];
    const ay = points[2 * a + 1];
    const dx = points[2 * b] - ax;
    const dy = points[2 * b + 1] - ay;
    const px = points[2 * i] - ax;
    const py = points[2 * i + 1] - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSq));
    const ex = px - t * dx;
    const ey = py - t * dy;
    return ex * ex + ey * ey;
  };

  // Две цепочки: 0 → far и far → 0 (последняя замыкается через начало)
  const stack = [[0, far], [far, count]];
  while (stack.length) {
    const [from, to] = stack.pop();
    const end = to % count;
    let worst = -1;
    let worstDistance = limit;
    for (let i = from + 1; i < to; i += 1) {
      const d = distanceSq(i % count, from, end);
      if (d > worstDistance) { worstDistance = d; worst = i; }
    }
    if (worst >= 0) {
      keep[worst % count] = 1;
      stack.push([from, worst], [worst, to]);
    }
  }

  const result = [];
  for (let i = 0; i < count; i += 1) {
    if (keep[i]) result.push(points[2 * i], points[2 * i + 1]);
  }
  return result;
}

/**
 * Контуры → строка атрибута `d` для SVG (одна подпуть на контур).
 * @param {Array<{ points: number[] }>} rings
 * @param {{ digits?: number, scale?: number }} [options] digits — знаков после запятой; scale — множитель координат
 */
export function ringsToPath(rings, { digits = 1, scale = 1 } = {}) {
  const factor = 10 ** digits;
  const fmt = (n) => String(Math.round(n * scale * factor) / factor);
  return rings
    .map(({ points }) => {
      let d = `M${fmt(points[0])} ${fmt(points[1])}`;
      for (let i = 2; i < points.length; i += 2) d += `L${fmt(points[i])} ${fmt(points[i + 1])}`;
      return `${d}Z`;
    })
    .join('');
}

/**
 * Пиксели RGBA → поле для трассировки: берётся канал прозрачности. Миникарта в игре нарисована чёрным с
 * прозрачностью: улицы плотные, здания и пустота прозрачные.
 * @param {ArrayLike<number>} rgba
 * @returns {Uint8Array}
 */
export function alphaField(rgba) {
  const count = Math.floor(rgba.length / 4);
  const field = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) field[i] = rgba[i * 4 + 3];
  return field;
}

/**
 * Порог для «земли»: половина типичной плотности. Улицы на миникарте — полупрозрачный чёрный примерно
 * одной плотности (шум и мягкая тень по краям), здания и пустота прозрачны; половина плато лежит ровно
 * посередине между ними, поэтому порог не зависит от того, насколько плотно нарисован слой.
 * @param {ArrayLike<number>} field значения 0..255
 * @param {number} [floor] что считать «плотным»: значения ниже в расчёт не идут
 */
export function plateauLevel(field, floor = 64) {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < field.length; i += 1) histogram[field[i]] += 1;
  let total = 0;
  for (let v = floor; v < 256; v += 1) total += histogram[v];
  if (total === 0) return 128;
  let seen = 0;
  for (let v = floor; v < 256; v += 1) {
    seen += histogram[v];
    if (seen * 2 >= total) return Math.max(1, Math.round(v / 2));
  }
  return 128;
}

/**
 * Трассировка картинки целиком: контуры → упрощение → отбрасывание крошек → разбор на внешние и дыры.
 * @param {ArrayLike<number>} field
 * @param {number} width
 * @param {number} height
 * @param {{ level: number, tolerance?: number, minArea?: number }} options
 * @returns {{ outer: Array<{ points: number[], area: number }>, holes: Array<{ points: number[], area: number }> }}
 */
export function traceShape(field, width, height, { level, tolerance = 0.45, minArea = 2 }) {
  const outer = [];
  const holes = [];
  traceContours(field, width, height, level).forEach((ring) => {
    if (Math.abs(ring.area) < minArea) return;
    const points = simplifyRing(ring.points, tolerance);
    if (points.length < 6) return;
    (ring.area > 0 ? outer : holes).push({ points, area: ring.area });
  });
  // Крупные контуры первыми: SVG рисует в порядке записи, а при отладке главное — главная форма
  outer.sort((a, b) => b.area - a.area);
  holes.sort((a, b) => a.area - b.area);
  return { outer, holes };
}

/**
 * Наименьший порог от `from`, при котором выше него остаётся не больше `maxCoverage` всех пикселей. Так
 * отсекается мягкий ореол: коридоры туннелей — самая плотная часть картинки, а их доля меняется мало.
 * @param {ArrayLike<number>} field значения 0..255
 * @param {number} maxCoverage доля картинки, 0..1
 * @param {number} [from] нижняя граница порога
 * @param {number} [to] верхняя граница порога
 */
export function coverageLevel(field, maxCoverage, from = 196, to = 252) {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < field.length; i += 1) histogram[field[i]] += 1;
  const limit = field.length * maxCoverage;
  let above = 0;
  for (let v = 255; v >= from; v -= 1) {
    above += histogram[v];
    if (above > limit) return Math.min(to, v + 1);
  }
  return from;
}

/**
 * Туннели: тёмные коридоры лежат на мягком ореоле той же краски, поэтому порог берётся выше ореола (см.
 * coverageLevel). Если при нём всё равно получилось одно большое пятно (ореол не отсёкся), порог понемногу
 * поднимается.
 * @param {ArrayLike<number>} field
 * @param {number} width
 * @param {number} height
 * @param {{ level?: number, tolerance?: number, minArea?: number, maxShare?: number }} [options] maxShare — какую долю
 *   картинки может занимать самый большой контур, прежде чем он будет считаться ореолом
 */
export function traceTunnels(field, width, height, options = {}) {
  const { tolerance = 0.45, minArea = 4, maxShare = 0.02 } = options;
  const limit = width * height * maxShare;
  let current = options.level ?? coverageLevel(field, 0.031);
  let shape = traceShape(field, width, height, { level: current, tolerance, minArea });
  for (let step = 0; step < 5 && (shape.outer[0]?.area ?? 0) > limit && current < 252; step += 1) {
    current = Math.min(252, current + 6);
    shape = traceShape(field, width, height, { level: current, tolerance, minArea });
  }
  return shape;
}

/**
 * Улицы города из пикселей миникарты: путь «земли» (внешние контуры) и путь «зданий» (дыры в ней).
 * @param {ArrayLike<number>} rgba
 * @param {number} width
 * @param {number} height
 * @returns {{ size: number, ground: string, holes: string }}
 */
export function buildGround(rgba, width, height) {
  const field = alphaField(rgba);
  const { outer, holes } = traceShape(field, width, height, { level: plateauLevel(field) });
  return { size: width, ground: ringsToPath(outer), holes: ringsToPath(holes) };
}

/**
 * Один слой туннелей из пикселей картинки: все контуры одним путём (рисуется с fill-rule: evenodd).
 * @param {ArrayLike<number>} rgba
 * @param {number} width
 * @param {number} height
 * @param {number} [level]
 * @returns {{ size: number, d: string }}
 */
export function buildTunnels(rgba, width, height, level) {
  const { outer, holes } = traceTunnels(alphaField(rgba), width, height, level ? { level } : {});
  return { size: width, d: ringsToPath([...outer, ...holes]) };
}
