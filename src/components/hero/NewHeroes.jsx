import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReleaseCountdown from './ReleaseCountdown';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { CURRENT_UPDATE } from '../../data/updates';
import { isReleaseWindow } from '../../services/releaseService';

// Таймер раз в минуту ничего не запрашивает сам — он лишь решает, пора ли проверить список героев.
// API бесплатный и с лимитом запросов, поэтому проверки идут только в «окно релиза» (минуты вокруг
// расписания Valve), и сам список при этом запрашивается не чаще раза в 4 минуты (см. loadHeroes).
const TICK_MS = 60 * 1000;
// Вкладка могла часами лежать в фоне: при возвращении освежаем данные один раз, если они совсем старые
const STALE_ON_RETURN_MS = 15 * 60 * 1000;

/**
 * Герои обновления: кто уже вышел, а кто ещё в голосовании. Полоса видна, пока хотя бы один герой
 * не вышел; статус и картинку каждого определяют данные API, поэтому вручную ничего отмечать не надо:
 * пока героя нет в игре, он показан круглым стикером голосования, а когда он вышел и у него появился
 * настоящий портрет — круг сам заменяется на него.
 * @param {{ heroes: Array<object> }} props — все герои (без фильтров поиска)
 */
function NewHeroes({ heroes }) {
  const t = useTranslation();

  const roster = CURRENT_UPDATE.heroIds
    .map((id) => heroes.find((hero) => hero.id === id))
    .filter(Boolean);
  const waiting = roster.filter((hero) => !hero.released).length;
  const hasWaiting = waiting > 0;

  // Не заставляем посетителя перезагружать страницу в момент релиза
  useEffect(() => {
    if (!hasWaiting) return undefined;
    const refresh = () => useHeroStore.getState().loadHeroes({ silent: true });

    const tick = () => {
      if (!document.hidden && isReleaseWindow(CURRENT_UPDATE.releases)) refresh();
    };
    const onVisible = () => {
      if (document.hidden) return;
      const { lastFetched } = useHeroStore.getState();
      if (!lastFetched || Date.now() - lastFetched > STALE_ON_RETURN_MS) refresh();
    };

    const id = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hasWaiting]);

  if (!hasWaiting) return null;

  return (
    <section className="new-heroes" id="new-heroes">
      <div className="new-heroes__head">
        <div className="new-heroes__intro">
          <span className="tag tag--role">{CURRENT_UPDATE.name}</span>
          <h2 className="new-heroes__title">{t('newHeroes.title', { left: waiting, total: roster.length })}</h2>
          <p className="new-heroes__sub">{t('newHeroes.schedule')}</p>
        </div>
        <ReleaseCountdown />
      </div>

      <div className="new-heroes__grid">
        {roster.map((hero) => (
          <Link
            key={hero.id}
            to={`/hero/${hero.id}`}
            className={`new-hero${hero.released ? ' new-hero--out' : ''}`}
            style={hero.color ? { '--hero-color': hero.color } : undefined}
          >
            <span className={`new-hero__art${hero.has_art ? ' new-hero__art--portrait' : ''}`}>
              {hero.image_url ? (
                <img src={hero.image_url} alt="" loading="lazy" />
              ) : (
                <span className="new-hero__initials">{hero.name.slice(0, 2)}</span>
              )}
            </span>
            <span className="new-hero__name">{hero.name}</span>
            <span className="new-hero__status">{hero.released ? t('newHeroes.out') : t('newHeroes.soon')}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default NewHeroes;
