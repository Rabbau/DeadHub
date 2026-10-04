import { describe, expect, it } from 'vitest'
import {
  alphaField,
  buildGround,
  buildTunnels,
  coverageLevel,
  plateauLevel,
  ringArea,
  ringsToPath,
  simplifyRing,
  traceContours,
  traceShape,
  traceTunnels,
} from '../src/services/mapTrace.js'

/** Поле из «картинки»: строки из символов, '#' — плотный пиксель (255), '.' — пустой. */
function grid(rows, solid = 255) {
  const height = rows.length
  const width = rows[0].length
  const field = new Uint8Array(width * height)
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') field[y * width + x] = solid }))
  return { field, width, height }
}

const total = (rings) => rings.reduce((sum, ring) => sum + ring.area, 0)

describe('traceContours', () => {
  it('draws a ring around a single pixel, clockwise (positive area)', () => {
    const { field, width, height } = grid(['...', '.#.', '...'])
    const rings = traceContours(field, width, height, 128)
    expect(rings).toHaveLength(1)
    expect(rings[0].points).toHaveLength(8)
    expect(rings[0].area).toBeGreaterThan(0.4)
    expect(rings[0].area).toBeLessThan(0.6)
  })

  it('traces a block close to its real size', () => {
    const { field, width, height } = grid(['......', '.####.', '.####.', '.####.', '......'])
    const [ring] = traceContours(field, width, height, 128)
    expect(ring.area).toBeGreaterThan(10)
    expect(ring.area).toBeLessThanOrEqual(12)
  })

  it('finds the hole of a ring as a separate contour with a negative area', () => {
    const { field, width, height } = grid(['.......', '.#####.', '.#...#.', '.#...#.', '.#...#.', '.#####.', '.......'])
    const rings = traceContours(field, width, height, 128)
    expect(rings).toHaveLength(2)
    expect(rings.filter((ring) => ring.area > 0)).toHaveLength(1)
    expect(rings.filter((ring) => ring.area < 0)).toHaveLength(1)
    // Площадь «земли» — внешний контур минус дыра
    expect(total(rings)).toBeGreaterThan(10)
    expect(total(rings)).toBeLessThan(16)
  })

  it('closes shapes that touch the edge of the picture', () => {
    const { field, width, height } = grid(['##..', '##..', '....'])
    const rings = traceContours(field, width, height, 128)
    expect(rings).toHaveLength(1)
    expect(rings[0].area).toBeGreaterThan(3)
  })

  it('keeps two diagonal pixels apart, or joins them when the middle is dense enough', () => {
    const { field, width, height } = grid(['#.', '.#'])
    expect(traceContours(field, width, height, 128).filter((ring) => ring.area > 0)).toHaveLength(2)
    // Порог ниже среднего значения клетки: диагональные пиксели соединены
    expect(traceContours(field, width, height, 100).filter((ring) => ring.area > 0)).toHaveLength(1)
  })

  it('places the contour between pixels by their values (sub-pixel accuracy)', () => {
    // Слева плотно (200), справа пусто: граница уровня 100 лежит посередине между центрами пикселей 1 и 2
    const field = new Uint8Array([200, 200, 0, 0, 200, 200, 0, 0, 200, 200, 0, 0])
    const [ring] = traceContours(field, 4, 3, 100)
    const xs = []
    for (let i = 0; i < ring.points.length; i += 2) xs.push(ring.points[i])
    expect(Math.max(...xs)).toBeCloseTo(2, 0)
    // Правый плотный пиксель слабее — граница уходит ближе к левому, плотному
    const faint = new Uint8Array([200, 120, 0, 0, 200, 120, 0, 0, 200, 120, 0, 0])
    const [ring2] = traceContours(faint, 4, 3, 100)
    const xs2 = []
    for (let i = 0; i < ring2.points.length; i += 2) xs2.push(ring2.points[i])
    expect(Math.max(...xs2)).toBeCloseTo(1.667, 2)
  })

  it('returns nothing for an empty picture', () => {
    expect(traceContours(new Uint8Array(16), 4, 4, 128)).toEqual([])
  })
})

describe('ringArea', () => {
  it('is positive for clockwise rings and negative for counter-clockwise ones (y goes down)', () => {
    expect(ringArea([0, 0, 2, 0, 2, 2, 0, 2])).toBe(4)
    expect(ringArea([0, 0, 0, 2, 2, 2, 2, 0])).toBe(-4)
  })
})

describe('simplifyRing', () => {
  it('drops points that lie on a straight line', () => {
    const square = [0, 0, 5, 0, 10, 0, 10, 5, 10, 10, 5, 10, 0, 10, 0, 5]
    expect(simplifyRing(square, 0.1)).toEqual([0, 0, 10, 0, 10, 10, 0, 10])
  })

  it('keeps a point that sticks out more than the tolerance', () => {
    const bump = [0, 0, 5, 1, 10, 0, 10, 10, 0, 10]
    expect(simplifyRing(bump, 0.5)).toHaveLength(10)
    expect(simplifyRing(bump, 2)).toHaveLength(8)
  })

  it('leaves tiny rings and zero tolerance alone', () => {
    const triangle = [0, 0, 4, 0, 0, 4]
    expect(simplifyRing(triangle, 1)).toEqual(triangle)
    const many = [0, 0, 5, 0, 10, 0, 10, 10, 0, 10]
    expect(simplifyRing(many, 0)).toEqual(many)
  })
})

describe('ringsToPath', () => {
  it('writes one closed subpath per ring and rounds the numbers', () => {
    expect(ringsToPath([{ points: [0, 0, 1.234, 0, 1.234, 2.5] }, { points: [5, 5, 6, 5, 6, 6] }])).toBe('M0 0L1.2 0L1.2 2.5ZM5 5L6 5L6 6Z')
  })

  it('scales and keeps the requested number of decimals', () => {
    expect(ringsToPath([{ points: [1, 1, 2, 1, 2, 2] }], { digits: 2, scale: 0.5 })).toBe('M0.5 0.5L1 0.5L1 1Z')
  })
})

describe('alphaField', () => {
  it('takes the alpha channel of RGBA pixels', () => {
    expect([...alphaField([10, 20, 30, 40, 1, 2, 3, 250])]).toEqual([40, 250])
  })
})

describe('plateauLevel', () => {
  it('is half of the typical density of the dense pixels', () => {
    const field = new Uint8Array(1000)
    field.fill(200, 0, 500)
    expect(plateauLevel(field)).toBe(100)
  })

  it('does not depend on how dense the layer is drawn', () => {
    const faint = new Uint8Array(100).fill(120)
    expect(plateauLevel(faint)).toBe(60)
  })

  it('falls back to the middle when nothing is dense', () => {
    expect(plateauLevel(new Uint8Array(50))).toBe(128)
  })
})

describe('coverageLevel', () => {
  it('finds the lowest level above which the picture keeps no more than the allowed share', () => {
    const field = new Uint8Array(1000)
    field.fill(250, 0, 20)   // 2 %
    field.fill(230, 20, 80)  // ещё 6 %
    expect(coverageLevel(field, 0.03)).toBe(231)
  })

  it('stays within its bounds', () => {
    expect(coverageLevel(new Uint8Array(100), 0.5)).toBe(196)
    const dense = new Uint8Array(100).fill(255)
    expect(coverageLevel(dense, 0.01, 196, 252)).toBe(252)
  })
})

describe('traceShape', () => {
  it('splits contours into outer shapes and holes and drops crumbs', () => {
    const { field, width, height } = grid([
      '.........',
      '.#######.',
      '.#.....#.',
      '.#.....#.',
      '.#.....#.',
      '.#######.',
      '.........',
      '.....#...',
      '.........',
    ])
    const { outer, holes } = traceShape(field, width, height, { level: 128, minArea: 2 })
    expect(outer).toHaveLength(1) // одинокий пиксель — крошка, он меньше minArea
    expect(holes).toHaveLength(1)
  })

  it('puts the biggest outer shape first', () => {
    const { field, width, height } = grid(['..........', '.##..####.', '.##..####.', '.....####.', '..........'])
    const { outer } = traceShape(field, width, height, { level: 128, minArea: 1 })
    expect(outer).toHaveLength(2)
    expect(outer[0].area).toBeGreaterThan(outer[1].area)
  })
})

describe('traceTunnels', () => {
  /** Ореол: большое пятно плотностью 220 и тонкие коридоры плотностью 255 внутри него. */
  function haloWithCorridors() {
    const size = 60
    const field = new Uint8Array(size * size)
    for (let y = 8; y < 52; y += 1) for (let x = 8; x < 52; x += 1) field[y * size + x] = 220
    for (let x = 14; x < 46; x += 1) { field[20 * size + x] = 255; field[21 * size + x] = 255 }
    for (let y = 30; y < 46; y += 1) { field[y * size + 30] = 255; field[y * size + 31] = 255 }
    return { field, size }
  }

  it('picks the corridors, not the halo around them', () => {
    const { field, size } = haloWithCorridors()
    const { outer } = traceTunnels(field, size, size, { minArea: 2 })
    const area = outer.reduce((sum, ring) => sum + ring.area, 0)
    expect(area).toBeLessThan(size * size * 0.05)
    expect(area).toBeGreaterThan(40)
  })

  it('raises the level by itself while the biggest shape still looks like a halo', () => {
    const { field, size } = haloWithCorridors()
    // Стартовый уровень ниже ореола: сначала получится пятно, затем порог поднимется
    const { outer } = traceTunnels(field, size, size, { level: 200, minArea: 2, maxShare: 0.05 })
    expect(outer[0].area).toBeLessThan(size * size * 0.05)
  })
})

describe('buildGround and buildTunnels', () => {
  function rgbaOf(rows, alpha) {
    const { field, width, height } = grid(rows, alpha)
    const rgba = new Uint8ClampedArray(width * height * 4)
    field.forEach((value, i) => { rgba[i * 4 + 3] = value })
    return { rgba, width, height }
  }

  it('turns the street picture into a ground path and a path of its walls', () => {
    const { rgba, width, height } = rgbaOf(['.......', '.#####.', '.#...#.', '.#...#.', '.#####.', '.......'], 190)
    const shape = buildGround(rgba, width, height)
    expect(shape.size).toBe(7)
    expect(shape.ground).toMatch(/^M[\d. ]+(L[\d. ]+)+Z$/)
    expect(shape.holes).toMatch(/^M/)
  })

  it('turns a tunnel picture into one path', () => {
    const { rgba, width, height } = rgbaOf(['.........', '.#######.', '.#######.', '.........'], 255)
    const shape = buildTunnels(rgba, width, height)
    expect(shape.size).toBe(9)
    expect(shape.d).toMatch(/^M/)
  })
})
