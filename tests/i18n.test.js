import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../src/i18n/locales/en.js'
import ru from '../src/i18n/locales/ru.js'
import { hasTranslation } from '../src/i18n/index.js'
import { HEAT_PHASES, LAYERS, LEVELS, PRESETS, SHOP_KINDS, TIMER_KEYS } from '../src/services/mapService.js'
import { MODES, RANK_PRESETS } from '../src/services/statsFilters.js'
import { GROUP_ORDER, SEARCH_PAGES } from '../src/services/searchService.js'
import { HOME_SECTIONS } from '../src/services/homeService.js'
import { MODIFIER_KEYS, UNCOUNTED_KEYS } from '../src/services/calculatorService.js'
import { CROSSHAIR_PRESETS, SLIDER } from '../src/services/crosshairService.js'
import { LIVE_REGIONS } from '../src/services/liveService.js'

const SRC = path.resolve(import.meta.dirname, '../src')

const flat = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]))
const enKeys = new Set(flat(en))
const ruKeys = new Set(flat(ru))
const inBoth = (key) => enKeys.has(key) && ruKeys.has(key)

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.jsx?$/.test(entry.name) ? [full] : []
  })
}

describe('locales', () => {
  it('have the same keys in English and Russian', () => {
    expect([...enKeys].filter((k) => !ruKeys.has(k))).toEqual([])
    expect([...ruKeys].filter((k) => !enKeys.has(k))).toEqual([])
  })

  it('have the same ability property labels', () => {
    expect(Object.keys(en.abilityProps).sort()).toEqual(Object.keys(ru.abilityProps).sort())
  })

  it('translate every static t(\'key\') call of the site', () => {
    const used = new Map()
    for (const file of sourceFiles(SRC).filter((f) => !f.includes(`${path.sep}i18n${path.sep}`))) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/\bt\(\s*(['"])([A-Za-z0-9_.]+)\1/g)) {
        if (!used.has(m[2])) used.set(m[2], path.basename(file))
      }
    }
    const missing = [...used].filter(([key]) => !inBoth(key)).map(([key, file]) => `${key} (${file})`)
    expect(missing).toEqual([])
  })

  it('translate the keys that are assembled at run time', () => {
    const need = []
    LAYERS.forEach((l) => {
      need.push(`map.layers.${l.id}.name`, `map.groups.${l.group}`)
      if (l.hint) need.push(`map.layers.${l.id}.hint`)
    })
    PRESETS.forEach((p) => need.push(`map.presets.${p.id}`))
    Object.keys(HEAT_PHASES).forEach((p) => need.push(`map.heat.phases.${p}`))
    ;['guardian', 'walker', 'patron'].forEach((k) => need.push(`map.objective.${k}`))
    ;['yellow', 'blue', 'green', 'left', 'center', 'right'].forEach((k) => need.push(`map.lane.${k}`))
    ;[0, 1].forEach((k) => need.push(`map.side.${k}`))
    LEVELS.forEach((k) => need.push(`map.level.${k}`))
    TIMER_KEYS.forEach((k) => need.push(`map.timers.rows.${k}`))
    SHOP_KINDS.forEach((k) => need.push(`map.shopKind.${k}`))
    ;['spawn', 'pad'].forEach((k) => need.push(`map.urnKind.${k}`))
    ;['bellTower', 'sunkenPlaza'].forEach((k) => need.push(`map.landmark.${k}.name`, `map.landmark.${k}.hint`))
    RANK_PRESETS.forEach((p) => need.push(`filters.presets.${p.id}`))
    SEARCH_PAGES.forEach((page) => need.push(page.key))
    HOME_SECTIONS.forEach((section) => need.push(section.nameKey, `home.sections.${section.id}`))
    GROUP_ORDER.concat('player', 'match').forEach((type) => need.push(`search.groups.${type}`))
    MODES.forEach((mode) => need.push(`filters.modes.${mode}`, `filters.modeTitle.${mode}`))
    // Страница матча: режим игры из данных, режим матча (как в истории игрока) и подписи строк сравнения команд
    ;['normal', 'street_brawl', 'other'].forEach((k) => need.push(`match.modes.${k}`))
    ;['ranked', 'unranked', 'private', 'bots', 'other'].forEach((k) => need.push(`player.modes.${k}`))
    ;['kills', 'souls', 'damage', 'healing', 'objectives', 'midBoss'].forEach((k) => need.push(`match.${k}`))
    // Подпись кнопки направления сортировки собирается из двух ключей
    ;['dirAsc', 'dirDesc'].forEach((k) => need.push(`heroesPage.${k}`))

    // Эфир, прицел, калькулятор, сравнение игроков и разделы профиля: подписи собираются из списков сервисов и из данных
    LIVE_REGIONS.forEach((k) => need.push(`live.regions.${k}`))
    ;['ranked', 'unranked', 'streetBrawl'].forEach((k) => need.push(`live.modes.${k}`))
    ;['spectators', 'newest', 'longest'].forEach((k) => need.push(`live.sorts.${k}`))
    CROSSHAIR_PRESETS.forEach((p) => need.push(`crosshair.presetNames.${p.id}`))
    Object.keys(SLIDER).forEach((k) => need.push(`crosshair.fields.${k}`))
    ;['pips', 'dot', 'colors'].forEach((k) => need.push(`crosshair.groups.${k}`))
    ;['dark', 'light', 'green', 'city'].forEach((k) => need.push(`crosshair.backgrounds.${k}`))
    ;['all', 'weapon', 'vitality', 'spirit'].forEach((k) => need.push(`calculator.slots.${k}`))
    Object.values(MODIFIER_KEYS).forEach((k) => need.push(`calculator.stats.${k}`))
    Object.values(UNCOUNTED_KEYS).forEach((k) => need.push(`calculator.effects.${k}`))
    ;['health', 'damage', 'rate', 'dps'].forEach((k) => need.push(`calculator.formulas.${k}`))
    ;['rank', 'matches', 'winrate', 'kda', 'accuracy', 'recentWinrate', 'recentKda', 'lastMatch'].forEach((k) => need.push(`versus.rows.${k}`))
    ;['me', 'favorites', 'recent'].forEach((k) => need.push(`versus.${k}`))
    ;['strong', 'weak', 'even'].forEach((k) => need.push(`player.advice.verdict.${k}`))
    ;['suggestBoth', 'suggestRole', 'suggestGun', 'whyStrong', 'whyPlayed'].forEach((k) => need.push(`player.advice.${k}`))
    ;['Up', 'Down', 'Steady'].forEach((k) => need.push(`player.form.trend${k}`))
    ;['Full', 'Partial', 'Low'].forEach((k) => need.push(`player.circle.coverage${k}`))
    ;['souls', 'kills', 'deaths', 'assists'].forEach((k) => need.push(`player.curve.rows.${k}`))
    ;['heroes', 'advice', 'form', 'circle', 'share', 'matches'].forEach((k) => need.push(`player.sections.${k}`))

    // usePageMeta('ключ') берёт seo.<ключ>.title и seo.<ключ>.description
    for (const file of sourceFiles(SRC)) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/usePageMeta\('([A-Za-z]+)'/g)) need.push(`seo.${m[1]}.title`, `seo.${m[1]}.description`)
    }
    need.push('seo.default.description', 'seo.hero.title', 'seo.hero.description', 'seo.heroSoon.title', 'seo.heroSoon.description',
      'seo.item.title', 'seo.item.description', 'seo.player.title', 'seo.player.description',
      'seo.match.title', 'seo.match.description')

    expect(need.filter((k) => !inBoth(k))).toEqual([])
  })
})

describe('hasTranslation', () => {
  it('finds strings only', () => {
    expect(hasTranslation('english', 'abilityProps.Damage')).toBe(true)
    expect(hasTranslation('english', 'abilityProps.DragonSearchRadius')).toBe(false)
    expect(hasTranslation('english', 'abilityProps')).toBe(false) // объект — не перевод
    expect(hasTranslation('english', 'abilityProps.constructor')).toBe(false) // ключи прототипа — не переводы
    expect(hasTranslation('russian', 'filters.presets.eternus')).toBe(true)
    expect(hasTranslation('klingon', 'filters.presets.eternus')).toBe(false)
  })
})
