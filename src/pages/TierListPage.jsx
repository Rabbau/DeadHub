import DataTierList from '../components/tierlist/DataTierList';
import TierBuilder from '../components/tierlist/TierBuilder';
import { useStoredChoice } from '../hooks/useStoredChoice';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';

const TABS = [
  { id: 'data', key: 'tierList.tabData' },
  { id: 'builder', key: 'tierList.tabBuilder' },
];

/**
 * Тир-лист двух видов: по данным (считается из статистики по открытой формуле) и конструктор,
 * где героев расставляют вручную. Вид запоминается.
 */
function TierListPage() {
  const t = useTranslation();
  usePageMeta('tierlist');
  const [tab, setTab] = useStoredChoice('dlhub_tierlist_tab', TABS.map((item) => item.id), 'data');

  return (
    <div className="page tierlist-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('tierList.title')}</h1>
          <div className="page-subtitle">{t(tab === 'data' ? 'tierList.subtitleData' : 'tierList.subtitleBuilder')}</div>
        </div>
        <div className="chip-group" role="group" aria-label={t('tierList.tabsLabel')}>
          {TABS.map(({ id, key }) => (
            <button
              key={id}
              type="button"
              className={`chip ${tab === id ? 'active' : ''}`}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'data' ? <DataTierList /> : <TierBuilder />}
    </div>
  );
}

export default TierListPage;
