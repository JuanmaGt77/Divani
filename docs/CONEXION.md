# Conectar Supabase y Cloudinary

Sin configurar nada, la tienda y el panel funcionan en **modo demostración**: todo se guarda en el navegador para que puedas probarlo. Para usarlo con datos reales (los mismos en tu computadora, tu celular y la tienda pública) conecta **Supabase** (base de datos e inicio de sesión) y **Cloudinary** (fotos y videos).

Tiempo aproximado: 15 minutos.

---

## Qué es público y qué es privado

| Dato | ¿Dónde va? | ¿Es secreto? |
| --- | --- | --- |
| Project URL de Supabase (`https://xxxx.supabase.co`) | Variable `VITE_SUPABASE_URL` del hosting | No |
| Publishable key (`sb_publishable_…`) | Variable `VITE_SUPABASE_PUBLISHABLE_KEY` del hosting | No. Es pública por diseño: lo que protege los datos son las reglas de `supabase/schema.sql` |
| Secret key (`sb_secret_…`) | Solo en tu computadora, para `npm run setup:supabase` (opcional) | **Sí.** Nunca en la página, en el hosting ni en GitHub |
| Cloud name y API Key de Cloudinary | Panel → Configuración → Conexiones | No |
| API Secret de Cloudinary | Panel → Configuración → Conexiones (se guarda cifrado en la base de datos) | **Sí.** El panel nunca lo vuelve a mostrar |
| Contraseña del administrador | Solo tú la escribes al crear el usuario | **Sí** |

> Si alguna llave secreta o contraseña se compartió por chat o correo, cámbiala: en Supabase → Project Settings → API Keys puedes crear una secret key nueva y borrar la anterior; en Cloudinary → Settings → API Keys puedes generar un nuevo API Secret.

---

## Paso 1 · Crear las tablas

1. Entra a tu proyecto en [supabase.com](https://supabase.com/dashboard) → **SQL Editor** → **New query**.
2. Copia todo el contenido de [`supabase/schema.sql`](../supabase/schema.sql), pégalo y presiona **Run**.
3. Abre otra consulta, copia [`supabase/seed.sql`](../supabase/seed.sql) (el catálogo inicial) y presiona **Run**.

Los dos archivos se pueden volver a ejecutar cuando quieras: no duplican ni borran lo que ya cambiaste desde el panel.

## Paso 2 · Crear tu usuario de administrador

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Correo: `somosdivani@gmail.com` · Contraseña: la tuya · marca **Auto Confirm User**.
3. Listo: ese correo recibe permisos de administrador automáticamente (lo hace `schema.sql`).

¿Quieres dar acceso a otra persona? Ejecuta en el SQL Editor, cambiando el correo, y luego créale su usuario como en el punto 1:

```sql
insert into private.bootstrap_admins (email) values ('otra-persona@correo.com') on conflict do nothing;
-- Si su usuario ya existía, vuelve a ejecutar supabase/schema.sql para darle acceso.
```

## Paso 3 · Cerrar el registro público

Solo deben entrar las cuentas que tú crees:

1. **Authentication** → **Sign In / Providers** → desactiva **Allow new users to sign up**.
2. **Authentication** → **URL Configuration** → en **Site URL** escribe la dirección de tu tienda (por ejemplo `https://divani.com`). Se usa en el correo de «olvidé mi contraseña».

## Paso 4 · Conectar la página

En **Project Settings → API Keys** copia el **Project URL** y la **Publishable key**.

- **En tu hosting** (Netlify, Vercel, Cloudflare Pages…): agrega las variables de entorno y vuelve a publicar.

  | Variable | Valor |
  | --- | --- |
  | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
  | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |

  Comando de compilación `npm run build` · carpeta a publicar `dist`.

- **En tu computadora**: copia `.env.example` como `.env` y escribe esos dos valores. Luego `npm run dev`.

Al abrir `/admin.html` ya no verás el botón de demostración: entra con tu correo y contraseña.

## Paso 5 · Conectar Cloudinary

1. En [Cloudinary](https://console.cloudinary.com) → **Settings → API Keys** copia **Cloud name**, **API Key** y **API Secret**.
2. En el panel: **Configuración → Conexiones** → pega los tres datos → **Guardar conexión**.
3. Presiona **Probar subida**: si sale «Conexión correcta», todas las fotos nuevas (productos, banners, portada) se suben a tu Cloudinary, comprimidas y en la carpeta `divani/`.

El API Secret se guarda cifrado en la base de datos y solo lo usa el servidor para firmar cada subida: nunca viaja a la página.

---

## Alternativa: todo en un comando

`npm run setup:supabase` hace los pasos 1 a 5 desde tu computadora (en la terminal de Visual Studio Code, por ejemplo):

1. En Supabase → tu foto (arriba a la derecha) → **Account preferences → Access Tokens** → **Generate new token**. Ponle una caducidad corta: solo se usa para esta preparación.
2. Crea en la carpeta del proyecto un archivo `.env.local` (no se sube a GitHub) con:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ACCESS_TOKEN=sbp_…
   ADMIN_EMAIL=somosdivani@gmail.com
   ADMIN_PASSWORD=tu-contraseña
   CLOUDINARY_CLOUD_NAME=…
   CLOUDINARY_API_KEY=…
   CLOUDINARY_API_SECRET=…
   SITE_URL=https://tu-dominio.com      # opcional
   ```

3. Ejecuta `npm install` y luego `npm run setup:supabase`. El script:
   - obtiene solo las llaves del proyecto (la secreta nunca se guarda),
   - crea las tablas y el catálogo inicial, y cierra el registro público,
   - crea tu usuario administrador ya confirmado,
   - comprueba que la tienda lee el catálogo y que tu usuario entra al panel,
   - conecta Cloudinary y hace una subida de prueba,
   - agrega a `.env.local` la URL y la clave publicable, así `npm run dev` ya usa tu base de datos.
4. Cuando termine, borra del archivo `SUPABASE_ACCESS_TOKEN`, `ADMIN_PASSWORD` y `CLOUDINARY_API_SECRET`, y elimina el token en Supabase.

Para cambiar la contraseña de un administrador que ya existe: `npm run setup:supabase -- --reset-password`.

---

## Cómo queda funcionando

- **Tienda**: lee productos, existencias por color y talla, fotos, banners, textos de la portada y ajustes con una sola consulta pública (`storefront`). Al enviar un pedido, primero lo registra (`place_order` valida existencias y precios en el servidor) y después abre WhatsApp con el número de pedido oficial.
- **Panel**: cada cambio se guarda en Supabase y se ve en la tienda al recargarla. Los pedidos nuevos llegan en tiempo real (aviso en el panel).
- **Seguridad**: las reglas por fila (RLS) dejan que el público solo lea el catálogo y cree pedidos; todo lo demás (costos, clientes, caja, reportes) solo lo ve un usuario del equipo con sesión iniciada.
- **Respaldo**: Supabase guarda copias automáticas; además, en Configuración → Respaldo y datos puedes descargar todo en un archivo.

## Problemas comunes

| Mensaje | Qué hacer |
| --- | --- |
| «La base de datos no está preparada» | Ejecuta `supabase/schema.sql` (paso 1). |
| «Esta cuenta no tiene acceso al panel» | El correo no está como administrador: revisa el paso 2. |
| «Correo o contraseña incorrectos» | Revisa la contraseña o cámbiala en Authentication → Users. |
| «Cloudinary no está configurado» al subir una foto | Completa el paso 5. |
| La tienda sigue mostrando la demostración | Faltan las variables del paso 4 o no volviste a publicar después de agregarlas. |
