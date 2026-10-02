import { Fragment, createElement, useId, useMemo } from 'react';
import {
  SVG_TAGS,
  TOOLTIP_DROP_TAGS,
  TOOLTIP_TAGS,
  safeClassName,
  safeSvgProps,
  safeTextColor,
  safeTooltipImageSrc,
} from '../../services/sanitize';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// В настоящих описаниях вложенность не глубже пяти, разметки — до 25 узлов, текста — до 9 000 знаков.
// Пределы с большим запасом защищают от «бомбы» из вложенных тегов и от огромной строки
const MAX_DEPTH = 12;
const MAX_NODES = 1500;
const MAX_HTML_LENGTH = 40_000;

function attributesOf(node) {
  return Object.fromEntries(Array.from(node.attributes, (attribute) => [attribute.name, attribute.value]));
}

/**
 * Узел DOM → React-элемент по белому списку (правила — services/sanitize.js). Разрешены только перечисленные теги
 * и атрибуты с проверенными значениями; обработчики, ссылки и style (кроме цвета текста) не переносятся никогда.
 * Текст React экранирует сам.
 */
function convert(node, key, depth, context) {
  if (depth > MAX_DEPTH || context.budget <= 0) return null;
  context.budget -= 1;

  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (node.nodeType !== Node.ELEMENT_NODE) return null; // комментарии и прочее

  const tag = node.localName.toLowerCase();

  // Иконки SVG: неизвестный элемент внутри них (script, style, foreignObject, use, a…) выбрасывается с содержимым
  if (node.namespaceURI === SVG_NAMESPACE) {
    const name = SVG_TAGS.get(tag);
    if (!name) return null;
    const props = { key, ...safeSvgProps(attributesOf(node), context.idPrefix) };
    // Иконка стоит рядом с подписью, сама по себе ничего не сообщает
    if (name === 'svg') Object.assign(props, { 'aria-hidden': 'true', focusable: 'false' });
    return createElement(name, props, convertChildren(node, depth + 1, context));
  }

  if (TOOLTIP_DROP_TAGS.has(tag)) return null;
  // Неизвестные теги (в данных — «Panel» из интерфейса игры) разворачиваются: остаётся то, что внутри
  if (!TOOLTIP_TAGS.has(tag)) return <Fragment key={key}>{convertChildren(node, depth + 1, context)}</Fragment>;

  if (tag === 'br') return createElement('br', { key });

  const className = safeClassName(node.getAttribute('class')) ?? undefined;

  if (tag === 'img') {
    const src = safeTooltipImageSrc(node.getAttribute('src'));
    if (!src) return null;
    // alt пустой: рядом всегда стоит подпись с тем же текстом, иначе скринридер читал бы её дважды
    return createElement('img', { key, src, alt: '', className, loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer' });
  }

  const props = { key, className };
  if (tag === 'span') {
    const color = safeTextColor(node.getAttribute('style'));
    if (color) props.style = { color };
  }
  return createElement(tag, props, convertChildren(node, depth + 1, context));
}

function convertChildren(parent, depth, context) {
  return Array.from(parent.childNodes).map((child, index) => convert(child, index, depth, context));
}

/**
 * Показывает описание способности: HTML из API (цветные выделения, значки, иконки SVG) выводится по белому
 * списку, не через dangerouslySetInnerHTML. DOMParser строит «мёртвый» документ: скрипты в нём не выполняются,
 * картинки не загружаются. Идентификаторы внутри SVG получают уникальный префикс экземпляра.
 * @param {{ html: string, className?: string }} props
 */
function TooltipHtml({ html, className = '' }) {
  const id = useId();

  const content = useMemo(() => {
    const source = String(html ?? '').slice(0, MAX_HTML_LENGTH);
    if (!source) return null;
    const doc = new DOMParser().parseFromString(source, 'text/html');
    // useId в React 18 даёт «:r1:» — двоеточия в ссылках url(#…) не нужны
    const idPrefix = `tt${id.replace(/[^A-Za-z0-9]/g, '')}-`;
    return convertChildren(doc.body, 0, { budget: MAX_NODES, idPrefix });
  }, [html, id]);

  return <div className={className || undefined}>{content}</div>;
}

export default TooltipHtml;
