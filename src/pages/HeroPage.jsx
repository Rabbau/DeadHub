import { useParams, Link } from 'react-router-dom';
import { useHeroDetail } from '../hooks/useHeroDetail';
import { formatWinrate, formatPickrate, winrateColor } from '../services/heroService';
import { useHeroStore } from '../store/heroStore';
import { useTranslation } from '../hooks/useTranslation';

function getAbilityDescription(ability) {
  const desc = ability.description;
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (typeof desc === 'object') {
    return desc.desc || desc.active || desc.passive || '';
  }
  return '';
}

function getComplexityKey(complexity) {
  if (complexity === 1) return 'heroPage.complexity1';
  if (complexity === 2) return 'heroPage.complexity2';
  if (complexity === 3) return 'heroPage.complexity3';
  if (complexity === 4) return 'heroPage.complexity4';
  return null;
}

function HeroPage() {
  const { id } = useParams();
  const language = useHeroStore(state => state.language);
  const { hero, loading, error } = useHeroDetail(id, language);
  const t = useTranslation();

  if (loading) {
    return (
      <div className="page state-center">
        <div className="spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !hero) {
    return (
      <div className="state-center state-error">
        ⚠️ {t('common.error')}: {error || t('heroPage.noHeroFound')}
      </div>
    );
  }

  const wrColor = winrateColor(hero.stats.winrate);
  const s = hero.stats;
  const ls = hero.levelScaling || {};

  // Важные ключи свойств для отображения
  const importantProps = [
    'Damage', 'Cooldown', 'Radius', 'Duration', 'CastRange',
    'DPS', 'Charges', 'Heal', 'FireRate', 'Slow', 'Lifesteal',
    'StunDuration', 'BurnDuration', 'DebuffDuration', 'ExplodeDelay',
    'FlameAuraRadius', 'GroundFlameDuration', 'SlowDuration',
    'IncomingDamagePercentFromCaster', 'TechPower'
  ];

  // Функция перевода ключа свойства
  const translatePropKey = (key) => {
    const translated = t(`abilityProps.${key}`);
    return translated === `abilityProps.${key}` ? key : translated;
  };

  // Функция форматирования улучшений с переводом
  const formatUpgrade = (upgrade) => {
    if (!upgrade.property_upgrades || upgrade.property_upgrades.length === 0) return null;
    return upgrade.property_upgrades.map((u) => {
      const name = u.name;
      const bonus = u.bonus;
      let displayBonus = bonus;
      if (typeof bonus === 'number') {
        displayBonus = bonus > 0 ? `+${bonus}` : `${bonus}`;
      }
      const translatedName = translatePropKey(name);
      return `${translatedName}: ${displayBonus}`;
    }).join(', ');
  };

  // Фильтруем свойства для отображения
  const getDisplayProps = (props) => {
    return Object.entries(props).filter(([key, prop]) => {
      const value = prop.value;
      if (value === undefined || value === null || value === '' || value === '0' || value === '0m' || value === '0s') return false;
      if (key.startsWith('Ability') && !['AbilityCharges', 'AbilityCooldown', 'AbilityDuration', 'AbilityCastRange'].includes(key)) return false;
      return true;
    });
  };

  return (
    <div className="hero-page-wrapper" style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Фоновый слой с градиентом */}
      <div
        className="hero-page-bg"
        style={{
          position: 'absolute',
          inset: 0,
          background: hero.color
            ? `radial-gradient(ellipse at 30% 20%, ${hero.color} 0%, transparent 70%)`
            : 'none',
          opacity: 0.08,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="page" style={{ position: 'relative', zIndex: 1 }}>
        <Link to="/" className="back-link">{t('heroPage.back')}</Link>

        <div className="hero-detail">
          <div className="hero-detail__portrait">
            {hero.image_url ? (
              <img src={hero.image_url} alt={hero.name} />
            ) : (
              <div className="hero-detail__portrait-placeholder">{hero.name.slice(0, 2)}</div>
            )}
          </div>

          <div className="hero-detail__info">
            <h1 className="hero-detail__name">{hero.name}</h1>
            <div className="hero-detail__meta">
              {hero.role && <span className="tag tag--role">{hero.role}</span>}
              {getComplexityKey(hero.complexity) && (
                <span className="tag tag--complexity">{t(getComplexityKey(hero.complexity))}</span>
              )}
            </div>

            <div className="hero-detail__stats-row">
              <div className="stat-card">
                <div className="stat-card__label">{t('heroPage.winrate')}</div>
                <div className={`stat-card__value winrate-${wrColor}`}>
                  {hero.stats.games_played > 0 ? formatWinrate(hero.stats.winrate) : '—'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">{t('heroPage.pickrate')}</div>
                <div className="stat-card__value">
                  {hero.stats.games_played > 0 ? formatPickrate(hero.stats.pickrate) : '—'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">{t('heroPage.matches')}</div>
                <div className="stat-card__value">{hero.stats.games_played.toLocaleString()}</div>
              </div>
            </div>

            {hero.description && (
              <p className="hero-detail__description">{hero.description}</p>
            )}

            {/* Блок со статами */}
            <div className="hero-stats-section">
              <h2 className="section__title">{t('heroPage.baseStats')}</h2>
              <div className="hero-stats-grid">
                {/* Weapon Stats - оранжевый блок */}
                <div className="hero-stats-card weapon-block">
                  <h3 className="hero-stats-card__title">{t('heroPage.weaponStats')}</h3>
                  <ul className="hero-stats-list">
                    <li><span>{t('heroPage.bulletDamage')}</span> <strong>{s.bulletDamage ?? '—'}</strong></li>
                    <li><span>{t('heroPage.ammo')}</span> <strong>{s.clipSize ?? '—'}</strong></li>
                    <li><span>{t('heroPage.shotsPerSecond')}</span> <strong>{s.roundsPerSecond ? s.roundsPerSecond.toFixed(2) : '—'}</strong></li>
                    <li><span>{t('heroPage.reloadTime')}</span> <strong>{s.reloadTime ? `${s.reloadTime.toFixed(2)}s` : '—'}</strong></li>
                    <li><span>{t('heroPage.lightMelee')}</span> <strong>{s.lightMeleeDamage ?? '—'}</strong></li>
                    <li><span>{t('heroPage.heavyMelee')}</span> <strong>{s.heavyMeleeDamage ?? '—'}</strong></li>
                  </ul>
                </div>

                {/* Vitality Stats - зелёный блок */}
                <div className="hero-stats-card vitality-block">
                  <h3 className="hero-stats-card__title">{t('heroPage.vitalityStats')}</h3>
                  <ul className="hero-stats-list">
                    <li><span>{t('heroPage.maxHealth')}</span> <strong>{s.maxHealth ?? '—'}</strong></li>
                    <li><span>{t('heroPage.moveSpeed')}</span> <strong>{s.maxMoveSpeed ?? '—'} m/s</strong></li>
                    <li><span>{t('heroPage.sprintSpeed')}</span> <strong>{s.sprintSpeed ?? '—'} m/s</strong></li>
                    <li><span>{t('heroPage.stamina')}</span> <strong>{s.stamina ?? '—'}</strong></li>
                    <li><span>{t('heroPage.healthRegen')}</span> <strong>{s.healthRegen ?? '—'}</strong></li>
                    <li><span>{t('heroPage.staminaCooldown')}</span> <strong>{s.staminaCooldown ? `${s.staminaCooldown.toFixed(2)}s` : '—'}</strong></li>
                  </ul>
                </div>

                {/* Growth Stats - нейтральный */}
                <div className="hero-stats-card">
                  <h3 className="hero-stats-card__title">{t('heroPage.growthStats')}</h3>
                  <ul className="hero-stats-list">
                    <li><span>{t('heroPage.healthPerLevel')}</span> <strong>{ls.healthPerLevel ? `+${ls.healthPerLevel}` : '—'}</strong></li>
                    <li><span>{t('heroPage.bulletDamagePerLevel')}</span> <strong>{ls.bulletDamagePerLevel ? `+${ls.bulletDamagePerLevel.toFixed(2)}` : '—'}</strong></li>
                    <li><span>{t('heroPage.meleeDamagePerLevel')}</span> <strong>{ls.meleeDamagePerLevel ? `+${ls.meleeDamagePerLevel.toFixed(2)}` : '—'}</strong></li>
                    <li><span>{t('heroPage.techPowerPerLevel')}</span> <strong>{ls.techPowerPerLevel ? `+${ls.techPowerPerLevel.toFixed(2)}` : '—'}</strong></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="section">
              <h2 className="section__title">{t('heroPage.abilities')}</h2>
              {hero.abilities && hero.abilities.length > 0 ? (
                <div className="abilities-list">
                  {hero.abilities.map((ability, idx) => {
                    const descText = getAbilityDescription(ability);
                    const props = ability.properties || {};
                    const upgrades = ability.upgrades || [];
                    const displayProps = getDisplayProps(props);

                    return (
                      <div className="ability-card" key={idx}>
                        {ability.image_url ? (
                          <img
                            src={ability.image_url}
                            alt={ability.name}
                            className="ability-card__icon-img"
                          />
                        ) : (
                          <div className="ability-card__icon">{ability.name.slice(0, 2)}</div>
                        )}
                        <div className="ability-card__content">
                          <div className="ability-card__name">{ability.name}</div>
                          {descText && (
                            <div
                              className="ability-card__desc"
                              dangerouslySetInnerHTML={{ __html: descText }}
                            />
                          )}

                          {/* Свойства */}
                          {displayProps.length > 0 && (
                            <div className="ability-card__props">
                              {displayProps.map(([key, prop]) => {
                                const value = prop.value;
                                const label = translatePropKey(key);
                                return (
                                  <span key={key} className="ability-card__prop">
                                    <span className="ability-card__prop-label">{label}</span>
                                    <span className="ability-card__prop-value">{value}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Улучшения (t1, t2, t3) */}
                          {upgrades.length > 0 && (
                            <div className="ability-card__upgrades">
                              {upgrades.map((upgrade, i) => {
                                const text = formatUpgrade(upgrade);
                                if (!text) return null;
                                return (
                                  <div key={i} className="ability-card__upgrade">
                                    <span className="ability-card__upgrade-tier">T{i+1}</span>
                                    <span className="ability-card__upgrade-desc">{text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>
                  {t('heroPage.noAbilities')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroPage;