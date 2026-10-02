import { useParams, Link } from 'react-router-dom';
import { useHeroDetail } from '../hooks/useHeroDetail';
import { useHeroBuilds } from '../hooks/useHeroBuilds';
import { formatWinrate, formatPickrate, winrateColor } from '../services/heroService';
import { useHeroStore } from '../store/heroStore';
import { useTranslation } from '../hooks/useTranslation';
import { usePageMeta } from '../hooks/usePageMeta';
import { CURRENT_UPDATE } from '../data/updates';
import { humanizeKey, splitAbilityProps } from '../services/abilityService';
import ItemCard from '../components/ui/ItemCard';
import StatsFilters from '../components/ui/StatsFilters';
import HeroMatchups from '../components/matchups/HeroMatchups';
import UpcomingHero from '../components/hero/UpcomingHero';

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
  const { hero, loading, refreshing, error } = useHeroDetail(id, language);
  // У героя, которого ещё нет в игре, нет ни сборок, ни статистики — зря не запрашиваем
  const { popularItems, combinations, loading: buildsLoading } = useHeroBuilds(hero && !hero.upcoming ? hero.id : undefined);
  const t = useTranslation();

  // Название героя приходит из данных, поэтому до загрузки действуют общие заголовок и описание
  usePageMeta(hero?.name
    ? hero.upcoming
      ? {
        title: t('seo.heroSoon.title', { name: hero.name }),
        description: t('seo.heroSoon.description', { name: hero.name, update: CURRENT_UPDATE.name }),
      }
      : {
        title: t('seo.hero.title', { name: hero.name }),
        description: t('seo.hero.description', { name: hero.name }),
      }
    : undefined);

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
        {t('common.error')}: {error || t('heroPage.noHeroFound')}
      </div>
    );
  }

  if (hero.upcoming) {
    return <UpcomingHero hero={hero} />;
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

  // Перевод ключа свойства. Внутренние параметры игры без перевода («DragonSearchRadius») показываем словами
  const hasPropLabel = (key) => t.has(`abilityProps.${key}`);
  const translatePropKey = (key) => (hasPropLabel(key) ? t(`abilityProps.${key}`) : humanizeKey(key));

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

            <StatsFilters />

            <div className={`hero-detail__stats-row${refreshing ? ' is-refreshing' : ''}`}>
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

            {(buildsLoading || popularItems.length > 0 || combinations.length > 0) && (
              <div className="section">
                <h2 className="section__title">{t('heroPage.popularBuilds')}</h2>
                {buildsLoading ? (
                  <p style={{ color: 'var(--muted)' }}>{t('common.loading')}</p>
                ) : (
                  <>
                    {popularItems.length > 0 && (
                      <div className="popular-items-block">
                        <h3 className="popular-items-block__title">{t('heroPage.popularItems')}</h3>
                        <div className="popular-items-grid">
                          {popularItems.map(entry => (
                            <Link to={`/items/${entry.item.id}`} key={entry.itemId} className="popular-item-row">
                              <ItemCard item={entry.item} compact />
                              <div className="popular-item-row__stats">
                                <span className={`winrate-${winrateColor(entry.winrate)}`}>
                                  {formatWinrate(entry.winrate)}
                                </span>
                                <span>{entry.matches.toLocaleString()} {t('heroPage.matchesShort')}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {combinations.length > 0 && (
                      <div className="popular-combos-block">
                        <h3 className="popular-items-block__title">{t('heroPage.popularCombos')}</h3>
                        <div className="popular-combos-list">
                          {combinations.map((combo, idx) => (
                            <div key={idx} className="popular-combo-card">
                              <div className="popular-combo-card__items">
                                {combo.items.map(item => (
                                  <Link to={`/items/${item.id}`} key={item.id}>
                                    <ItemCard item={item} compact />
                                  </Link>
                                ))}
                              </div>
                              <div className="popular-combo-card__stats">
                                <span className={`winrate-${winrateColor(combo.winrate)}`}>
                                  WR {formatWinrate(combo.winrate)}
                                </span>
                                <span>{combo.matches.toLocaleString()} {t('heroPage.matchesShort')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <HeroMatchups heroId={hero.id} />

            <div className="section">
              <h2 className="section__title">{t('heroPage.abilities')}</h2>
              {hero.abilities && hero.abilities.length > 0 ? (
                <div className="abilities-list">
                  {hero.abilities.map((ability, idx) => {
                    const descText = getAbilityDescription(ability);
                    const props = ability.properties || {};
                    const upgrades = ability.upgrades || [];
                    // Основные свойства — сразу, внутренние параметры игры — под «Все параметры»
                    const { main: mainProps, extra: extraProps } = splitAbilityProps(getDisplayProps(props), hasPropLabel);

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
                          {mainProps.length > 0 && (
                            <div className="ability-card__props">
                              {mainProps.map(([key, prop]) => (
                                <span key={key} className="ability-card__prop">
                                  <span className="ability-card__prop-label">{translatePropKey(key)}</span>
                                  <span className="ability-card__prop-value">{prop.value}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {extraProps.length > 0 && (
                            <details className="ability-card__more">
                              <summary>{t('heroPage.allParams', { count: extraProps.length })}</summary>
                              <div className="ability-card__props">
                                {extraProps.map(([key, prop]) => (
                                  <span key={key} className="ability-card__prop">
                                    <span className="ability-card__prop-label">{translatePropKey(key)}</span>
                                    <span className="ability-card__prop-value">{prop.value}</span>
                                  </span>
                                ))}
                              </div>
                            </details>
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
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
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