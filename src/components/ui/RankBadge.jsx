import { useRanks } from '../../hooks/useRanks';
import { useTranslation } from '../../hooks/useTranslation';
import { badgeImage, formatBadge } from '../../services/rankService';

/** Бейдж ранга: картинка (если есть) и название вроде «Oracle 6». size: md | lg. */
function RankBadge({ badge, size = 'md' }) {
  const ranks = useRanks();
  const t = useTranslation();

  if (!badge) {
    return <span className={`rank-badge rank-badge--${size} rank-badge--empty`}>{t('player.unranked')}</span>;
  }

  const image = badgeImage(ranks, badge);
  return (
    <span className={`rank-badge rank-badge--${size}`}>
      {image && <img src={image} alt="" className="rank-badge__img" loading="lazy" />}
      <span className="rank-badge__label">{formatBadge(ranks, badge)}</span>
    </span>
  );
}

export default RankBadge;
