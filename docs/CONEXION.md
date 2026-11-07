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
| Clave de OpenAI (`OPENAI_API_KEY`) | Secreto del Worker, con `npx wrangler secret put` | **Sí.** Nunca llega al navegador. No la pegues en chats |
| Llave de la cola (`ESTUDIO_WORKER_TOKEN`) | Secreto del Worker y `private.secrets` en Supabase | **Sí** |
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

## Paso 6 · Conectar Estudio IA

Estudio IA (Productos → Crear con IA) genera fotos y fichas con la API de OpenAI. Necesita el plan **Workers Paid** de Cloudflare y saldo en OpenAI; la suscripción de ChatGPT no incluye la API.

1. En Supabase → **SQL Editor**, ejecuta `supabase/schema.sql` completo. Crea las tablas de Estudio y su llave.
2. En el mismo SQL Editor, ejecuta esto y copia el resultado:

   ```sql
   select value from private.secrets where name = 'estudio_worker_token';
   ```

3. En la terminal, en la carpeta del proyecto, crea la cola una sola vez y guarda los dos secretos. Cada comando te pide el valor y no lo muestra:

   ```bash
   npx wrangler queues create divani-estudio
   npx wrangler secret put ESTUDIO_WORKER_TOKEN
   npx wrangler secret put OPENAI_API_KEY
   ```

4. Publica con `npm run deploy` y prueba con una prenda.

Las fotos de referencia de las modelos ya están en Cloudinary. Si cambias o agregas una modelo, pon su foto en una carpeta como `modelo-6.jpg`, agrégala en `src/estudio/modelos.ts` con su miniatura en `public/estudio/modelos/` y corre `npm run estudio:modelos -- <carpeta>`.

**Para probar en tu computadora sin gastar saldo**, crea el archivo `.dev.vars` (no se sube a GitHub):

```
ESTUDIO_DEMO=1
ESTUDIO_WORKER_TOKEN=el-valor-del-paso-2
```

**Ajustes opcionales** (con `npx wrangler secret put`, o en `.dev.vars` en tu computadora):

| Variable | Por defecto | Para qué sirve |
| --- | --- | --- |
| `IMAGE_MODEL` | `gpt-image-2.6-sunburst` | Modelo de imagen. `gpt-image-2.6-flare` es más rápido. |
| `IMAGE_QUALITY` | `high` | `low`, `medium`, `high`, `xhigh` o `max`. Más calidad cuesta más y tarda más. |
| `IMAGE_SIZE` | `1152x1440` | Formato 4:5 vertical, en múltiplos de 16. |
| `IMAGE_COMPLEXITY_PRENDA` / `IMAGE_COMPLEXITY_MODELO` | `medium` / `high` | Cuánto planea la IA antes de dibujar. |
| `IMAGE_MODERATION` | `low` | `low` evita bloqueos falsos con tops deportivos o trajes de baño; `auto` es el estándar. |
| `TEXT_MODEL` / `TEXT_REASONING` | `gpt-6.1-terra` / `low` | Modelo que lee la prenda y escribe la ficha. |
| `ORIGEN` | `Importado de EE. UU.` | Texto fijo del campo Origen. |
| `MAX_TRABAJOS_ACTIVOS` | `3` | Cuántas prendas pueden procesarse a la vez. |

**Costos**: cada prenda hace 2 imágenes y 1 ficha. Calcula alrededor de US$0.50 por prenda en calidad alta y confírmalo en platform.openai.com → Usage. Cada ↻ es una imagen más. Si dejas apagada la recarga automática de OpenAI, nunca se gasta más que el saldo cargado.

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
| Estudio IA: «La clave de OpenAI no es válida» | Vuelve a guardarla con `npx wrangler secret put OPENAI_API_KEY`. |
| Estudio IA: «Tu organización de OpenAI debe estar verificada» | Verifícala en platform.openai.com → Settings → Organization → General. |
| Estudio IA: «Se quedó sin saldo o llegó a su límite de gasto» | Recarga créditos en OpenAI o sube el límite. |
| Estudio IA: «El filtro de seguridad de OpenAI bloqueó esta imagen» | Intenta otra vez, con otra modelo o con otra foto. Si pasa seguido, revisa que `IMAGE_MODERATION` sea `low`. |
| Estudio IA: un paso dice «se cortó antes de terminar» | Toca «Intentar de nuevo». Si se repite, revisa los registros del Worker en Cloudflare. |
| Estudio IA: se queda en espera y no avanza | Revisa que `ESTUDIO_WORKER_TOKEN` sea el mismo en Cloudflare y en Supabase, y que exista la cola `divani-estudio`. |
