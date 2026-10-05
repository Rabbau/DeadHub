import { TIER_ROMAN } from '../../services/shopService';

/** Подписи слотов предметов (общие для всего сайта). */
export const SLOT_KEYS = { weapon: 'itemCard.slotWeapon', vitality: 'itemCard.slotVitality', spirit: 'itemCard.slotSpirit' };

/** Название раздела магазина: «Тир I» … «Тир IV», «Легендарные», «Отключены / в разработке». */
export function tierName(t, key) {
  if (key === 'indev') return t('itemsPage.indev');
  if (key === 't5') return t('itemsPage.tierLegendary');
  return t('itemsPage.tierName', { tier: TIER_ROMAN[key] });
}

/** Тир в единственном числе — в подписи выбранного предмета: «Тир II», «Легендарный». */
export function tierLabel(t, key) {
  return key === 't5' ? t('itemsPage.tierLegendaryOne') : t('itemsPage.tierName', { tier: TIER_ROMAN[key] });
}
