# Divani — contexto para Claude

Tienda en línea de ropa (mujer, niñas, niños y un poco de hombre) con compra por WhatsApp, y un panel de administración para manejar todo el negocio. Dueño: Juan Manuel (GitHub `JuanmaGt77`, repo `JuanmaGt77/Divani`, rama `main`). Trabaja en Windows con VS Code y PowerShell.

**Idioma: todo en español** — textos de la tienda y del panel, comentarios del código, mensajes de commit y la conversación.

## Reglas del negocio (no romperlas)

- La tienda es de **Guatemala** (GTQ, +502). La ropa se presenta como **«ropa americana premium»**, nada más: **no** decir «etiqueta original» ni «etiquetada».
- **Los clientes nunca deben enterarse del proveedor**: no mencionar proveedores, mayoristas ni terceros en ningún texto de la tienda (el editor de «Acerca de nosotros» lo recuerda).
- Solo existe la sección «Acerca de nosotros» (sin misión ni visión).
- Se compra por WhatsApp: el pedido se registra primero (`place_order` valida existencias y precios en el servidor) y luego se abre WhatsApp con el número de pedido oficial.
- Diseño: beige, marfil y tinta, elegante, vidrio líquido estilo iOS 26, tipografías Bodoni Moda (títulos) y Jost (texto). El panel es estilo iPhone: cómodo, claro, táctil (44 px mínimo).
- Región configurable desde el panel: Guatemala (por defecto), México o Estados Unidos.

## Comandos

```bash
npm install
npm run dev              # tienda http://localhost:5173 · panel http://localhost:5173/admin
npm run verify           # astro check + eslint + vitest + build (usar antes de cada commit)
npm run build            # genera dist/ (falla si faltan PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_PUBLISHABLE_KEY)
npm run preview          # prueba dist/ con el motor de Cloudflare (workerd)
npm run deploy           # build + wrangler deploy
npm run seed:build       # regenera supabase/seed.sql desde supabase/datos/*.json
npm run setup:supabase   # prepara Supabase (schema, seed si está vacía, actualizaciones, admin, Cloudinary); lee .env.local
```

Para verificar a mano: `npm run verify`, abrir tienda y panel sin errores en la consola y revisar en celular (390 px) que no haya scroll horizontal.

## Arquitectura (Astro 7 + React 19 + TypeScript estricto, Cloudflare Workers)

- `astro.config.mjs`: adaptador `@astrojs/cloudflare` (Workers; Pages ya no lo soporta), React, `build.format: 'file'`, `trailingSlash: 'never'`, esquema `astro:env` (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`) y `PUBLIC_SITE_URL` opcional como `site`. Desactiva que Cloudflare copie `.env.local` a `dist/server/.dev.vars`.
- Alias `@/` → `src/`.

**Tienda** (`src/pages/index.astro`, `tienda.astro`, `404.astro`, `aviso-de-privacidad.astro` estáticas; `producto/[slug].astro`, `sitemap.xml.ts`, `robots.txt.ts` en el servidor):
- `src/layouts/StoreLayout.astro`: `<head>` (SEO, og, JSON-LD), `Sprite.astro` (íconos `#i-…`), `SiteHeader` (`client:load`), `SiteFooter` (`client:visible`), `StoreOverlays` (`client:load`) y `initEditBridge/initReveal/initGlassLight`.
- `src/store/islands/`: islas de React (`home/*` con `client:visible`, `ShopPage`, `ProductPage`, encabezado, pie y hojas).
- `src/store/data/storefront.ts`: el «paquete» de la rpc `storefront` (una vez por página, caché en localStorage), `useStorefront()` (sin datos hasta hidratar), `useSettings()`, `applySettings()` (región/moneda).
- `src/store/data/content.ts`: textos y fotos editables de la portada (`useContent().get(seccion, campo)`); los de fábrica salen de `supabase/datos/content.json`.
- `src/store/state/`: `cart`, `favorites`, `ui` (nanostores compartidos entre islas). `src/store/lib/hydration.ts`: `useHydrated()` evita diferencias al hidratar.
- `src/store/lib/edit-bridge.ts`: con `?editar=1` dentro del panel, tocar una sección (`data-edit="…"`) abre su editor.
- `src/lib/`: tipos (`types.ts`), reglas puras de presentación y validación (`model.ts`: SKU, regiones, `DEFAULT_SETTINGS`, `cdn()`…), formato (`format.ts`), filtros del catálogo (`catalog-query.ts`), `rpc.ts` y `env.ts`. Pruebas en `*.test.ts` (vitest).

**Panel** (`src/pages/admin/[...ruta].astro` → `src/admin/App.tsx`, `client:only`):
- React Router con `basename '/admin'` (`routes.tsx`): `/` resumen, `/pedidos`, `/vender`, `/caja`, `/productos`, `/inventario`, `/clientes`, `/reportes`, `/sitio`, `/ajustes` (`?seccion=tienda|region|pedidos|caja|inventario|integraciones|cuenta|datos`).
- Datos con TanStack Query: `useData(clave, fn, temas)` + `invalidate(tema)` (`lib/query.ts`); avisos con `toast()`; hojas con `<Sheet>` (`ui/overlays.tsx`).
- `api/index.ts` es la única puerta a Supabase (supabase-js); `api/mappers.ts` convierte filas.
- Ya **no existe modo demostración**.

**Supabase** (`supabase/`):
- `schema.sql`: tablas, RLS y **todas las reglas del negocio** (la tienda y el panel solo llaman funciones): `storefront, product_page, storefront_sitemap, place_order, pos_checkout, order_set_status, order_set_payment, order_update, cash_open, cash_movement, cash_close, cash_session_summary, inventory_adjust, inventory_receive, save_product, delete_product, save_category, delete_category, save_department, reorder_rows, set_integration_secret, integrations_status, cloudinary_signature, whoami`. Vista `private.store_products`. Es idempotente.
- `seed.sql`: **generado** por `scripts/build-seed.ts`; no editarlo a mano.
- `actualizaciones/*.sql`: correcciones de datos para la base que ya existe (idempotentes, en orden por fecha).
- Administradores: los correos de `private.bootstrap_admins` (incluye `somosdivani@gmail.com`) reciben acceso al crear su usuario.

**Cloudinary**: subidas firmadas. El API Secret vive cifrado en `private.secrets` (se guarda con `set_integration_secret` desde Configuración → Conexiones); `cloudinary_signature` firma en el servidor. Fotos en la carpeta `divani/…`. Cloud name: `ompbjpp9`.

## Reglas al cambiar código

- Las reglas del negocio viven **solo** en `supabase/schema.sql`. Si cambias `schema.sql`, hay que volver a ejecutarlo en Supabase (SQL Editor o `npm run setup:supabase`). Para corregir datos ya cargados, agrega un archivo en `supabase/actualizaciones/`.
- Si cambias `supabase/datos/*.json`, corre `npm run seed:build`.
- **Nunca** subas secretos: `.env`, `.env.local` y `.dev.vars` están en `.gitignore`. Solo las variables `PUBLIC_*` llegan al navegador. Nada de secret key, tokens `sbp_`, API Secret de Cloudinary ni contraseñas en el código, en commits ni en la documentación.
- Mantén la interfaz en español, el estilo visual existente y las áreas táctiles de 44 px. Usa los tokens de `src/styles/base/tokens.css` (tienda) y `src/admin/styles/base.css` (panel).
- Islas: nada que dependa del navegador (localStorage, datos, fecha) en el primer render; usa `useHydrated()`/`useStorefront()`.
- Commits en español y descriptivos. Antes de cada commit: `npm run verify`.

## Estado actual (18 de octubre de 2026)

Hecho:
- Migración completa a Astro + React + TypeScript (tienda, página por prenda, panel, SQL nuevo, documentación), unida a `main` y en GitHub. Verificado: tipos, lint, pruebas, compilación y recorrido en Chrome (tienda y panel, 390 px y escritorio) sin errores de consola.
- Supabase conectado: tablas y catálogo de ejemplo cargados, registro público cerrado, `somosdivani@gmail.com` con acceso de administrador. `.env.local` tiene `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Pendiente:
1. **Dominio propio** (opcional, cuando el dueño lo compre): conectarlo en Cloudflare (Worker `divani` → Settings → Domains & Routes), cambiar `PUBLIC_SITE_URL` en `.env.local`, volver a publicar y actualizar Site URL y Redirect URLs en Supabase.
2. ~~Cloudinary~~ Listo (19 de octubre de 2026): API Key «divani-tienda» guardada en el panel y subida de prueba correcta. La llave «Root» no se usa (Cloudinary no permite borrarla).
3. **Seguridad** (lo hace el dueño): quitar de `.env.local` `SUPABASE_ACCESS_TOKEN`, `ADMIN_PASSWORD` y `CLOUDINARY_API_SECRET`; borrar el token personal «divani» en Supabase; cambiar la contraseña del administrador.
4. **Datos reales**: cambiar las 45 prendas de ejemplo por las reales; configurar WhatsApp, horario y redes en Configuración → Tienda y contacto.
5. Completar `src/pages/aviso-de-privacidad.astro` (datos marcados con `<mark>`).

**Publicada** en Cloudflare Workers: https://divani.divani.workers.dev (cuenta con sesión de wrangler en esta computadora; para actualizar: `npm run deploy`, que usa `.env.local` con `PUBLIC_SITE_URL=https://divani.divani.workers.dev`). Supabase Auth: Site URL esa dirección; Redirect URLs `…/**` y `http://localhost:5173/**`.

Ya aplicado en Supabase (18 de octubre de 2026): `schema.sql` nuevo y `actualizaciones/2026-10-18-guatemala-ropa-americana.sql` (región GTQ, textos sin «etiqueta», enlaces `/tienda`). La migración ya está en `main` (GitHub).
