/** Sesión del panel y ajustes de la tienda cargados una vez al entrar. */
import { atom } from 'nanostores';
import { setRegion } from '@/lib/format';
import type { Settings } from '@/lib/types';
import { api, type StaffUser } from '../api';
import { clearCache } from './query';
import { excludeThisBrowser } from './visits';

export interface SessionState {
  status: 'loading' | 'signedIn' | 'signedOut';
  user: StaffUser | null;
  /** El usuario llegó desde el correo de «olvidé mi contraseña». */
  recovery?: boolean;
  error?: string;
}

export const session = atom<SessionState>({ status: 'loading', user: null });
export const settingsStore = atom<Settings | null>(null);

export async function loadSettings(): Promise<Settings | null> {
  try {
    const s = await api.settings.get();
    settingsStore.set(s);
    setRegion(s.public.region);
    return s;
  } catch (err) {
    console.error(err);
    return null;
  }
}

let booted = false;

export async function boot(): Promise<void> {
  if (booted) return;
  booted = true;
  try {
    const s = await api.auth.session();
    if (s?.user) {
      await loadSettings();
      session.set({ status: 'signedIn', user: s.user });
      void excludeThisBrowser();
    } else {
      session.set({ status: 'signedOut', user: null });
    }
  } catch (err) {
    console.error(err);
    session.set({ status: 'signedOut', user: null, error: (err as Error).message });
  }
  api.auth.onChange((event) => {
    if (event === 'SIGNED_OUT') session.set({ status: 'signedOut', user: null });
    if (event === 'PASSWORD_RECOVERY') session.set({ ...session.get(), recovery: true });
  });
}

export async function signedIn(user: StaffUser): Promise<void> {
  await loadSettings();
  session.set({ status: 'signedIn', user });
  void excludeThisBrowser();
}

export async function signOut(): Promise<void> {
  await api.auth.signOut().catch(() => {});
  clearCache();
  settingsStore.set(null);
  session.set({ status: 'signedOut', user: null });
}
