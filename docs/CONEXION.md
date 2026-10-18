# Conectar Supabase, Cloudinary y publicar la tienda

La tienda y el panel usan **Supabase** (base de datos e inicio de sesión), **Cloudinary** (fotos y videos) y se publican en **Cloudflare**. Esta guía va en orden; si Supabase ya está conectado, salta a [Actualizar la base de datos](#actualizar-la-base-de-datos).

---

## Qué es público y qué es privado

| Dato | ¿Dónde va? | ¿Es secreto? |
| --- | --- | --- |
| Project URL de Supabase (`https://xxxx.supabase.co`) | Variable `PUBLIC_SUPABASE_URL` (Cloudflare y `.env.local`) | No |
| Publishable key (`sb_publishable_…`) | Variable `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Cloudflare y `.env.local`) | No. Es pública por diseño: lo que protege los datos son las reglas de `supabase/schema.sql` |
| Dirección de la tienda (`https://…`) | Variable `PUBLIC_SITE_URL` (Cloudflare) | No |
| Secret key (`sb_secret_…`) y token personal (`sbp_…`) | Solo en tu computadora, para `npm run setup:supabase` (opcional) | **Sí.** Nunca en la página, en Cloudflare ni en GitHub |
| Cloud name y API Key de Cloudinary | Panel → Configuración → Conexiones | No |
| API Secret de Cloudinary | Panel → Configuración → Conexiones (se guarda cifrado en la base de datos) | **Sí.** El panel nunca lo vuelve a mostrar |
| Contraseña del administrador | Solo tú la escribes | **Sí** |

> Solo las variables que empiezan con `PUBLIC_` llegan a la página. Si alguna llave secreta o contraseña se compartió por chat o correo, cámbiala: en Supabase → Project Settings → API Keys puedes crear una secret key nueva y borrar la anterior; en Cloudinary → Settings → API Keys puedes generar un nuevo API Secret.

---

## Paso 1 · Crear las tablas

1. Entra a tu proyecto en [supabase.com](https://supabase.com/dashboard) → **SQL Editor** → **New query**.
2. Copia todo el contenido de [`supabase/schema.sql`](../supabase/schema.sql), pégalo y presiona **Run**.
3. **Solo la primera vez**: abre otra consulta, copia [`supabase/seed.sql`](../supabase/seed.sql) (el catálogo de ejemplo) y presiona **Run**.

`schema.sql` se puede volver a ejecutar cuando quieras: actualiza funciones y reglas sin borrar datos. `seed.sql` no duplica nada, pero si lo ejecutas después de borrar prendas de ejemplo, las vuelve a crear.

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
2. **Authentication** → **URL Configuration** → en **Site URL** escribe la dirección de tu tienda (cuando la tengas, ver «Publicar»). Se usa en el correo de «olvidé mi contraseña».

## Paso 4 · Conectar la página en tu computadora

En **Project Settings → API Keys** copia el **Project URL** y la **Publishable key**. Copia `.env.example` como `.env.local` y escribe:

```
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

Luego `npm run dev` y abre `http://localhost:5173` (tienda) o `http://localhost:5173/admin` (panel).

## Paso 5 · Conectar Cloudinary

1. En [Cloudinary](https://console.cloudinary.com) → **Settings → API Keys** copia **Cloud name**, **API Key** y **API Secret** (botón del ojo → copiar, sin espacios).
2. En el panel: **Configuración → Conexiones** → pega los tres datos → **Guardar conexión**.
3. Presiona **Probar subida**: si sale «Conexión correcta», todas las fotos nuevas se suben a tu Cloudinary, comprimidas y en la carpeta `divani/`.

Si sale «Invalid Signature», el API Secret no coincide con esa API Key: genera una API Key nueva en Cloudinary y pega **los dos** datos de esa misma fila.

---

## Actualizar la base de datos

Cuando el proyecto cambia, `supabase/schema.sql` trae funciones nuevas y la carpeta [`supabase/actualizaciones/`](../supabase/actualizaciones) trae correcciones de datos. En el SQL Editor ejecuta, en este orden:

1. `supabase/schema.sql` completo.
2. Cada archivo de `supabase/actualizaciones/` que no hayas ejecutado, en orden por fecha. Todos se pueden repetir sin problema.

---

## Publicar la tienda en Cloudflare

La tienda se publica como un **Cloudflare Worker** (el sucesor de Cloudflare Pages; está en el mismo apartado «Workers & Pages» y el plan gratuito alcanza). Las páginas de la tienda son archivos estáticos; las páginas de cada prenda y el panel se generan en el Worker.

### Opción A · Desde GitHub (recomendada: se publica sola con cada cambio)

1. En [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Import a repository** → conecta GitHub y elige `JuanmaGt77/Divani`.
2. Configuración:
   - **Project name**: `divani` (igual que en `wrangler.jsonc`).
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy`
   - **Production branch**: `main`
3. En **Build variables** (variables de compilación) agrega:

   | Variable | Valor |
   | --- | --- |
   | `PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
   | `PUBLIC_SITE_URL` | la dirección final, por ejemplo `https://divani.gt` (si aún no la tienes, agrégala después) |

   Deben ser variables **de compilación**: la página las incorpora al compilar. La versión de Node la toma del archivo `.node-version`.
4. **Deploy**. Cloudflare te da una dirección `https://divani.<tu-cuenta>.workers.dev`.
5. ¿Dominio propio? En el Worker → **Settings → Domains & Routes → Add → Custom domain**.
6. Con la dirección final: actualiza `PUBLIC_SITE_URL` en Cloudflare y vuelve a publicar; en Supabase → **Authentication → URL Configuration** pon esa dirección en **Site URL** y agrega `https://tu-dominio/admin` en **Redirect URLs**.

### Opción B · Desde tu computadora

```bash
npx wrangler login     # una sola vez: abre el navegador para autorizar
npm run deploy         # compila con tu .env.local y publica
```

---

## Alternativa: preparar Supabase con un comando

`npm run setup:supabase` hace los pasos 1, 2, 3 y 5 y aplica las actualizaciones desde tu computadora:

1. En Supabase → tu foto (arriba a la derecha) → **Account preferences → Access Tokens** → **Generate new token**. Ponle una caducidad corta: solo se usa para esta preparación.
2. Agrega a `.env.local` (no se sube a GitHub):

   ```
   PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ACCESS_TOKEN=sbp_…
   ADMIN_EMAIL=somosdivani@gmail.com
   ADMIN_PASSWORD=tu-contraseña
   CLOUDINARY_CLOUD_NAME=…
   CLOUDINARY_API_KEY=…
   CLOUDINARY_API_SECRET=…
   PUBLIC_SITE_URL=https://tu-dominio      # opcional
   ```

3. Ejecuta `npm install` y luego `npm run setup:supabase`. El script:
   - obtiene las llaves del proyecto (la secreta nunca se guarda),
   - ejecuta `schema.sql`, el catálogo de ejemplo (solo si la base está vacía) y las actualizaciones,
   - cierra el registro público y crea tu usuario administrador ya confirmado,
   - comprueba que la tienda lee el catálogo y que tu usuario entra al panel,
   - conecta Cloudinary y hace una subida de prueba,
   - agrega a `.env.local` la URL y la clave publicable.
4. Cuando termine, **borra** del archivo `SUPABASE_ACCESS_TOKEN`, `ADMIN_PASSWORD` y `CLOUDINARY_API_SECRET`, y elimina el token en Supabase.

Opciones: `npm run setup:supabase -- --reset-password` cambia la contraseña de un administrador que ya existe; `-- --seed` vuelve a cargar el catálogo de ejemplo.

---

## Cómo queda funcionando

- **Tienda**: lee productos, existencias por color y talla, fotos, banners, textos de la portada y ajustes con una sola consulta pública (`storefront`) y guarda la última copia en el navegador para mostrarla al instante en la siguiente visita. La página de cada prenda usa una consulta ligera (`product_page`). Al enviar un pedido, primero lo registra (`place_order` valida existencias y precios en el servidor) y después abre WhatsApp con el número de pedido oficial.
- **Panel**: cada cambio se guarda en Supabase y se ve en la tienda al recargarla. Los pedidos nuevos llegan en tiempo real (aviso en el panel).
- **Seguridad**: las reglas por fila (RLS) dejan que el público solo lea el catálogo y cree pedidos; todo lo demás (costos, clientes, caja, reportes) solo lo ve un usuario del equipo con sesión iniciada.
- **Respaldo**: Supabase guarda copias automáticas; además, en Configuración → Respaldo y datos puedes descargar todo en un archivo.

## Problemas comunes

| Mensaje | Qué hacer |
| --- | --- |
| La compilación falla con «PUBLIC_SUPABASE_URL is missing» | Faltan las variables de compilación (Cloudflare) o `.env.local` (tu computadora). |
| «La base de datos no está preparada» | Ejecuta `supabase/schema.sql` (paso 1). |
| La página de una prenda dice «No pudimos cargar esta prenda» | Falta ejecutar la versión nueva de `schema.sql` (función `product_page`) o no hay conexión con Supabase. |
| «Esta cuenta no tiene acceso al panel» | El correo no está como administrador: revisa el paso 2. |
| «Correo o contraseña incorrectos» | Revisa la contraseña o cámbiala en Authentication → Users. |
| «Cloudinary no está configurado» al subir una foto | Completa el paso 5. |
| «Invalid Signature» al probar Cloudinary | API Key y API Secret no son de la misma fila: genera una nueva y pega los dos. |
