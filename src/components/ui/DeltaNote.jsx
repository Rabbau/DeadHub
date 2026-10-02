import { useHeroStore } from '../../store/heroStore';
import { useTranslation } from '../../hooks/useTranslation';
import { formatShortDate } from '../../services/format';
import { patchName } from '../../services/patchService';

const DAY_S = 24 * 60 * 60;

/**
 * Подпись к колонке Δ: с чем именно сравниваются цифры и что значат стрелки.
 * @param {{ window: { since: number, until: number, kind: 'patch'|'days', title?: string }|null }} props
 */
function DeltaNote({ window }) {
  const t = useTranslation();
  const language = useHeroStore((state) => state.language);
  if (!window) return null;

  const vs = window.kind === 'patch'
    ? t('delta.vsPatch', { name: `${patchName(window.title)} · ${formatShortDate(window.since, language)}` })
    : t('delta.vsDays', { count: Math.round((window.until - window.since) / DAY_S) });

  return <p className="delta-note">{t('delta.note', { vs })}</p>;
}

export default DeltaNote;
