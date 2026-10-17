/**
 * Acceso al panel. Con Supabase: correo y contraseña del administrador.
 * En modo demostración: un botón para explorar con datos de ejemplo.
 */
import { useState } from 'preact/hooks';
import { CircleAlert, ArrowLeft, Sparkles, LogIn, Mail } from 'lucide-preact';
import { api, isDemo } from '../api/index.js';
import { signedIn, session } from '../lib/session.js';
import { useStore } from '../lib/store.js';
import { Button, Field, PasswordInput } from '../ui/controls.jsx';
import { toast, promptDialog } from '../ui/overlays.jsx';

export default function Login() {
  const recovery = useStore(session, (s) => s.recovery);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Escribe tu correo y tu contraseña.'); return; }
    setBusy(true);
    try {
      const { user } = await api.auth.signIn(email, password);
      await signedIn(user);
      toast({ title: `Hola, ${user.name || 'bienvenida'}`, sub: 'Sesión iniciada' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    try {
      const { user } = await api.auth.signInDemo();
      await signedIn(user);
      toast({ title: 'Modo demostración', sub: 'Los cambios se guardan solo en este navegador.', tone: 'info' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    const mail = await promptDialog({ title: 'Recuperar contraseña', message: 'Te enviaremos un enlace para crear una nueva.', placeholder: 'tu@correo.com', value: email, confirm: 'Enviar', required: true });
    if (!mail) return;
    try {
      await api.auth.resetPassword(mail);
      toast({ title: 'Revisa tu correo', sub: 'Te enviamos el enlace para cambiar tu contraseña.', icon: Mail });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main class="login">
      <div class="login__media" aria-hidden="true">
        <video autoPlay muted loop playsInline poster="media/video/divani-hero-poster.webp">
          <source src="media/video/divani-hero.webm" type="video/webm" />
          <source src="media/video/divani-hero.mp4" type="video/mp4" />
        </video>
      </div>
      <div class="login__veil" aria-hidden="true" />

      <section class="login__card glass" aria-labelledby="login-title">
        <div class="login__brand">
          <img class="login__logo" src="brand/logo-full.svg" alt="Divani · Fashion in you" width="168" height="156" />
          <h1 class="login__title" id="login-title">Panel de administración</h1>
        </div>

        {recovery ? <NewPassword /> : isDemo ? (
          <div class="stack" style={{ '--gap': '14px' }}>
            <div class="login__demo">
              <p><strong>Modo demostración.</strong> El panel todavía no está conectado a Supabase. Puedes explorarlo completo con datos de ejemplo; lo que cambies se guarda solo en este navegador y la tienda lo muestra aquí mismo.</p>
            </div>
            {error && <p class="login__error" role="alert"><CircleAlert aria-hidden="true" />{error}</p>}
            <Button variant="primary" size="lg" block icon={Sparkles} loading={busy} onClick={demo}>Entrar a la demostración</Button>
          </div>
        ) : (
          <form class="login__form" onSubmit={submit} noValidate>
            <Field label="Correo">
              <input class="input" type="email" autocomplete="username" inputMode="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} placeholder="tu@correo.com" required />
            </Field>
            <Field label="Contraseña">
              <PasswordInput value={password} onValue={setPassword} autocomplete="current-password" placeholder="••••••••" required />
            </Field>
            {error && <p class="login__error" role="alert"><CircleAlert aria-hidden="true" />{error}</p>}
            <Button type="submit" variant="primary" size="lg" block icon={LogIn} loading={busy}>Iniciar sesión</Button>
          </form>
        )}

        <div class="login__foot">
          <a href="index.html"><ArrowLeft aria-hidden="true" />Volver a la tienda</a>
          {!isDemo && !recovery && <button type="button" onClick={forgot}>¿Olvidaste tu contraseña?</button>}
        </div>
      </section>
    </main>
  );
}

function NewPassword() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) { setError('Usa al menos 8 caracteres.'); return; }
    if (pw !== pw2) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try {
      await api.auth.updatePassword(pw);
      const s = await api.auth.session();
      session.set({ ...session.get(), recovery: false });
      if (s?.user) await signedIn(s.user);
      toast({ title: 'Contraseña actualizada' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form class="login__form" onSubmit={save} noValidate>
      <p class="muted small">Escribe tu nueva contraseña.</p>
      <Field label="Nueva contraseña"><PasswordInput value={pw} onValue={setPw} autocomplete="new-password" /></Field>
      <Field label="Repítela"><PasswordInput value={pw2} onValue={setPw2} autocomplete="new-password" /></Field>
      {error && <p class="login__error" role="alert"><CircleAlert aria-hidden="true" />{error}</p>}
      <Button type="submit" variant="primary" size="lg" block loading={busy}>Guardar contraseña</Button>
    </form>
  );
}
