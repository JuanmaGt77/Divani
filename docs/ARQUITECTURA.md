# Arquitectura

Un solo proyecto de **Astro 7** con **React 19** y **TypeScript** estricto, publicado en **Cloudflare Workers**. Los datos y las reglas del negocio viven en **Supabase** (PostgreSQL); las fotos en **Cloudinary**.

| Parte | Cómo se genera | Código |
| --- | --- | --- |
| Tienda: `/`, `/tienda`, `/aviso-de-privacidad`, `/404` | HTML estático al compilar + «islas» de React | `src/pages/*.astro`, `src/store/` |
| Página de cada prenda: `/producto/[slug]` | En el Worker, en cada visita (consulta `product_page`) | `src/pages/producto/[slug].astro`, `src/store/islands/ProductPage.tsx` |
| Panel: `/admin/…` | En el Worker (cualquier dirección abre la aplicación) + React en el navegador | `src/pages/admin/[...ruta].astro`, `src/admin/` |
| `sitemap.xml`, `robots.txt` | En el Worker | `src/pages/*.ts` |
| `/api/visita` (contador de visitas) | En el Worker | `src/pages/api/visita.ts` |
| `/api/estudio/…` (Estudio IA, solo administradores) | En el Worker + cola de Cloudflare | `src/pages/api/estudio/`, `src/estudio/`, `src/worker.ts` |

## Configuración y variables

- `astro.config.mjs`: adaptador de Cloudflare, React, direcciones limpias (`build.format: 'file'`, sin `/` final) y el esquema de variables `astro:env`. Si falta `PUBLIC_SUPABASE_URL` o `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, la compilación falla.
- `PUBLIC_SITE_URL` (opcional) es la dirección pública: se usa en las vistas previas al compartir, la dirección canónica y el mapa del sitio.
- `src/lib/env.ts` lee las variables; `src/lib/rpc.ts` llama a las funciones públicas de Supabase con `fetch` (sirve en el navegador y en el Worker).
- `wrangler.jsonc`: nombre del Worker, entrada propia (`src/worker.ts`), fecha de compatibilidad, `nodejs_compat` y la cola `divani-estudio`. El adaptador agrega el resto al compilar.
- `src/worker.ts`: `fetch` pasa cada petición a Astro y `queue` atiende la cola de Estudio IA.

## Tienda

```
src/pages/index.astro ─┐
src/pages/tienda.astro ─┼─► src/layouts/StoreLayout.astro  (<head>, íconos, SiteHeader, SiteFooter, StoreOverlays)
producto/[slug].astro ─┘          │
                                  ▼
                 src/store/islands/   islas de React (cada sección es una)
                       ├── home/       Hero (portada), Ribbons, Categories, NewArrivals, Bestsellers, Lookbook,
                       │               Editorial, Kids, About, HowTo, Men, Faq, Vip
                       ├── ShopPage.tsx, ProductPage.tsx
                       ├── SiteHeader.tsx, SiteFooter.tsx
                       └── StoreOverlays.tsx + overlays/  (menú, búsqueda, bolsa, favoritos, vista rápida, isla de avisos, barra inferior)
                                  │
                 src/store/data/      storefront.ts (paquete de la tienda), content.ts (textos de la portada), orders.ts (place_order)
                 src/store/state/     cart.ts, favorites.ts, ui.ts  (átomos de nanostores compartidos entre islas)
                 src/store/components/ ProductCard, ProductDetail, Sheet, Segmented, Marquee, Rail, SizeGuide…
                 src/store/lib/       whatsapp, url, product, storage, hydration, motion, edit-bridge
```

- **Islas**: el encabezado, las hojas y la página de la tienda se activan al cargar (`client:load`); las secciones de la portada al acercarse a la pantalla (`client:visible`). Comparten estado con **nanostores** (bolsa, favoritos, hoja abierta, vista rápida).
- **Paquete de la tienda**: `storefront()` devuelve en una sola consulta productos con existencias por color y talla, categorías, banners vigentes, looks, preguntas, contenido de la portada y ajustes públicos. Se pide una vez por página y se guarda en `localStorage` (`divani.storefront.v2`) para pintar al instante la siguiente visita; luego se actualiza.
- **Hidratación sin saltos**: el HTML generado no trae datos del navegador. `useHydrated()` hace que el primer render en el navegador sea igual al HTML; después se muestran datos, bolsa y favoritos. Los textos de la portada usan los de fábrica (`supabase/datos/content.json`) hasta que llegan los guardados.
- **Región**: `applySettings()` aplica moneda e idioma (`src/lib/format.ts`). La página de producto la aplica en el servidor antes de mostrar precios.
- **Portada** (`home/Hero.tsx`): carrusel de «vitrinas» hecho con los banners (`placement` home-carousel). Cada banner tiene color (arena, marfil, rosa, salvia, tinta), foto opcional y qué prendas muestra (novedades, ofertas, más vendidas, una categoría, elegidas o ninguna). Color y prendas se guardan juntos como JSON en la columna `banners.theme` (`readBannerTheme` / `writeBannerTheme` en `src/lib/model.ts`). Las prendas se eligen en el navegador con el paquete de la tienda y solo con existencias. Sin banners se muestra una vitrina de novedades.
- **Filtros**: `src/lib/catalog-query.ts` filtra, ordena, pagina y calcula facetas (función pura con pruebas). El estado de `/tienda` vive en la URL.

### Flujo de compra

1. La tarjeta o la ficha llaman a `cart.add(producto, { color, size, qty })`; la bolsa se guarda en `localStorage` y se sincroniza entre pestañas.
2. En la bolsa, «Continuar con mi pedido» pide nombre, teléfono, ciudad, entrega y pago (se recuerdan en el navegador).
3. Al enviar: se abre una pestaña en el mismo toque, `place_order` registra el pedido (valida existencias y precios en el servidor), la bolsa se vacía y la pestaña abre WhatsApp con el número de pedido oficial. Si el navegador bloquea la pestaña, aparece un botón para abrirlo.
4. El pedido aparece al instante en el panel (aviso en tiempo real).

### Contador de visitas (Panel → Visitas)

1. `StoreLayout` llama a `trackPage()` (`src/store/lib/analytics.ts`) cuando el navegador está libre; la vista rápida llama a `trackProduct(slug)`.
2. El navegador guarda un número al azar (`divani.visitante`) y la visita en curso (`divani.visita`, termina tras 30 minutos sin actividad, con su origen: Instagram, Facebook, WhatsApp, TikTok, Google… según `utm_source`, la app o la página de origen). Sin cookies ni datos personales.
3. Envía la vista con `sendBeacon` a `/api/visita` (`src/pages/api/visita.ts`), que descarta robots y envíos de otros sitios, le agrega país, departamento y ciudad aproximados (`request.cf` de Cloudflare) y llama a `track_visit` en segundo plano (`waitUntil`). Nunca guarda la IP.
4. No se cuentan: navegadores automatizados, la vista previa del panel (`?editar=1`) ni el equipo. Al entrar al panel, `excludeThisBrowser()` (`src/admin/lib/visits.ts`) marca el navegador (`divani.no-contar`) y borra sus vistas anteriores con `visits_forget`.
5. El panel lee `visits_summary` (totales, comparación, por día, por hora, orígenes, dispositivos, ciudades, páginas y prendas) y `visits_live` (personas en los últimos 5 minutos). Las reglas compartidas (orígenes, dispositivos, robots, nombres de lugares) están en `src/lib/visits.ts`.

### Contenido editable y vista previa

- Cada sección lleva `data-edit="…"`. Con `?editar=1` dentro del panel (`src/store/lib/edit-bridge.ts`), tocar una sección abre su editor; la comunicación con el panel es por `postMessage`.
- Animaciones de aparición: `data-reveal` en cualquier elemento (`style="--d: 1"` para escalonar). `initReveal()` marca `data-in` al entrar en pantalla y vigila los elementos que agregan las islas.

## Panel

- `src/admin/App.tsx`: TanStack Query (`QueryClientProvider`), sesión y aviso de pedidos nuevos.
- `src/admin/routes.tsx`: React Router con `basename: '/admin'`; cada sección se carga al abrirla. Las direcciones viejas con `#/` se redirigen.
- `src/admin/api/`: cliente de Supabase (`client.ts`), conversión de filas a objetos (`mappers.ts`) y la interfaz `api` (`index.ts`) que usan las páginas.
- Datos: `useData(clave, fn, temas)` + `invalidate(tema)` (`lib/query.ts`); avisos con `toast()`; hojas con `<Sheet>` (`ui/overlays.tsx`); cambios sin guardar con `useUnsavedChanges` (`lib/navigation.ts`).
- Categorías (`pages/Categories.tsx`, `/admin/categorias`): tarjetas con foto de portada por departamento, ordenar, ocultar y eliminar (solo sin productos). Cada categoría activa sale como filtro en `/tienda`; las de Mujer, también en «Compra por categoría» de la portada.
- Colores de prenda: selector propio (`ui/color.tsx`) con área de saturación, tono, código, gotero (Chrome y Edge de escritorio) y tonos de temporada; o multicolor de 2 a 6 rayas. Se guarda en `product_colors.hex` como `#RRGGBB` o `#RRGGBB,#RRGGBB,…`; tienda y panel lo pintan con `swatchFill()` (`src/lib/model.ts`). La familia del filtro de color se calcula sola (`guessFamily`).

### Estudio IA (Productos → Crear con IA)

Con la foto de una prenda genera la foto en gancho, la foto con modelo y la ficha, usando la API de OpenAI. Viene del proyecto `divani-estudio`, que era un servidor aparte con los trabajos en memoria.

```
Teléfono ── fotos (JPG 2048 px) ──► Cloudinary  divani/estudio/originales
Teléfono ── direcciones ──► /api/estudio/trabajos ──► estudio_crear + 2 mensajes en la cola
Cola:  prenda ──────────────► OpenAI ─► Cloudinary (WebP) ─► Supabase
       ficha ─► Supabase ─► modelo ─► OpenAI ─► Cloudinary (WebP) ─► Supabase
Teléfono ◄── estudio_estado cada 2.5 s (directo a Supabase, sin pasar por el Worker)
```

- **Por qué una cola**: una foto tarda 1–2 minutos. Una petición de Workers se puede cancelar cuando el teléfono se desconecta y `waitUntil` solo da 30 s más; la memoria tampoco se conserva entre peticiones. Un consumidor de cola dura hasta 15 minutos sin depender del teléfono. Necesita el plan **Workers Paid**: en el gratis, 10 ms de CPU no alcanzan para leer la imagen que devuelve OpenAI.
- **Estado**: todo vive en `estudio_trabajos`. Cada paso (`ficha`, `prenda`, `modelo`) tiene estado e `intento`; `estudio_worker_tomar` lo reserva, así que un mensaje repetido no vuelve a generar ni a cobrar. La cola corta cada paso a los 11 minutos y `estudio_estado` da por cortado el que lleve 12 (o 15 en espera). Se reintenta a mano: la cola tiene `max_retries: 0` porque cada intento cuesta dinero.
- **Llave de la cola**: la cola no tiene sesión de usuario. Entra a las funciones `estudio_worker_*` con `ESTUDIO_WORKER_TOKEN`, que solo sirve para ellas; `estudio_worker_firma` firma únicamente dentro de `divani/estudio`. La secret key de Supabase no se usa.
- **Fotos**: a OpenAI se le pasan por dirección (`image_url`), así el Worker no las carga. Lo generado llega en base64 y se manda tal cual a Cloudinary, que lo convierte a WebP con `format=webp` y `c_limit` (`src/estudio/cloudinary.ts`). Las referencias de las modelos están en `divani/estudio/modelos` (`npm run estudio:modelos`) y sus miniaturas en `public/estudio/modelos`.
- **Ficha**: `src/estudio/prompts.ts` arma el prompt y el JSON schema con los departamentos y las categorías reales de la base, y las familias de `COLOR_FAMILIES`. `PROMPT_PRENDA` y `PROMPT_MODELO` no se tocan sin probar. La cuenta de uso de cada modelo está en `estudio_modelos_uso`.
- **Importar al producto**: abre `/admin/productos/nuevo?estudio=<id>`, que llena el formulario con `importarTrabajo` (`src/admin/lib/estudio.ts`). Nunca guarda: el usuario revisa y toca «Crear producto». Precio, costo, SKU y existencias quedan para llenar.
- **Modo demostración**: `ESTUDIO_DEMO=1` en `.dev.vars` no llama a OpenAI (`src/estudio/mock.ts`); lo demás funciona igual.
- **Código**: `src/estudio/` es del servidor, salvo `tipos.ts` y `modelos.ts`, que también usa el panel. La pantalla es `src/admin/pages/Estudio.tsx`.

## Base de datos (Supabase)

- `supabase/schema.sql`: tablas, seguridad por fila (RLS) y **todas** las reglas del negocio como funciones: `storefront`, `product_page`, `storefront_sitemap`, `place_order`, `track_visit` (públicas) y `pos_checkout`, `order_set_status`, `order_set_payment`, `order_update`, `delete_order` (solo pedidos cancelados), `cash_*`, `inventory_*`, `save_product`, `delete_product`, `save_category`, `delete_category`, `save_department`, `reorder_rows`, `set_integration_secret`, `integrations_status`, `cloudinary_signature`, `whoami`, `visits_summary`, `visits_live`, `visits_forget` (equipo), `estudio_crear`, `estudio_estado`, `estudio_regenerar`, `estudio_guardar_ficha` (administradores) y `estudio_worker_*` (la cola, con su llave). Las visitas viven en `page_views` (solo lectura para el equipo; se borran solas a los 13 meses). Se puede volver a ejecutar.
- `private.store_products` (vista): cada prenda a la venta ya en el formato de la tienda; la usan `storefront()` y `product_page()`.
- `supabase/datos/*.json` → `npm run seed:build` → `supabase/seed.sql` (no se edita a mano).
- `supabase/actualizaciones/*.sql`: correcciones de datos para bases que ya existían.

## Estilos

- Tienda: `src/styles/main.css` importa en orden base → componentes → secciones → páginas. Tokens en `src/styles/base/tokens.css`; vidrio líquido con `class="glass"` (+ `glass--strong`, `glass--dark`, `glass--live`).
- Panel: `src/admin/styles/` (tokens en `base.css`).

## Calidad

`npm run verify` ejecuta `astro check` (tipos), `eslint`, `vitest` y la compilación. Las pruebas viven junto al código (`src/lib/*.test.ts`).

## Estado en la URL

- Tienda: `/tienda?depto=mujer&cat=vestidos&talla=M&color=negro&min=200&max=500&oferta=1&nuevo=1&disponible=1&q=satín&orden=precio-asc`
- Cualquier página: `?p=<slug>` abre la vista rápida de ese producto.
- Prenda: `/producto/<slug>` (opcional `?color=<nombre>`).
