import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Nav from './Nav'
import ErrorBoundary from './ErrorBoundary'
import { useHeroStore } from '../../store/heroStore'
import { useTranslation } from '../../hooks/useTranslation'
import { languageCode } from '../../services/siteMeta'

function Layout() {
  const t = useTranslation()
  const language = useHeroStore((state) => state.language)
  const { pathname } = useLocation()

  // Язык документа должен совпадать с языком интерфейса: от него зависят произношение скринридера,
  // перенос слов и автоперевод браузера
  useEffect(() => {
    document.documentElement.lang = languageCode(language)
  }, [language])

  return (
    <div className="layout">
      <Nav />
      <main className="layout__main">
        {/* Ошибка на странице не должна убирать меню: сбрасывается при переходе на другой адрес */}
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <span>{t('footer.text')}</span>
        <span aria-hidden="true">&bull;</span>
        <span>
          {t('footer.data')}{' '}
          <a href="https://deadlock-api.com" target="_blank" rel="noopener noreferrer">deadlock-api.com</a>
        </span>
      </footer>
    </div>
  )
}

export default Layout
