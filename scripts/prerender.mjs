/**
 * Пререндер страниц героев и предметов — шаг сборки после `vite build` (см. package.json).
 *
 *   dist/hero/<id>/index.html, dist/items/<id>/index.html — копии dist/index.html со своими заголовком,
 *   описанием, canonical и тегами превью (подробности — в prerender-lib.mjs), и sitemap.xml со всеми адресами.
 *   dist/404.html — страница для несуществующих адресов (Vercel отдаёт её со статусом 404).
 *
 * Два запроса к бесплатному Deadlock API на сборку (список героев и список предметов). Если API недоступен,
 * сборка не падает: остаётся обычный SPA-вариант (ничего не пререндерится), а в логе — предупреждение.
 * SKIP_PRERENDER=1 пропускает шаг (так делает CI: ему не нужна сеть). 404.html сети не требует и пишется всегда:
 * без неё несуществующие адреса получали бы стандартную страницу Vercel вместо экрана сайта.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemap, heroPages, itemPages, renderNotFound, renderPage, staticPathsFrom } from './prerender-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const API = process.env.PRERENDER_API || 'https://api.deadlock-api.com';

// Сломанный шаблон — ошибка разработчика, а не сбой сети: сборка должна упасть, а не выпустить сайт без 404.html
await fs.writeFile(path.join(DIST, '404.html'), renderNotFound(await fs.readFile(path.join(DIST, 'index.html'), 'utf8')));
console.log('prerender: 404.html записан');

if (process.env.SKIP_PRERENDER) {
  console.log('prerender: пропущен (SKIP_PRERENDER)');
  process.exit(0);
}

/** Ответ API бывает массивом или объектом с массивом внутри. */
const listOf = (data) => (Array.isArray(data) ? data : data?.data ?? data?.heroes ?? data?.items ?? []);

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'DeadHub-prerender' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${url}`);
  return response.json();
}

async function main() {
  const template = await fs.readFile(path.join(DIST, 'index.html'), 'utf8');

  // Героев и предметы запрашиваем независимо: если упал один список, второй всё равно пригодится
  const [heroes, items] = await Promise.allSettled([
    getJson(`${API}/v1/assets/heroes?language=english`),
    getJson(`${API}/v1/assets/items?language=english`),
  ]);
  const pages = [];
  if (heroes.status === 'fulfilled') pages.push(...heroPages(listOf(heroes.value)));
  else console.warn('prerender: герои не загрузились —', heroes.reason?.message);
  if (items.status === 'fulfilled') pages.push(...itemPages(listOf(items.value)));
  else console.warn('prerender: предметы не загрузились —', items.reason?.message);

  if (pages.length === 0) {
    console.warn('prerender: пререндерить нечего — остаётся обычный SPA-вариант');
    return;
  }

  // Страница кладётся в двух видах: <путь>/index.html и <путь>.html. Хосты по-разному сопоставляют адрес без
  // слэша в конце с файлом (Vercel с cleanUrls и локальный preview берут .html, прочие — index.html в папке),
  // а так страница находится при любом из них; canonical у обеих одинаковый
  for (const page of pages) {
    const html = renderPage(template, page);
    const segments = page.path.split('/').filter(Boolean);
    const dir = path.join(DIST, ...segments);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), html);
    await fs.writeFile(`${dir}.html`, html);
  }

  const sitemapFile = path.join(DIST, 'sitemap.xml');
  const staticPaths = staticPathsFrom(await fs.readFile(sitemapFile, 'utf8').catch(() => ''));
  await fs.writeFile(sitemapFile, buildSitemap(staticPaths, pages.map((page) => page.path)));

  const heroCount = pages.filter((page) => page.path.startsWith('/hero/')).length;
  console.log(`prerender: ${pages.length} страниц (${heroCount} героев, ${pages.length - heroCount} предметов), sitemap.xml обновлён`);
}

// Любая неожиданность не должна ронять деплой: страницы просто останутся обычными
main().catch((error) => {
  console.warn('prerender: пропущен —', error.message);
});
