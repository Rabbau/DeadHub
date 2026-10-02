/**
 * Генерирует картинку для превью ссылок (Open Graph / Twitter): public/og-image.png, 1200×630.
 * Без зависимостей: рисует пиксельный череп из public/favicon.svg и подпись пиксельным шрифтом 5×7,
 * PNG собирает сам (zlib из Node). Запуск: `node scripts/generate-og-image.mjs`.
 * Менять нужно только при смене названия, слогана или цветов — картинка лежит в репозитории готовой.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: '#060709',
  dots: '#13151b',
  panel: '#0b0d11',
  line: '#32353e',
  shadow: '#1d2028',
  ink: '#f3f4ed',
  inkShadow: '#2a2e38',
  soft: '#a9aebd',
  muted: '#989aaa',
  acid: '#bdff32',
  acidShadow: '#6b8d2c',
};

// ── Холст ─────────────────────────────────────────────────────────

const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);

function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function fillRect(x, y, w, h, color) {
  const [r, g, b] = rgb(color);
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(WIDTH, Math.round(x + w));
  const y1 = Math.min(HEIGHT, Math.round(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const at = (py * WIDTH + px) * 3;
      pixels[at] = r;
      pixels[at + 1] = g;
      pixels[at + 2] = b;
    }
  }
}

// ── Пиксельный шрифт 5×7 ──────────────────────────────────────────

const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

/** Ширина строки в пикселях при масштабе scale (между буквами — один пиксель шрифта). */
function textWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

function drawText(text, x, y, scale, color, shadow) {
  const draw = (dx, dy, tint) => {
    [...text].forEach((char, index) => {
      const rows = GLYPHS[char] ?? GLYPHS[' '];
      rows.forEach((row, ry) => {
        [...row].forEach((cell, rx) => {
          if (cell === '#') fillRect(x + dx + (index * 6 + rx) * scale, y + dy + ry * scale, scale, scale, tint);
        });
      });
    });
  };
  if (shadow) draw(Math.round(scale * 0.4), Math.round(scale * 0.4), shadow);
  draw(0, 0, color);
}

// ── Череп из favicon.svg ──────────────────────────────────────────

function loadSkull() {
  const svg = fs.readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8');
  return [...svg.matchAll(/<rect\b([^>]*)\/>/g)]
    .map((match) => {
      const attr = (name) => new RegExp(`\\b${name}="([^"]*)"`).exec(match[1])?.[1];
      return { x: Number(attr('x') ?? 0), y: Number(attr('y') ?? 0), w: Number(attr('width')), h: Number(attr('height')), fill: attr('fill') };
    })
    .filter((rect) => rect.fill && rect.fill.toLowerCase() !== COLORS.bg); // первый прямоугольник — фон иконки
}

function drawSkull(x, y, scale) {
  const rects = loadSkull();
  // Сначала тень всей фигуры, потом сама фигура
  rects.forEach((r) => fillRect(x + (r.x + 0.7) * scale, y + (r.y + 0.7) * scale, r.w * scale, r.h * scale, COLORS.shadow));
  rects.forEach((r) => fillRect(x + r.x * scale, y + r.y * scale, r.w * scale, r.h * scale, r.fill));
}

// ── PNG ───────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng() {
  const stride = WIDTH * 3 + 1;
  const raw = Buffer.alloc(stride * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    raw[y * stride] = 0; // фильтр «без фильтра»
    pixels.copy(raw, y * stride + 1, y * WIDTH * 3, (y + 1) * WIDTH * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; // 8 бит на канал
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Композиция ────────────────────────────────────────────────────

fillRect(0, 0, WIDTH, HEIGHT, COLORS.bg);
for (let y = 8; y < HEIGHT; y += 16) {
  for (let x = 8; x < WIDTH; x += 16) fillRect(x, y, 2, 2, COLORS.dots);
}

// Панель с жёсткой тенью, как у карточек на сайте
fillRect(52, 52, 1108, 538, COLORS.shadow);
fillRect(40, 40, 1108, 538, COLORS.line);
fillRect(44, 44, 1100, 530, COLORS.panel);
fillRect(44, 44, 14, 530, COLORS.acid);

// Название
drawText('DEAD', 120, 120, 15, COLORS.ink, COLORS.inkShadow);
drawText('HUB', 120 + textWidth('DEAD ', 15) + 15, 120, 15, COLORS.acid, COLORS.acidShadow);
fillRect(120, 262, 220, 12, COLORS.acid);
fillRect(126, 268, 220, 12, COLORS.acidShadow);
fillRect(120, 262, 220, 12, COLORS.acid);

// Слоган
drawText('DEADLOCK HERO STATS', 120, 322, 6, COLORS.soft);
drawText('BUILDS & MATCHUPS', 120, 382, 6, COLORS.soft);
drawText('INTERACTIVE MAP', 120, 442, 6, COLORS.soft);
drawText('DEAD-HUB.VERCEL.APP', 120, 512, 4, COLORS.muted);

// Череп справа
drawSkull(838, 166, 19);

const output = path.join(ROOT, 'public', 'og-image.png');
fs.writeFileSync(output, encodePng());
console.log(`og-image.png: ${WIDTH}×${HEIGHT}, ${fs.statSync(output).size} байт`);
