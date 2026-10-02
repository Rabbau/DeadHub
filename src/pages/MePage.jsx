import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import { useProfileStore } from '../store/profileStore';
import { toAccountId } from '../services/playerService';

/**
 * «Мой профиль»: если профиль уже запомнен — открывает его; иначе предлагает указать Account ID, SteamID64 или
 * ссылку на профиль Steam (их можно ввести сразу) либо найти себя по нику и нажать «Это я» на странице игрока.
 * Страница личная, поэтому закрыта от индексации.
 */
function MePage() {
  const t = useTranslation();
  usePageMeta('me', { noindex: true });
  const navigate = useNavigate();
  const me = useProfileStore((state) => state.me);
  const setMe = useProfileStore((state) => state.setMe);
  const [input, setInput] = useState('');

  if (me) return <Navigate to={`/player/${me.id}`} replace />;

  const submit = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    const accountId = toAccountId(text);
    if (accountId) {
      // Имя и аватар подтянутся со страницы игрока, когда посетитель нажмёт «Это я»; ID запоминаем сразу
      setMe({ id: accountId });
      navigate(`/player/${accountId}`, { replace: true });
    } else {
      navigate(`/players?q=${encodeURIComponent(text)}`);
    }
  };

  return (
    <div className="page me-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('me.title')}</h1>
          <div className="page-subtitle">{t('me.subtitle')}</div>
        </div>
      </div>

      <form className="player-search" onSubmit={submit} role="search">
        <div className="filters__search">
          <span className="filters__search-icon" aria-hidden="true">&gt;</span>
          <input
            type="text"
            className="input"
            placeholder={t('me.placeholder')}
            aria-label={t('me.placeholder')}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn-primary">{t('me.submit')}</button>
      </form>
      <p className="player-search__hint">{t('me.hint')}</p>
      <p className="player-search__hint">{t('me.privacy')}</p>
    </div>
  );
}

export default MePage;
