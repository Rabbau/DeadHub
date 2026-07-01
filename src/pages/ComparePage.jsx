import { useState } from 'react';
import { useHeroes } from '../hooks/useHeroes';
import { useCompareStore } from '../store/compareStore';
import { useTranslation } from '../hooks/useTranslation';
import { formatWinrate, formatPickrate, winrateColor } from '../services/heroService';

function ComparePage() {
  const { heroes, loading, search, setSearch } = useHeroes();
  const { selectedIds, addHero, removeHero, replace, clear } = useCompareStore();
  const t = useTranslation();

  const selectedHeroes = heroes.filter(h => selectedIds.includes(h.id));
  const filteredHeroes = heroes.filter(h =>
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