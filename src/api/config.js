/**
 * @fileoverview API конфигурация.
 */

const useCorsProxy = import.meta.env.VITE_USE_CORS_PROXY === 'true';

const ASSETS_URL = useCorsProxy
  ? 'https://cors-anywhere.herokuapp.com/https://assets.deadlock-api.com'
  : '/api/assets';

const ANALYTICS_URL = useCorsProxy
  ? 'https://cors-anywhere.herokuapp.com/https://api.deadlock-api.com'
  : '/api/analytics';

export const ASSETS_API_BASE = 'https://cors-anywhere.herokuapp.com/https://assets.deadlock-api.com';
export const ANALYTICS_API_BASE = 'https://cors-anywhere.herokuapp.com/https://api.deadlock-api.com';
export const API_MODE = import.meta.env.VITE_API_MODE || 'direct';
export const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api/v1';