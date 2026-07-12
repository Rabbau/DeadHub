import { useHeroes } from '../hooks/useHeroes';
import { useCompareStore } from '../store/compareStore';
import { useTranslation } from '../hooks/useTranslation';
import { formatWinrate, formatPickrate, winrateColor } from '../services/heroService';

function ComparePage() {
  const { allHeroes, loading } = useHeroes();
  const { selectedIds, addHero, removeHero, replace, search, setSearch, history, applyHistory } = useCompareStore();
  const t = useTranslation();

  // Берём только героев с pickrate > 0
  const activeHeroes = allHeroes.filter(h => h.stats.pickrate > 0);
  const selectedHeroes = activeHeroes.filter(h => selectedIds.includes(h.id));
  const filteredHeroes = activeHeroes.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      removeHero(id);
    } else if (selectedIds.length < 3) {
      addHero(id);
    } else {
      const newIds = [...selectedIds.slice(1), id];
      replace(newIds);
    }
  };

  if (loading) {
    return (
      <div className="page state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="page compare-page">
      <h1 className="page-title">{t('compare.title')}</h1>

      {history.length > 0 && (
        <div className="compare-history">
          <h2 className="section__title">{t('compare.history')}</h2>
          <div className="compare-history__list">
            {history.map(entry => {
              const names = entry.ids
                .map(id => allHeroes.find(h => h.id === id)?.name)
                .filter(Boolean)
                .join(' vs ');
              return (
                <button
                  key={entry.key}
                  type="button"
                  className="compare-history__item"
                  onClick={() => applyHistory(entry.ids)}
                >
                  {names || entry.ids.join(', ')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="compare-container">
        {/* Панель выбранных героев */}
        <div className="compare-panel">
          {selectedHeroes.length === 0 && (
            <p className="compare-empty">{t('compare.selectHint')}</p>
          )}
          {selectedHeroes.map(hero => (
            <div key={hero.id} className="compare-hero-card">
              <img src={hero.image_url} alt={hero.name} />
              <span>{hero.name}</span>
              <button onClick={() => removeHero(hero.id)}>✕</button>
            </div>
          ))}
        </div>

        {/* Таблица сравнения */}
        {selectedHeroes.length > 0 ? (
          <div className="compare-table-wrapper">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>{t('compare.attribute')}</th>
                  {selectedHeroes.map((hero, idx) => (
                    <th key={hero.id} className={`col-hero-${idx}`}>
                      {hero.name}
                      <button className="compare-remove-btn" onClick={() => removeHero(hero.id)}>✕</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('compare.role')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>{hero.role || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.complexity')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>{hero.complexity || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.winrate')}</td>
                  {selectedHeroes.map((hero, idx) => {
                    const color = winrateColor(hero.stats.winrate);
                    return <td key={hero.id} className={`col-hero-${idx} winrate-${color}`}>{formatWinrate(hero.stats.winrate)}</td>;
                  })}
                </tr>
                <tr>
                  <td>{t('compare.pickrate')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>{formatPickrate(hero.stats.pickrate)}</td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.matches')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>{hero.stats.games_played.toLocaleString()}</td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.description')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>{hero.description || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.abilities')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      <ul className="compare-abilities">
                        {hero.abilities?.map((a, i) => <li key={i}>{a.name}</li>)}
                      </ul>
                    </td>
                  ))}
                </tr>
                {/* Новые строки */}
                <tr>
                  <td>{t('compare.health')}</td>
                  {selectedHeroes.map((hero, idx) => {
                    const base = hero.stats.maxHealth;
                    const perLevel = hero.levelScaling?.healthPerLevel;
                    return (
                      <td key={hero.id} className={`col-hero-${idx}`}>
                        {base !== null ? `${base}${perLevel ? ` + ${perLevel}${t('compare.perLevel')}` : ''}` : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>{t('compare.moveSpeed')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      {hero.stats.maxMoveSpeed ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.sprintSpeed')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      {hero.stats.sprintSpeed ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.stamina')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      {hero.stats.stamina ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.healthRegen')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      {hero.stats.healthRegen ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.lightMelee')}</td>
                  {selectedHeroes.map((hero, idx) => {
                    const base = hero.stats.lightMeleeDamage;
                    const perLevel = hero.levelScaling?.meleeDamagePerLevel;
                    return (
                      <td key={hero.id} className={`col-hero-${idx}`}>
                        {base !== null ? `${base}${perLevel ? ` + ${perLevel}${t('compare.perLevel')}` : ''}` : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>{t('compare.heavyMelee')}</td>
                  {selectedHeroes.map((hero, idx) => {
                    const base = hero.stats.heavyMeleeDamage;
                    const perLevel = hero.levelScaling?.meleeDamagePerLevel;
                    return (
                      <td key={hero.id} className={`col-hero-${idx}`}>
                        {base !== null ? `${base}${perLevel ? ` + ${perLevel}${t('compare.perLevel')}` : ''}` : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>{t('compare.groundDash')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      {hero.stats.groundDashDistance ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.airDash')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      {hero.stats.airDashDistance ?? '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.heroType')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      {hero.stats.heroType || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.tags')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      {hero.stats.tags?.join(', ') || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t('compare.gunTag')}</td>
                  {selectedHeroes.map((hero, idx) => (
                    <td key={hero.id} className={`col-hero-${idx}`}>
                      {hero.stats.gunTag || '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="compare-empty-state">{t('compare.selectAtLeastOne')}</p>
        )}

        {/* Список героев для выбора */}
        <div className="compare-hero-list">
          <input
            type="text"
            className="input"
            placeholder={t('compare.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="compare-hero-grid">
            {filteredHeroes.map(hero => {
              const isSelected = selectedIds.includes(hero.id);
              return (
                <div
                  key={hero.id}
                  className={`compare-select-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSelect(hero.id)}
                >
                  <img src={hero.image_url} alt={hero.name} />
                  <span>{hero.name}</span>
                  {isSelected && <span className="compare-check">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComparePage;