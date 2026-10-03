import { Component } from 'react';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useTranslation } from '../../hooks/useTranslation';

/** Экран ошибки: понятное сообщение и два пути дальше. Сама ошибка — под спойлером для тех, кто о ней сообщит. */
function ErrorScreen({ error }) {
  const t = useTranslation();
  usePageMeta('error', { noindex: true });

  return (
    <div className="page not-found" role="alert">
      <div className="not-found__code" aria-hidden="true">!</div>
      <h1 className="page-title">{t('errorPage.title')}</h1>
      <p className="not-found__text">{t('errorPage.text')}</p>
      <div className="not-found__actions">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t('errorPage.reload')}
        </button>
        {/* Обычная ссылка, а не Link: полная загрузка сбрасывает и состояние, из-за которого страница упала */}
        <a href="/" className="btn btn-secondary">{t('errorPage.home')}</a>
      </div>
      {error?.message && (
        <details className="not-found__details">
          <summary>{t('errorPage.details')}</summary>
          <pre>{String(error.message)}</pre>
        </details>
      )}
      <img className="not-found__troopers" src="/art/troopers.webp" alt="" width="820" height="465" loading="lazy" decoding="async" />
    </div>
  );
}

/**
 * Не даёт ошибке в одном компоненте оставить пустой экран: показывает ErrorScreen.
 * resetKey — например, адрес страницы: при переходе на другую страницу ошибка сбрасывается,
 * и меню, которое осталось на месте, снова работает.
 */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children;
  }
}

export default ErrorBoundary;
