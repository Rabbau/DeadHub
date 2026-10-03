import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';

// Разделы сайта: с неверного адреса человеку нужно не «ошибка», а следующий шаг
const SECTIONS = [
  { to: '/heroes', key: 'nav.heroes' },
  { to: '/meta', key: 'nav.meta' },
  { to: '/matchups', key: 'nav.matchups' },
  { to: '/items', key: 'nav.items' },
  { to: '/map', key: 'nav.map' },
  { to: '/leaderboard', key: 'nav.leaderboard' },
  { to: '/players', key: 'nav.players' },
  { to: '/update', key: 'nav.update' },
];

/**
 * Экран «такой страницы нет»: пояснение и ссылки на разделы сайта. Только вид — заголовок вкладки и запрет
 * индексации выставляет тот, кто его показывает (NotFoundPage для неизвестных адресов, страница героя
 * для несуществующего id).
 */
function NotFoundView() {
  const t = useTranslation();

  return (
    <div className="page not-found">
      <div className="not-found__code" aria-hidden="true">404</div>
      <h1 className="page-title">{t('notFound.title')}</h1>
      <p className="not-found__text">{t('notFound.text')}</p>
      <div className="chip-group">
        {SECTIONS.map(({ to, key }) => (
          <Link key={to} to={to} className="chip">{t(key)}</Link>
        ))}
      </div>
      <div className="not-found__actions">
        <Link to="/" className="btn btn-primary">{t('notFound.home')}</Link>
      </div>
      <img className="not-found__troopers" src="/art/troopers.webp" alt="" width="820" height="465" loading="lazy" decoding="async" />
    </div>
  );
}

export default NotFoundView;
