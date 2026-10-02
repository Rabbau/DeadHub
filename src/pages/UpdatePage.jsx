import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RichHtml from '../components/ui/RichHtml';
import { usePatches } from '../hooks/usePatches';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import { useHeroStore } from '../store/heroStore';
import { CURRENT_UPDATE, OFFICIAL_UPDATE_URL, isHighlightsActive } from '../data/updates';
import { formatShortDate, localeFor } from '../services/format';
import { patchName } from '../services/patchService';

/** «3 дня назад» / «3 days ago». */
function relativeAge(unixSeconds, language) {
  const days = Math.max(0, Math.round((Date.now() / 1000 - unixSeconds) / 86400));
  const rtf = new Intl.RelativeTimeFormat(localeFor(language), { numeric: 'auto' });
  return days < 60 ? rtf.format(-days, 'day') : rtf.format(-Math.round(days / 30), 'month');
}

function OfficialLinks({ post }) {
  const t = useTranslation();
  return (
    <div className="update-hero__actions">
      <a className="btn btn-primary" href={OFFICIAL_UPDATE_URL} target="_blank" rel="noopener noreferrer">
        {t('update.openOfficial')} ↗
      </a>
      {post && (
        <a className="btn btn-secondary" href={post} target="_blank" rel="noopener noreferrer">
          {t('update.steamPost')} ↗
        </a>
      )}
    </div>
  );
}

function Highlights() {
  const t = useTranslation();
  return (
    <section className="section">
      <h2 className="section__title">{t('update.highlightsTitle', { name: CURRENT_UPDATE.name })}</h2>
      <div className="update-highlights">
        {CURRENT_UPDATE.highlights.map(({ key, to }) => {
          const body = (
            <>
              <h3 className="update-card__title">{t(`update.highlights.${key}.title`)}</h3>
              <p className="update-card__text">{t(`update.highlights.${key}.text`)}</p>
              {to && <span className="update-card__go">{t('update.open')} →</span>}
            </>
          );
          return to ? (
            <Link key={key} to={to} className="update-card update-card--link">{body}</Link>
          ) : (
            <div key={key} className="update-card">{body}</div>
          );
        })}
      </div>
    </section>
  );
}

function UpdatePage() {
  const t = useTranslation();
  usePageMeta('update');
  const language = useHeroStore((state) => state.language);
  const markUpdateSeen = useHeroStore((state) => state.markUpdateSeen);
  const { patches, loading, error } = usePatches();
  const [opened, setOpened] = useState({});

  const latest = patches[0] ?? null;
  const earlier = patches.slice(1);

  // Пользователь увидел последнее обновление — значок NEW в меню больше не нужен
  useEffect(() => {
    if (latest) markUpdateSeen(latest.id);
  }, [latest, markUpdateSeen]);

  return (
    <div className="page update-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('update.title')}</h1>
          <div className="page-subtitle">{t('update.subtitle')}</div>
        </div>
      </div>

      <section className="update-hero">
        {latest ? (
          <>
            <span className="tag tag--role">{t('update.latest')}</span>
            <h2 className="update-hero__title">{patchName(latest.title)}</h2>
            <p className="update-hero__meta">
              {formatShortDate(latest.at, language)} · {relativeAge(latest.at, language)}
            </p>
          </>
        ) : (
          !loading && <p className="update-hero__meta">{error ? t('update.loadError') : t('update.empty')}</p>
        )}
        <OfficialLinks post={latest?.link} />
        <p className="update-hero__note">{t('update.noEmbed')}</p>
      </section>

      {loading && (
        <div className="state-center">
          <div className="spinner" />
          <p>{t('common.loading')}</p>
        </div>
      )}

      {isHighlightsActive() && <Highlights />}

      {latest && (
        <section className="section">
          <h2 className="section__title">{t('update.announcement')}</h2>
          <RichHtml html={latest.html} className="update-body update-body--box" />
        </section>
      )}

      {earlier.length > 0 && (
        <section className="section">
          <h2 className="section__title">{t('update.earlier')} ({earlier.length})</h2>
          <div className="update-list">
            {earlier.map((patch) => (
              <details
                key={patch.id}
                className="update-item"
                onToggle={(event) => {
                  const isOpen = event.currentTarget.open;
                  setOpened((prev) => (prev[patch.id] === isOpen ? prev : { ...prev, [patch.id]: isOpen }));
                }}
              >
                <summary className="update-item__summary">
                  <span className="update-item__title">{patchName(patch.title)}</span>
                  <span className="update-item__date">{formatShortDate(patch.at, language)}</span>
                </summary>
                {/* Текст разбираем только у раскрытых обновлений: у некоторых заметки по 17 КБ */}
                {opened[patch.id] && <RichHtml html={patch.html} className="update-body" />}
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default UpdatePage;
