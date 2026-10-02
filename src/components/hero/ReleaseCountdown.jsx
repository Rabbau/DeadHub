import { useNow } from '../../hooks/useNow';
import { useTranslation } from '../../hooks/useTranslation';
import { useHeroStore } from '../../store/heroStore';
import { CURRENT_UPDATE } from '../../data/updates';
import { localeFor } from '../../services/format';
import { nextRelease, splitDuration } from '../../services/releaseService';

/**
 * Ближайший релиз героя по расписанию Valve: когда (по времени посетителя) и сколько осталось.
 * Расписание — «по заявлению Valve»: дата может сдвинуться, поэтому подпись это оговаривает.
 */
function ReleaseCountdown() {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  const now = useNow(30000);

  const at = nextRelease(CURRENT_UPDATE.releases, now);
  if (at == null) return null;

  const { days, hours, minutes } = splitDuration(at - now);
  const parts = days > 0
    ? [[days, 'd'], [hours, 'h']]
    : hours > 0
      ? [[hours, 'h'], [minutes, 'm']]
      : [[minutes, 'm']];
  // Фраза «через {time}» собирается вокруг цифр: единицы измерения выводятся отдельно обычным шрифтом.
  // В пиксельном шрифте кириллическая «Ч» неотличима от «4», и «12ч 47м» читалось как «124 47м».
  const [before, after] = t('newHeroes.inTime', { time: '|' }).split('|');

  const when = new Date(at).toLocaleString(localeFor(language), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="release-countdown">
      <div className="stat-card__label">{t('newHeroes.nextRelease')}</div>
      <div className="release-countdown__left">
        {before}
        {parts.map(([value, unit]) => (
          <span key={unit} className="release-countdown__part">
            {value}<span className="release-countdown__unit">{t(`countdown.${unit}`)}</span>{' '}
          </span>
        ))}
        {after}
      </div>
      <div className="release-countdown__when">{when} · {t('newHeroes.scheduled')}</div>
    </div>
  );
}

export default ReleaseCountdown;
