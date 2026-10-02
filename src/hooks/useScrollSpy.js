import { useEffect, useState } from 'react';

/**
 * Какой из разделов страницы сейчас «текущий»: первый из ids, который попал в рабочую полосу экрана
 * (ниже липких шапок и выше середины). Для подсветки пункта в якорной навигации.
 * Без IntersectionObserver подсветки просто нет.
 * @param {string[]} ids id элементов страницы в порядке следования
 * @returns {string|null}
 */
export function useScrollSpy(ids) {
  const [active, setActive] = useState(null);
  const key = ids.join('|');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const elements = key.split('|').map((id) => document.getElementById(id)).filter(Boolean);
    if (elements.length === 0) return undefined;

    const visible = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        const current = elements.find((element) => visible.has(element.id));
        if (current) setActive(current.id);
      },
      // Сверху вычитаем две липкие полосы (шапка сайта и якорная навигация), снизу — больше половины экрана
      { rootMargin: '-150px 0px -55% 0px' },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [key]);

  return active;
}
