import { Fragment, createElement, useMemo, useState } from 'react';
import { ALLOWED_TAGS, DROP_TAGS, VOID_TAGS, safeHref, safeImageSrc } from '../../services/sanitize';

// Глубже заметки Steam не бывают; ограничение защищает от «бомб» из вложенных тегов
const MAX_DEPTH = 40;

/**
 * Картинка с запасным адресом. Steam указывает локализованный файл (english.png) и обычный как
 * data-fallback-src: если первого нет (так бывает), браузер Steam подставляет второй. Повторяем это
 * поведение обработчиком React, а не атрибутом onerror, и только для проверенных адресов.
 */
function RichImage({ src, fallback, alt }) {
  const [current, setCurrent] = useState(src);
  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => { if (fallback && current !== fallback) setCurrent(fallback); }}
    />
  );
}

/**
 * Узел DOM → React-элемент по белому списку. Разрешены только перечисленные теги, у них не остаётся
 * ни атрибутов (class, style, on*), ни произвольных адресов: у ссылки сохраняется проверенный href,
 * у картинки — проверенный src. Текст React экранирует сам.
 */
function convert(node, key, depth) {
  if (depth > MAX_DEPTH) return null;
  // Steam экранирует квадратные скобки обратным слэшем (\[ General ]) — показываем их как есть
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/\\([[\]])/g, '$1');
  if (node.nodeType !== Node.ELEMENT_NODE) return null; // комментарии и прочее

  const tag = node.tagName.toLowerCase();
  if (DROP_TAGS.has(tag)) return null;

  const children = convertChildren(node, depth + 1);
  if (!ALLOWED_TAGS.has(tag)) return <Fragment key={key}>{children}</Fragment>;

  if (tag === 'a') {
    const href = safeHref(node.getAttribute('href'));
    if (!href) return <Fragment key={key}>{children}</Fragment>;
    return (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    );
  }

  if (tag === 'img') {
    const src = safeImageSrc(node.getAttribute('src'));
    const fallback = safeImageSrc(node.getAttribute('data-fallback-src'));
    if (!src && !fallback) return null;
    return <RichImage key={`${key}-${src ?? fallback}`} src={src ?? fallback} fallback={fallback} alt={node.getAttribute('alt') || ''} />;
  }

  return VOID_TAGS.has(tag) ? createElement(tag, { key }) : createElement(tag, { key }, children);
}

function convertChildren(parent, depth) {
  return Array.from(parent.childNodes).map((child, index) => convert(child, index, depth));
}

/**
 * Показывает HTML из внешнего источника (заметки об обновлениях) безопасно и в стиле сайта.
 * DOMParser строит «мёртвый» документ: скрипты в нём не выполняются, картинки не загружаются.
 */
function RichHtml({ html, className = '' }) {
  const content = useMemo(() => {
    if (!html) return null;
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    return convertChildren(doc.body, 0);
  }, [html]);

  return <div className={`rich ${className}`.trim()}>{content}</div>;
}

export default RichHtml;
