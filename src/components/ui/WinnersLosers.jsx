import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import HeroIcon from '../hero/HeroIcon';
import DeltaBadge from './DeltaBadge';
import DeltaNote from './DeltaNote';
import { useTranslation } from '../../hooks/useTranslation';
import { winnersLosers } from '../../services/deltaService';
import { formatWinrate } from '../../services/heroService';

const LIST_SIZE = 5;

function Row({ hero, delta }) {
  return (
    <Link to={`/hero/${hero.id}`} className="meta-row">
      <HeroIcon hero={hero} size="sm" decorative />
      <span className="meta-row__name">{hero.name}</span>
      <span className="winners-losers__wr">{formatWinrate(delta.wr0)} → {formatWinrate(delta.wr0 + delta.dWr)}</span>
      <span className="meta-row__value"><DeltaBadge delta={delta} /></span>
    </Link>
  );
}

/**
 * «Победители и проигравшие»: герои, у которых винрейт значимо вырос и значимо упал по сравнению
 * с прошлым периодом. В списки попадают только изменения за пределами случайного шума (см. deltaService).
 * @param {{ heroes: Array<object>, deltas: object|null, window: object|null, loading: boolean }} props
 */
function WinnersLosers({ heroes, deltas, window, loading }) {
  const t = useTranslation();
  const { winners, losers } = useMemo(() => winnersLosers(deltas, { count: LIST_SIZE }), [deltas]);
  const byId = useMemo(() => new Map(heroes.filter((hero) => hero.released).map((hero) => [hero.id, hero])), [heroes]);

  const rows = (list) => list
    .filter((entry) => byId.has(entry.id))
    .map((entry) => <Row key={entry.id} hero={byId.get(entry.id)} delta={entry} />);

  let body;
  if (!deltas) {
    // Либо ещё считается, либо сравнивать не с чем (нет предыдущего обновления)
    body = <p className="delta-note">{loading ? t('common.loading') : t('delta.unavailable')}</p>;
  } else if (!winners.length && !losers.length) {
    body = <p className="delta-note">{t('delta.noneSignificant')}</p>;
  } else {
    body = (
      <div className="meta-grid">
        <div className="meta-panel">
          <h3 className="winners-losers__heading winners-losers__heading--up">▲ {t('delta.winners')}</h3>
          <div className="meta-list">{rows(winners)}</div>
        </div>
        <div className="meta-panel">
          <h3 className="winners-losers__heading winners-losers__heading--down">▼ {t('delta.losers')}</h3>
          <div className="meta-list">{rows(losers)}</div>
        </div>
      </div>
    );
  }

  return (
    <section className="section winners-losers">
      <h2 className="section__title">{t('delta.winnersTitle')}</h2>
      <DeltaNote window={window} />
      {body}
    </section>
  );
}

export default WinnersLosers;
