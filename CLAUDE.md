# Divani — contexto para Claude

Tienda en línea de ropa (mujer, niñas, niños y un poco de hombre) con compra por WhatsApp, y un panel de administración para manejar todo el negocio. Dueño: Juan Manuel (GitHub `JuanmaGt77`, repo `JuanmaGt77/Divani`, rama `main`). Trabaja en Windows con VS Code y PowerShell.

**Idioma: todo en español** — textos de la tienda y del panel, comentarios del código, mensajes de commit y la conversación.

## Reglas del negocio (no romperlas)

- La ropa se presenta como **«ropa americana premium con etiqueta original»** traída de Estados Unidos. **Los clientes nunca deben enterarse del proveedor**: no mencionar proveedores, mayoristas ni terceros en ningún texto de la tienda (el editor de «Acerca de nosotros» lo recuerda).
- Solo existe la sección «Acerca de nosotros» (sin misión ni visión).
- Se compra por WhatsApp: con base de datos, el pedido se registra primero (valida existencias y precios en el servidor) y luego se abre WhatsApp con el número de pedido oficial.
- Diseño: beige, marfil y tinta, elegante, vidrio líquido estilo iOS 26, tipografías Bodoni Moda (títulos) y Jost (texto). El panel es estilo iPhone: cómodo, claro, táctil (44 px mínimo).
- Región configurable desde el panel: México (MXN, +52), Guatemala (GTQ, +502) o Estados Unidos (USD, +1). La organización de Supabase se llama «SomosDivani-GT»: confirmar con el dueño si la tienda es de Guatemala.

## Comandos

```bash
npm install
npm run dev              # tienda http://localhost:5173 · panel http://localhost:5173/admin.html
npm run build            # genera dist/ (sitio estático)
npm run seed:build       # regenera supabase/seed.sql desde public/data/*.json
npm run setup:supabase   # prepara Supabase (SQL, usuario admin, Cloudinary); lee .env.local
```

No hay framework de pruebas en el repo. Para verificar: `npm run build` sin errores, abrir tienda y panel sin errores en la consola, y revisar en celular (390 px) que no haya scroll horizontal.

## Arquitectura

Un proyecto de Vite multipágina (`vite.config.js`, `base: './'`; los fragmentos `<!-- @include partials/… -->` se insertan desde `src/partials/`).

**Tienda** (`index.html`, `tienda.html`, `404.html`, `aviso-de-privacidad.html`) — JavaScript sin frameworks:
- `src/pages/*.js` punto de entrada de cada página → `src/app.js` (lo común).
- `src/services/api/index.js` elige el origen de datos: `supabase.adapter.js` (rpc `storefront` y `place_order`), `demo.adapter.js` (base del panel en IndexedDB), `mock.adapter.js` (`public/data/*.json`) o `rest.adapter.js`. Supabase y demo comparten `payload.adapter.js` (un solo «paquete de la tienda»).
- `src/sections/site-content.js`: textos y fotos editables de la portada (`data-slot="seccion.campo"` en `index.html`).
- `src/core/edit-bridge.js`: con `?editar=1` dentro del panel, tocar una sección (`data-edit="…"`) abre su editor.
- `src/core/site-settings.js`: aplica los ajustes del panel (nombre, WhatsApp, horario, redes, región y moneda).
- `src/core/product.js`: existencias por color y talla (`colors[].sizes`).

**Panel** (`admin.html`) — Preact + JSX en `src/admin/`:
- `api/demo.js` y `api/supabase.js` tienen **la misma interfaz**; `api/index.js` elige según haya Supabase o no.
- Rutas por hash (`lib/router.js`): `/` resumen, `/pedidos`, `/vender` (punto de venta), `/caja`, `/productos`, `/inventario`, `/clientes`, `/reportes`, `/sitio` (editor del sitio con vista previa), `/ajustes` (`?seccion=tienda|region|pedidos|caja|inventario|integraciones|cuenta|datos`).
- Datos con `lib/query.js` (`useQuery(clave, fn, temas)` + `invalidate(tema)`); avisos con `toast()`; hojas con `<Sheet>` (`ui/overlays.jsx`).
- Componentes de interfaz en `ui/` (controles, superficies, gráficas, fotos), estilos en `styles/`.

**Compartido** (`src/backend/`):
- `model.js`: reglas puras (SKU por variante tipo `DV-MUJ-001-NEG-M`, totales, resumen de caja, regiones, `storefrontPayload`, `cdn()` para Cloudinary).
- `ops.js`: operaciones del negocio para el modo demostración.
- `demo/`: base de demostración en IndexedDB con historial de ventas de ejemplo.
- `config.js`: modo Supabase si existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

**Supabase** (`supabase/`):
- `schema.sql`: tablas (`staff, settings, departments, categories, products, product_colors, product_variants, orders, order_items, order_events, inventory_movements, cash_sessions, cash_movements, banners, lookbooks, faq, site_content`), seguridad por fila (RLS) y funciones: `storefront, place_order, pos_checkout, order_set_status, order_set_payment, order_update, cash_open, cash_movement, cash_close, cash_session_summary, inventory_adjust, inventory_receive, save_product, delete_product, reorder_rows, set_integration_secret, integrations_status, cloudinary_signature, whoami`. Es idempotente: se puede volver a ejecutar.
- `seed.sql`: **generado** por `scripts/build-seed.mjs`; no editarlo a mano.
- Administradores: los correos de `private.bootstrap_admins` (incluye `somosdivani@gmail.com`) reciben acceso al crear su usuario.

**Cloudinary**: subidas firmadas. El API Secret vive cifrado en `private.secrets` (se guarda con `set_integration_secret` desde Configuración → Conexiones); `cloudinary_signature` firma en el servidor con SHA-1. Fotos en la carpeta `divani/…`.

## Reglas al cambiar código

- Las reglas del negocio existen **dos veces**: en `src/backend/ops.js` (demostración) y en `supabase/schema.sql` (producción). Si cambias una, cambia la otra igual.
- Si cambias `schema.sql`, hay que volver a ejecutarlo en Supabase (SQL Editor o `npm run setup:supabase`).
- Si cambias `public/data/*.json`, corre `npm run seed:build`.
- **Nunca** subas secretos: `.env` y `.env.local` están en `.gitignore`. Solo las variables `VITE_*` llegan al navegador. Nada de secret key, tokens `sbp_`, API Secret de Cloudinary ni contraseñas en el código, en commits ni en la documentación.
- Mantén la interfaz en español, el estilo visual existente y las áreas táctiles de 44 px. Usa los tokens de `src/styles/base/tokens.css` (tienda) y `src/admin/styles/base.css` (panel).
- Commits en español y descriptivos.

## Estado actual (18 de octubre de 2026)

Hecho:
- Tienda + panel completos y en GitHub. Guía en `docs/CONEXION.md`.
- Supabase **conectado** con `npm run setup:supabase`: tablas y catálogo cargados, registro público cerrado, usuario `somosdivani@gmail.com` creado con acceso de administrador y comprobado. `.env.local` ya tiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

Pendiente:
1. **Cloudinary**: la prueba de subida dio «Invalid Signature» porque el API Secret estaba mal copiado. El dueño va a generar una API Key nueva en Cloudinary y pegar API Key + API Secret en el panel (Configuración → Conexiones → Guardar → Probar subida). Cloud name: `ompbjpp9`.
2. **Seguridad**: quitar de `.env.local` `SUPABASE_ACCESS_TOKEN`, `ADMIN_PASSWORD` y `CLOUDINARY_API_SECRET`; borrar el token personal «divani» en Supabase; cambiar la contraseña del administrador (se compartieron en un chat).
3. **Publicar la tienda** (Netlify, Vercel o Cloudflare Pages): comando `npm run build`, carpeta `dist`, variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Después poner esa dirección en Supabase → Authentication → URL Configuration → Site URL.
4. **Datos reales**: el catálogo cargado es de ejemplo (45 prendas inventadas con fotos ilustradas). Cambiarlo por los productos y fotos reales desde el panel (o archivar los de ejemplo). Configurar el número de WhatsApp, horario y redes en Configuración → Tienda y contacto, y la región en Configuración → Región y moneda.
5. Revisar `aviso-de-privacidad.html` (plantilla) y poner la URL completa del dominio en `og:image` (`src/partials/head.html`).
