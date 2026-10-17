import { mergeSettings } from '../backend/model.js';
import { applySiteSettings } from '../core/site-settings.js';
import { api } from './api/index.js';

let settingsPromise;

export const ContentService = {
  /** Ajustes públicos de la tienda (con valores por defecto); también los aplica: moneda, WhatsApp, horario… */
  getSettings() {
    settingsPromise ??= api.getSettings()
      .then((s) => applySiteSettings(mergeSettings({ public: s || {} }).public))
      .catch((err) => { settingsPromise = null; throw err; });
    return settingsPromise;
  },
  /** Fotos y textos de la portada (lo que se edita en el panel → Sitio web). */
  getContent: () => (api.getContent ? api.getContent() : Promise.resolve({})),
  getBanners: (placement) => api.getBanners({ placement }),
  getFaq: () => api.getFaq(),
  getLookbooks: () => api.getLookbooks(),
  subscribe: (data) => api.subscribe(data),
};
