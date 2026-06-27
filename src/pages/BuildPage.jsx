import { useRandomBuild } from '../hooks/useRandomBuild';
import ItemCard from '../components/ui/ItemCard';
import { useTranslation } from '../hooks/useTranslation';

function BuildPage() {
  const { build, loading, generate } = useRandomBuild();
  const t = useTranslation();

  return (
    <div className="page build-page">
      <h1 className="page-title">{t('buildPage.title')}</h1>
      <p className="build-page__intro">
        {t('buildPage.description')}
      </p>

      <button className="btn btn-primary" onClick={generate} disabled={loading}>
        {loading ? t('common.loading') : t('buildPage.generate')}
      </button>

      {build && (
        <div className="build-card">
          <div className="build-card__hero">
            {build.hero.image_url ? (
              <img src={build.hero.image_url} alt={build.hero.name} className="build-card__hero-img" />
            ) : (
              <div className="build-card__hero-placeholder">{build.hero.name.slice(0, 2)}</div>
            )}
            <div>
              <div className="build-card__hero-name">{build.hero.name}</div>
              <div className="build-card__hero-role">{build.hero.role || '—'}</div>
            </div>
          </div>

          <div className="build-card__items">
            {build.items.map(item => <ItemCard key={item.id} item={item} compact={true} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default BuildPage;