import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useHeroStore } from '../store/heroStore';
import { useTranslation } from './useTranslation';
import { canonicalUrl, formatTitle, ogLocale } from '../services/siteMeta';

/** Находит тег в <head> или создаёт его. */
function headTag(selector, create) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  return element;
}

function setNamed(name, content) {
  headTag(`meta[name="${name}"]`, () => {
    const element = document.createElement('meta');
    element.setAttribute('name', name);
    return element;
  }).setAttribute('content', content);
}

function setProperty(property, content) {
  headTag(`meta[property="${property}"]`, () => {
    const element = document.createElement('meta');
    element.setAttribute('property', property);
    return element;
  }).setAttribute('content', content);
}

function setCanonical(href) {
  headTag('link[rel="canonical"]', () => {
    const element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    return element;
  }).setAttribute('href', href);
}

/**
 * Заголовок вкладки, описание, canonical и теги превью ссылок для текущей страницы.
 * Сайт — SPA: поисковики с JavaScript (Google) увидят эти теги, а боты соцсетей берут только статичный
 * index.html — для них действует общий заголовок и картинка.
 *
 * @param {string|{ title?: string, description?: string }} page ключ из `seo.<ключ>` в локалях
 *   либо готовые тексты (страницы героя, предмета и игрока, где название приходит из данных)
 * @param {{ noindex?: boolean }} [options] noindex — не показывать страницу в поиске (404, ошибка)
 */
export function usePageMeta(page, { noindex = false } = {}) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const { pathname } = useLocation();

  const isKey = typeof page === 'string';
  const title = isKey ? t(`seo.${page}.title`) : page?.title;
  const description = (isKey ? t(`seo.${page}.description`) : page?.description) || t('seo.default.description');

  useEffect(() => {
    const fullTitle = formatTitle(title);
    const url = canonicalUrl(pathname);

    document.title = fullTitle;
    setNamed('description', description);
    setCanonical(url);
    setProperty('og:title', fullTitle);
    setProperty('og:description', description);
    setProperty('og:url', url);
    setProperty('og:locale', ogLocale(language));
    setNamed('twitter:title', fullTitle);
    setNamed('twitter:description', description);

    const robots = document.head.querySelector('meta[name="robots"]');
    if (noindex) setNamed('robots', 'noindex');
    else robots?.remove();
  }, [title, description, pathname, language, noindex]);
}
