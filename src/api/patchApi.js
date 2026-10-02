import { httpGet } from './httpClient.js';
import { API_BASE } from './config.js';
import { slimPatches } from '../services/patchService.js';

const PATCHES_TTL_MS = 30 * 60 * 1000;

export function fetchPatches() {
  // patches_v3: в записях прежнего ключа у всех обновлений был одинаковый id
  return httpGet(`${API_BASE}/v2/patches`, {
    cacheKey: 'patches_v3',
    ttl: PATCHES_TTL_MS,
    transform: slimPatches,
  });
}
