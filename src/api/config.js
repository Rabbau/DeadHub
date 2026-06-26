/**
 * @fileoverview API конфигурация.
 */

export const ASSETS_API_BASE = '/api/assets';
export const ANALYTICS_API_BASE = '/api/analytics';

export const API_MODE = import.meta.env.VITE_API_MODE || 'direct';
export const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api/v1';