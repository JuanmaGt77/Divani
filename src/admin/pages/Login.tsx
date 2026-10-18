/** Acceso al panel: correo y contraseña del equipo (Supabase Auth). */
import { useState, type SyntheticEvent } from 'react';
import { useStore } from '@nanostores/react';
import { ArrowLeft, CircleAlert, LogIn, Mail } from 'lucide-react';
import { api } from '../api';
import { session, signedIn } from '../lib/session';
import { Button, Field, PasswordInput } from '../ui/controls';
import { promptDialog, toast } from '../ui/overlays';

export default function Login() {
  const recovery = useStore(session).recovery;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setBusy(true);
    try {
      const { user } = await api.auth.signIn(email, password);
      await signedIn(user);
      toast({ title: `Hola, ${user.name || 'bienvenida'}`, sub: 'Sesión iniciada' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    const mail = await promptDialog({
      title: 'Recuperar contraseña',
      message: 'Te enviaremos un enlace para crear una nueva.',
      placeholder: 'tu@correo.com',
      value: email,
      confirm: 'Enviar',
      required: true,
    });
    if (!mail) return;
    try {
      await api.auth.resetPassword(mail);
      toast({ title: 'Revisa tu correo', sub: 'Te enviamos el enlace para cambiar tu contraseña.', icon: Mail });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main className="login">
      <div className="login__media" aria-hidden="true">
        <video autoPlay muted loop playsInline poster="/media/video/divani-hero-poster.webp">
          <source src="/media/video/divani-hero.webm" type="video/webm" />
          <source src="/media/video/divani-hero.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="login__veil" aria-hidden="true" />

      <section className="login__card glass" aria-labelledby="login-title">
        <div className="login__brand">
          <img
            className="login__logo"
            src="/brand/logo-full.svg"
            alt="Divani · Fashion in you"
            width="168"
            height="156"
          />
          <h1 className="login__title" id="login-title">
            Panel de administración
          </h1>
        </div>

        {recovery ? (
          <NewPassword />
        ) : (
          <form className="login__form" onSubmit={submit} noValidate>
            <Field label="Correo">
              <input
                className="input"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="tu@correo.com"
                required
              />
            </Field>
            <Field label="Contraseña">
              <PasswordInput
                value={password}
                onValue={setPassword}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </Field>
            {error && (
              <p className="login__error" role="alert">
                <CircleAlert aria-hidden="true" />
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" block icon={LogIn} loading={busy}>
              Iniciar sesión
            </Button>
          </form>
        )}

        <div className="login__foot">
          <a href="/">
            <ArrowLeft aria-hidden="true" />
            Volver a la tienda
          </a>
          {!recovery && (
            <button type="button" onClick={forgot}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
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
  const save = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) {
      setError('Usa al menos 8 caracteres.');
      return;
    }
    if (pw !== pw2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      await api.auth.updatePassword(pw);
      const s = await api.auth.session();
      session.set({ ...session.get(), recovery: false });
      if (s?.user) await signedIn(s.user);
      toast({ title: 'Contraseña actualizada' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="login__form" onSubmit={save} noValidate>
      <p className="muted small">Escribe tu nueva contraseña.</p>
      <Field label="Nueva contraseña">
        <PasswordInput value={pw} onValue={setPw} autoComplete="new-password" />
      </Field>
      <Field label="Repítela">
        <PasswordInput value={pw2} onValue={setPw2} autoComplete="new-password" />
      </Field>
      {error && (
        <p className="login__error" role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" block loading={busy}>
        Guardar contraseña
      </Button>
    </form>
  );
}
