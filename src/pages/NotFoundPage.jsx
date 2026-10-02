import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { useTranslation } from '../hooks/useTranslation';

// Разделы сайта: с неверного адреса человеку нужно не «ошибка», а следующий шаг
const SECTIONS = [
  { to: '/', key: 'nav.heroes' },
  { to: '/meta', key: 'nav.meta' },
  { to: '/matchups', key: 'nav.matchups' },
  { to: '/items', key: 'nav.items' },
  { to: '/map', key: 'nav.map' },
  { to: '/leaderboard', key: 'nav.leaderboard' },
  { to: '/players', key: 'nav.players' },
  { to: '/update', key: 'nav.update' },
];

/**
 * Страница для адресов, которых нет на сайте. Сервер отдаёт для них обычный index.html (код 200),
 * поэтому от индексации страницу закрываем сами — иначе поисковик посчитал бы её «мягкой» ошибкой 404.
 */
function NotFoundPage() {
  const t = useTranslation();
  usePageMeta('notFound', { noindex: true });

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
    </div>
  );
}

export default NotFoundPage;
