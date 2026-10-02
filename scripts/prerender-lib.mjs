/**
 * @fileoverview Пререндер страниц героев и предметов: чистые функции без ввода-вывода (файлы и сеть — в prerender.mjs).
 *
 * Сайт — SPA, и боты соцсетей, да и часть поисковиков, видят только статичный index.html с общим заголовком.
 * Для каждой страницы героя и предмета сборка кладёт рядом копию index.html с её собственными заголовком,
 * описанием, canonical и тегами превью ссылок, а в <noscript> — короткий текст (имя, роль, лор). Когда загрузится
 * JavaScript, приложение работает как обычно и обновляет те же теги само, поэтому сами тексты берутся из тех же
 * строк локали (seo.hero.*, seo.item.*), что и на клиенте. Страницы — только на английском: язык интерфейса на
 * сервере неизвестен.
 */
import { CURRENT_UPDATE } from '../src/data/updates.js';
import { getTranslation } from '../src/i18n/index.js';
import { isAvailableItem } from '../src/services/itemService.js';
import { SITE_URL, formatTitle } from '../src/services/siteMeta.js';

const t = (key, params) => getTranslation('english', key, params);

/** Текст в значение атрибута или в содержимое тега. */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Описания в данных приходят с разметкой (<span>, <br>): для превью нужен обычный текст. */
export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Обрезает по границе слова и ставит многоточие. */
export function clip(text, max = 280) {
  const value = String(text ?? '').trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6))}…`;
}

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');

/**
 * Идентификатор из ответа API идёт в путь файла (dist/hero/<id>.html) и в адрес страницы, поэтому принимаем только
 * число: строка вроде «../../x» вышла бы за пределы dist/. Те же адреса разрешает и vercel.json (только цифры).
 */
const isId = (value) => /^\d{1,12}$/.test(String(value ?? ''));

/**
 * Герои, у которых есть страница на сайте: не отключённые и не «в разработке»; играбельные либо из голосования.
 * @param {any[]} rawHeroes ответ /v1/assets/heroes
 * @returns {Array<{ path: string, title: string, description: string, heading: string, text: string }>}
 */
export function heroPages(rawHeroes) {
  return (Array.isArray(rawHeroes) ? rawHeroes : [])
    .filter((hero) => hero && hero.name && isId(hero.id ?? hero.hero_id))
    .filter((hero) => hero.disabled !== true && hero.in_development !== true)
    .filter((hero) => hero.player_selectable === true || hero.prerelease_only === true)
    .map((hero) => {
      const id = hero.id ?? hero.hero_id;
      const upcoming = hero.prerelease_only === true && hero.player_selectable !== true;
      const lore = stripHtml(typeof hero.description === 'string' ? hero.description : hero.description?.lore);
      const role = capitalize(hero.hero_type);
      return {
        path: `/hero/${id}`,
        title: upcoming
          ? t('seo.heroSoon.title', { name: hero.name })
          : t('seo.hero.title', { name: hero.name }),
        description: upcoming
          ? t('seo.heroSoon.description', { name: hero.name, update: CURRENT_UPDATE.name })
          : t('seo.hero.description', { name: hero.name }),
        heading: hero.name,
        text: [role, clip(lore)].filter(Boolean).join(' — '),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }));
}

/**
 * Предметы-улучшения, которые продаются в магазине.
 * @param {any[]} rawItems ответ /v1/assets/items
 */
export function itemPages(rawItems) {
  return (Array.isArray(rawItems) ? rawItems : [])
    .filter((item) => item && item.type === 'upgrade' && isId(item.id) && isAvailableItem(item))
    .map((item) => ({
      path: `/items/${item.id}`,
      title: t('seo.item.title', { name: item.name }),
      description: t('seo.item.description', { name: item.name }),
      heading: item.name,
      text: [capitalize(item.item_slot_type), item.cost != null ? `${item.cost} souls` : '', clip(stripHtml(item.description?.desc))]
        .filter(Boolean)
        .join(' — '),
    }))
    .sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }));
}

/** Заменяет content у <meta>, который обязан быть в шаблоне: без него пререндер молча портил бы превью. */
function setMeta(html, attr, key, value) {
  const pattern = new RegExp(`(<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content=")[^"]*(")`);
  if (!pattern.test(html)) throw new Error(`в index.html нет <meta ${attr}="${key}">`);
  return html.replace(pattern, (_, start, end) => `${start}${escapeHtml(value)}${end}`);
}

/**
 * Страница из шаблона index.html: свои заголовок, описание, canonical, теги превью и текст для тех, кто
 * читает без JavaScript.
 * @param {string} template содержимое dist/index.html
 * @param {{ path: string, title: string, description: string, heading: string, text: string }} page
 */
export function renderPage(template, page) {
  const fullTitle = formatTitle(page.title);
  const url = `${SITE_URL}${page.path}`;

  let html = template;
  if (!/<title>[^<]*<\/title>/.test(html)) throw new Error('в index.html нет <title>');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`);
  html = setMeta(html, 'name', 'description', page.description);
  html = setMeta(html, 'property', 'og:title', fullTitle);
  html = setMeta(html, 'property', 'og:description', page.description);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'name', 'twitter:title', fullTitle);
  html = setMeta(html, 'name', 'twitter:description', page.description);

  if (!html.includes('</head>')) throw new Error('в index.html нет </head>');
  html = html.replace('</head>', `    <link rel="canonical" href="${escapeHtml(url)}" />\n  </head>`);

  const marker = '<div id="root"></div>';
  if (!html.includes(marker)) throw new Error('в index.html нет <div id="root">');
  const noscript = `<noscript>\n      <h1>${escapeHtml(page.heading)}</h1>\n      <p>${escapeHtml(page.text || page.description)}</p>\n      <p><a href="/">Dead Hub</a> — Deadlock hero stats, builds and matchups.</p>\n    </noscript>\n    `;
  return html.replace(marker, `${noscript}${marker}`);
}

/**
 * Страница для адресов, которых на сайте нет: Vercel отдаёт её (файл 404.html) с настоящим статусом 404, потому что
 * vercel.json перечисляет только существующие адреса. Это та же оболочка приложения — после загрузки JavaScript
 * роутер сам покажет экран «страница не найдена», — а для читающих без JavaScript и для поисковых ботов в ней свой
 * заголовок, запрет индексации и короткий текст. Canonical не ставится: у неизвестного адреса «правильного» нет.
 * @param {string} template содержимое dist/index.html
 */
export function renderNotFound(template) {
  const fullTitle = formatTitle(t('seo.notFound.title'));
  const description = t('seo.notFound.description');

  let html = template;
  if (!/<title>[^<]*<\/title>/.test(html)) throw new Error('в index.html нет <title>');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`);
  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'property', 'og:title', fullTitle);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'name', 'twitter:title', fullTitle);
  html = setMeta(html, 'name', 'twitter:description', description);

  if (!html.includes('</head>')) throw new Error('в index.html нет </head>');
  html = html.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');

  const marker = '<div id="root"></div>';
  if (!html.includes(marker)) throw new Error('в index.html нет <div id="root">');
  const noscript = `<noscript>\n      <h1>${escapeHtml(t('notFound.title'))}</h1>\n      <p>${escapeHtml(t('notFound.text'))}</p>\n      <p><a href="/">Dead Hub</a> — Deadlock hero stats, builds and matchups.</p>\n    </noscript>\n    `;
  return html.replace(marker, `${noscript}${marker}`);
}

/** Адреса из существующего sitemap.xml (статичные разделы сайта). */
export function staticPathsFrom(sitemapXml) {
  return [...String(sitemapXml ?? '').matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1].replace(SITE_URL, '') || '/')
    .filter((path) => path.startsWith('/'));
}

/** sitemap.xml: статичные разделы и пререндеренные страницы без повторов. */
export function buildSitemap(staticPaths, pagePaths) {
  const paths = [...new Set([...staticPaths, ...pagePaths])];
  const rows = paths.map((path) => `  <url><loc>${escapeHtml(SITE_URL + (path === '/' ? '/' : path))}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}
