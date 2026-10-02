import { useEffect, useState } from 'react';

/**
 * Становится true, когда элемент подошёл к экрану (и остаётся true). Нужен, чтобы тяжёлые запросы к
 * бесплатному API уходили только когда посетитель действительно дошёл до блока, а не при открытии страницы.
 * Без IntersectionObserver (старые браузеры) сразу true — блок просто загрузится как обычно.
 * @param {import('react').RefObject<Element>} ref
 * @param {string} [rootMargin] за сколько до появления на экране срабатывать
 */
export function useInView(ref, rootMargin = '300px') {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (seen) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin, seen]);

  return seen;
}
