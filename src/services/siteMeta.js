/**
 * @fileoverview Заголовки и адреса страниц для вкладки браузера, поисковиков и превью ссылок.
 * Без React и без DOM.
 */

export const SITE_NAME = 'Dead Hub';
export const SITE_URL = 'https://dead-hub.vercel.app';

/** «Страница — Dead Hub»; без названия страницы — заголовок главной из index.html. */
export function formatTitle(page) {
  const name = String(page ?? '').trim();
  return name ? `${name} — ${SITE_NAME}` : `${SITE_NAME} — Deadlock hero stats & builds`;
}

/**
 * Адрес для canonical и og:url: без строки запроса, хэша и завершающего слэша (кроме главной).
 * `/map?preset=new` и `/map` — одна и та же страница для поисковика.
 * @param {string} pathname
 */
export function canonicalUrl(pathname) {
  const path = String(pathname || '/').split(/[?#]/)[0].replace(/\/+$/, '');
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Язык интерфейса → значение атрибута lang у <html>. */
export function languageCode(language) {
  return language === 'russian' ? 'ru' : 'en';
}

/** Язык интерфейса → og:locale. */
export function ogLocale(language) {
  return language === 'russian' ? 'ru_RU' : 'en_US';
}
