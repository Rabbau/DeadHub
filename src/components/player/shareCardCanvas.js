/**
 * @fileoverview Рисует картинку профиля (см. shareCardService: что на ней написано) на canvas в браузере посетителя.
 * Картинки (аватар, значок ранга, иконки героев) идут с хостов, которые разрешены в CSP и отдают CORS-заголовок «*», поэтому
 * canvas остаётся «чистым» и из него можно получить PNG. Если какая-то картинка не загрузилась, вместо неё рисуется
 * заглушка — карточка всё равно получается.
 */
import { CARD, fitText } from '../../services/shareCardService.js';

// Цвета и шрифты — те же, что у сайта (tokens в src/index.css)
const COLOR = {
  bg: '#151210',
  deep: '#0b0a09',
  panel: '#1b1713',
  panel2: '#221c17',
  line: '#3a322b',
  ink: '#f7e9d5',
  soft: '#d3c6b2',
  muted: '#a79e92',
  acid: '#e0622f',
  green: '#97da79',
  red: '#ee5a67',
  paper: '#f2e4cb',
};
const FONT = {
  display: "'Alegreya', Georgia, serif",
  caps: "'Oswald', 'Arial Narrow', sans-serif",
  ui: "'Jost', system-ui, sans-serif",
};

/** Загружает картинку для canvas; null, если не вышло (нет сети, нет CORS, нет адреса). */
export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Шрифты сайта подгружаются лениво: перед рисованием просим те начертания, которые понадобятся. */
async function ensureFonts() {
  if (!document.fonts?.load) return;
  const wanted = [`900 56px ${FONT.display}`, `700 40px ${FONT.caps}`, `600 22px ${FONT.caps}`, `400 22px ${FONT.ui}`, `600 22px ${FONT.ui}`];
  await Promise.all(wanted.map((font) => document.fonts.load(font, 'Aa Яя 0123456789%')));
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** Картинка в квадрате с обрезкой по скруглению; без картинки — заглушка с первой буквой. */
function drawAvatar(ctx, image, x, y, size, letter) {
  ctx.save();
  roundedRect(ctx, x, y, size, size, 8);
  ctx.clip();
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = COLOR.panel2;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = COLOR.acid;
    ctx.font = `900 ${Math.round(size * 0.5)}px ${FONT.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((letter || '?').slice(0, 1).toUpperCase(), x + size / 2, y + size / 2 + 2);
  }
  ctx.restore();
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 2;
  roundedRect(ctx, x, y, size, size, 8);
  ctx.stroke();
}

/**
 * Рисует карточку на canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {ReturnType<typeof import('../../services/shareCardService.js').buildShareModel>} model
 * @param {{ avatar: HTMLImageElement|null, badge: HTMLImageElement|null, heroes: Array<HTMLImageElement|null> }} images
 */
export async function drawShareCard(canvas, model, images) {
  await ensureFonts();
  const { WIDTH, HEIGHT } = CARD;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const text = (value, x, y, { font, color, align = 'left', baseline = 'alphabetic', maxWidth } = {}) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(maxWidth ? fitText(value, maxWidth, (s) => ctx.measureText(s).width) : value, x, y);
  };

  // Фон: тёплый чёрный с оранжевой полосой сверху
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  glow.addColorStop(0, '#2a1a12');
  glow.addColorStop(0.6, COLOR.bg);
  glow.addColorStop(1, '#10161a');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = COLOR.acid;
  ctx.fillRect(0, 0, WIDTH, 10);

  // Шапка: аватар, ник, ID и ранг
  const PAD = 56;
  drawAvatar(ctx, images.avatar, PAD, 56, 124, model.name);
  text(model.name, PAD + 124 + 28, 118, { font: `900 56px ${FONT.display}`, color: COLOR.ink, maxWidth: 640 });
  text(model.idLine, PAD + 124 + 28, 160, { font: `600 22px ${FONT.caps}`, color: COLOR.muted });

  if (model.badge) {
    const size = 112;
    const x = WIDTH - PAD - size;
    if (images.badge) ctx.drawImage(images.badge, x, 46, size, size);
    text(model.badge.label ?? '', WIDTH - PAD - size / 2, 176, { font: `700 24px ${FONT.caps}`, color: COLOR.acid, align: 'center', maxWidth: 220 });
  }

  // Четыре главных числа
  const statTop = 232;
  const statWidth = (WIDTH - 2 * PAD - 3 * 20) / 4;
  model.stats.forEach((stat, i) => {
    const x = PAD + i * (statWidth + 20);
    ctx.fillStyle = COLOR.panel;
    ctx.fillRect(x, statTop, statWidth, 118);
    ctx.fillStyle = COLOR.acid;
    ctx.fillRect(x, statTop, 5, 118);
    text(stat.label.toUpperCase(), x + 24, statTop + 36, { font: `600 20px ${FONT.caps}`, color: COLOR.muted, maxWidth: statWidth - 40 });
    text(stat.value, x + 24, statTop + 92, { font: `700 52px ${FONT.caps}`, color: COLOR.ink, maxWidth: statWidth - 40 });
  });

  // Любимые герои
  const heroTop = 392;
  text(model.heroesTitle.toUpperCase(), PAD, heroTop, { font: `600 20px ${FONT.caps}`, color: COLOR.muted });
  model.heroes.forEach((hero, i) => {
    const x = PAD + i * 248;
    const y = heroTop + 22;
    drawAvatar(ctx, images.heroes[i], x, y, 72, hero.name);
    text(hero.name, x + 84, y + 30, { font: `600 23px ${FONT.ui}`, color: COLOR.ink, maxWidth: 150 });
    text(`${hero.winrate} · ${hero.matches}`, x + 84, y + 62, { font: `600 21px ${FONT.caps}`, color: COLOR.soft, maxWidth: 150 });
  });

  // Форма: последние результаты полосой
  if (model.form) {
    const x0 = 820;
    text(model.form.caption, x0, heroTop, { font: `600 20px ${FONT.caps}`, color: COLOR.muted, maxWidth: WIDTH - PAD - x0 });
    const cell = 30;
    const gap = 8;
    model.form.results.forEach((win, i) => {
      const x = x0 + i * (cell + gap);
      ctx.fillStyle = win ? COLOR.green : COLOR.red;
      roundedRect(ctx, x, heroTop + 26, cell, cell, 4);
      ctx.fill();
    });
  }

  // Подвал: адрес профиля и пометка, что сайт неофициальный
  ctx.fillStyle = COLOR.deep;
  ctx.fillRect(0, HEIGHT - 70, WIDTH, 70);
  text(model.footer, PAD, HEIGHT - 28, { font: `600 24px ${FONT.caps}`, color: COLOR.acid });
  text(model.note, WIDTH - PAD, HEIGHT - 28, { font: `400 20px ${FONT.ui}`, color: COLOR.muted, align: 'right', maxWidth: 640 });
}

/** PNG из canvas; null, если браузер не смог (например, canvas «грязный»). */
export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}
