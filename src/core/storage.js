// localStorage con tolerancia a fallos (modo privado, almacenamiento bloqueado, etc.)

export function load(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* sin almacenamiento */ }
}

export const session = {
  get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  set(key, v) { try { sessionStorage.setItem(key, v); } catch { /* sin almacenamiento */ } },
};
