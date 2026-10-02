import NotFoundView from '../components/layout/NotFoundView';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * Страница для адресов, которых нет на сайте. Сервер отдаёт для них обычный index.html (код 200),
 * поэтому от индексации страницу закрываем сами — иначе поисковик посчитал бы её «мягкой» ошибкой 404.
 */
function NotFoundPage() {
  usePageMeta('notFound', { noindex: true });
  return <NotFoundView />;
}

export default NotFoundPage;
