/** Sesión del panel y ajustes de la tienda cargados una vez al entrar. */
import { api } from '../api/index.js';
import { createStore } from './store.js';
import { setRegion } from './format.js';
import { clearCache } from './query.js';

export const session = createStore({ status: 'loading', user: null });
export const settingsStore = createStore(null);

export async function loadSettings() {
  try {
    const s = await api.settings.get();
    settingsStore.set(s);
    setRegion(s.public.region || {});
    return s;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function boot() {
  try {
    const s = await api.auth.session();
    if (s?.user) {
      await loadSettings();
      session.set({ status: 'signedIn', user: s.user });
    } else {
      session.set({ status: 'signedOut', user: null });
    }
  } catch (err) {
    console.error(err);
    session.set({ status: 'signedOut', user: null, error: err.message });
  }
  api.auth.onChange((event) => {
    if (event === 'SIGNED_OUT') session.set({ status: 'signedOut', user: null });
    if (event === 'PASSWORD_RECOVERY') session.set({ ...session.get(), recovery: true });
  });
}

export async function signedIn(user) {
  await loadSettings();
  session.set({ status: 'signedIn', user });
}

export async function signOut() {
  await api.auth.signOut().catch(() => {});
  clearCache();
  settingsStore.set(null);
  session.set({ status: 'signedOut', user: null });
}
