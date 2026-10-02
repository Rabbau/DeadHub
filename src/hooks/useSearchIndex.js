import { useEffect, useMemo, useState } from 'react';
import { fetchAllItems, fetchHeroCatalog } from '../api/index.js';
import { useHeroStore } from '../store/heroStore.js';
import { useTranslation } from './useTranslation.js';
import { SEARCH_PAGES, indexEntry, normalizeQuery } from '../services/searchService.js';
import { isAvailableItem } from '../services/itemService.js';

/**
 * Что можно найти: герои (справочник — один кешируемый запрос, общий со списком героев), предметы (каталог
 * подгружается, только когда в поле набрано хотя бы два символа: он тяжёлый, и большинству запросов нужны герои)
 * и разделы сайта. Игроки в индекс не входят — их ищут по нику через API, и только по явному выбору.
 * @param {{ query: string, extraPages?: Array<{ to: string, name: string }> }} options
 */
export function useSearchIndex({ query, extraPages = [] }) {
  const language = useHeroStore((state) => state.language);
  const t = useTranslation();
  const [heroes, setHeroes] = useState([]);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHeroCatalog(language)
      .then((list) => {
        if (cancelled) return;
        setHeroes(
          list
            // Заготовки в разработке и отключённые герои страницы не имеют
            .filter((hero) => !hero.disabled && !hero.in_development)
            .map((hero) => indexEntry({
              type: 'hero',
              id: hero.id ?? hero.hero_id,
              name: hero.name,
              sub: hero.hero_type ? hero.hero_type.charAt(0).toUpperCase() + hero.hero_type.slice(1) : '',
              icon: hero.images?.icon_image_small_webp || hero.images?.icon_image_small || null,
              to: `/hero/${hero.id ?? hero.hero_id}`,
            })),
        );
      })
      .catch(() => { /* поиск по героям просто пуст: остальное работает */ });
    return () => { cancelled = true; };
  }, [language]);

  const wantItems = normalizeQuery(query).length >= 2;
  useEffect(() => {
    if (!wantItems) return undefined;
    let cancelled = false;
    setItemsLoading(true);
    fetchAllItems(language)
      .then((list) => {
        if (cancelled) return;
        setItems(
          list.filter(isAvailableItem).map((item) => indexEntry({
            type: 'item',
            id: item.id,
            name: item.name,
            sub: item.cost != null ? String(item.cost) : '',
            icon: item.image_url,
            to: `/items/${item.id}`,
          })),
        );
      })
      .catch(() => { /* предметов в результатах не будет */ })
      .finally(() => { if (!cancelled) setItemsLoading(false); });
    return () => { cancelled = true; };
  }, [wantItems, language]);

  // Названия разделов зависят только от языка
  const pages = useMemo(
    () => [
      ...SEARCH_PAGES.map((page) => ({ to: page.to, name: t(page.key) })),
      ...extraPages,
    ].map((page) => indexEntry({ type: 'page', id: page.to, name: page.name, to: page.to })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, extraPages.map((page) => page.to).join('|')],
  );

  const entries = useMemo(() => [...heroes, ...items, ...pages], [heroes, items, pages]);
  return { entries, pages, itemsLoading };
}
