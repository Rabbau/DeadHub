import { useTranslation } from '../../hooks/useTranslation'

/** Что показывать, пока скачивается код страницы (React.lazy): тот же спиннер, что и при загрузке данных. */
function PageFallback() {
  const t = useTranslation()
  return (
    <div className="page state-center" role="status">
      <div className="spinner" />
      <p>{t('common.loading')}</p>
    </div>
  )
}

export default PageFallback
