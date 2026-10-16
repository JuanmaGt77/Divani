/**
 * Punto único de acceso a datos. Elige el adaptador según la configuración:
 *  - VITE_API_URL vacío  → datos de prueba (public/data/*.json)
 *  - VITE_API_URL=https://… → tu backend REST
 */
import { API } from '../../config/site.config.js';
import { mockAdapter } from './mock.adapter.js';
import { restAdapter } from './rest.adapter.js';

export const api = API.baseUrl ? restAdapter : mockAdapter;
export const usingMockData = !API.baseUrl;
export { ApiError } from './http.js';
