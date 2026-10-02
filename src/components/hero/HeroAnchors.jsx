import { useScrollSpy } from '../../hooks/useScrollSpy';

/**
 * Якорная навигация по длинной странице героя: липкая полоса со ссылками на разделы, текущий подсвечен.
 * Обычные ссылки на #раздел: адрес можно скопировать вместе с разделом, а плавную прокрутку делает браузер.
 * @param {{ items: Array<{ id: string, label: string }>, label: string }} props
 */
function HeroAnchors({ items, label }) {
  const active = useScrollSpy(items.map((item) => item.id));

  return (
    <nav className="hero-anchors" aria-label={label}>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={`chip hero-anchors__link${active === item.id ? ' active' : ''}`}
          aria-current={active === item.id ? 'location' : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export default HeroAnchors;
