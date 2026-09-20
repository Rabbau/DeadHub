/**
 * Маленькая иконка героя (~10 КБ) для списков и таблиц: большая карточка весит ~100 КБ.
 * Без картинки показывает первые две буквы имени. size: xs | sm | md | lg.
 * decorative — когда имя героя рядом уже написано текстом (иконка не озвучивается).
 */
function HeroIcon({ hero, size = 'md', decorative = false }) {
  const url = hero?.icon_url || hero?.image_url;
  const name = hero?.name ?? '?';
  const className = `hero-icon hero-icon--${size}`;

  if (!url) {
    return <span className={`${className} hero-icon--empty`} aria-hidden={decorative || undefined}>{name.slice(0, 2)}</span>;
  }
  return <img src={url} alt={decorative ? '' : name} className={className} loading="lazy" />;
}

export default HeroIcon;
