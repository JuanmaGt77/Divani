import { api } from './api/index.js';

let settingsPromise;

export const ContentService = {
  getSettings() {
    settingsPromise ??= api.getSettings().catch((err) => { settingsPromise = null; throw err; });
    return settingsPromise;
  },
  getBanners: (placement) => api.getBanners({ placement }),
  getFaq: () => api.getFaq(),
  getLookbooks: () => api.getLookbooks(),
  subscribe: (data) => api.subscribe(data),
};
