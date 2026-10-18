# Arquitectura

Un solo proyecto de **Astro 7** con **React 19** y **TypeScript** estricto, publicado en **Cloudflare Workers**. Los datos y las reglas del negocio viven en **Supabase** (PostgreSQL); las fotos en **Cloudinary**.

| Parte | Cómo se genera | Código |
| --- | --- | --- |
| Tienda: `/`, `/tienda`, `/aviso-de-privacidad`, `/404` | HTML estático al compilar + «islas» de React | `src/pages/*.astro`, `src/store/` |
| Página de cada prenda: `/producto/[slug]` | En el Worker, en cada visita (consulta `product_page`) | `src/pages/producto/[slug].astro`, `src/store/islands/ProductPage.tsx` |
| Panel: `/admin/…` | En el Worker (cualquier dirección abre la aplicación) + React en el navegador | `src/pages/admin/[...ruta].astro`, `src/admin/` |
| `sitemap.xml`, `robots.txt` | En el Worker | `src/pages/*.ts` |

## Configuración y variables

- `astro.config.mjs`: adaptador de Cloudflare, React, direcciones limpias (`build.format: 'file'`, sin `/` final) y el esquema de variables `astro:env`. Si falta `PUBLIC_SUPABASE_URL` o `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, la compilación falla.
- `PUBLIC_SITE_URL` (opcional) es la dirección pública: se usa en las vistas previas al compartir, la dirección canónica y el mapa del sitio.
- `src/lib/env.ts` lee las variables; `src/lib/rpc.ts` llama a las funciones públicas de Supabase con `fetch` (sirve en el navegador y en el Worker).
- `wrangler.jsonc`: nombre del Worker, fecha de compatibilidad y `nodejs_compat`. El adaptador agrega el resto al compilar.

## Tienda

```
src/pages/index.astro ─┐
src/pages/tienda.astro ─┼─► src/layouts/StoreLayout.astro  (<head>, íconos, SiteHeader, SiteFooter, StoreOverlays)
producto/[slug].astro ─┘          │
                                  ▼
                 src/store/islands/   islas de React (cada sección es una)
                       ├── home/       Hero, Ribbons, Categories, NewArrivals, Promos, Bestsellers, Lookbook,
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
- **Filtros**: `src/lib/catalog-query.ts` filtra, ordena, pagina y calcula facetas (función pura con pruebas). El estado de `/tienda` vive en la URL.

### Flujo de compra

1. La tarjeta o la ficha llaman a `cart.add(producto, { color, size, qty })`; la bolsa se guarda en `localStorage` y se sincroniza entre pestañas.
2. En la bolsa, «Continuar con mi pedido» pide nombre, teléfono, ciudad, entrega y pago (se recuerdan en el navegador).
3. Al enviar: se abre una pestaña en el mismo toque, `place_order` registra el pedido (valida existencias y precios en el servidor), la bolsa se vacía y la pestaña abre WhatsApp con el número de pedido oficial. Si el navegador bloquea la pestaña, aparece un botón para abrirlo.
4. El pedido aparece al instante en el panel (aviso en tiempo real).

### Contenido editable y vista previa

- Cada sección lleva `data-edit="…"`. Con `?editar=1` dentro del panel (`src/store/lib/edit-bridge.ts`), tocar una sección abre su editor; la comunicación con el panel es por `postMessage`.
- Animaciones de aparición: `data-reveal` en cualquier elemento (`style="--d: 1"` para escalonar). `initReveal()` marca `data-in` al entrar en pantalla y vigila los elementos que agregan las islas.

## Panel

- `src/admin/App.tsx`: TanStack Query (`QueryClientProvider`), sesión y aviso de pedidos nuevos.
- `src/admin/routes.tsx`: React Router con `basename: '/admin'`; cada sección se carga al abrirla. Las direcciones viejas con `#/` se redirigen.
- `src/admin/api/`: cliente de Supabase (`client.ts`), conversión de filas a objetos (`mappers.ts`) y la interfaz `api` (`index.ts`) que usan las páginas.
- Datos: `useData(clave, fn, temas)` + `invalidate(tema)` (`lib/query.ts`); avisos con `toast()`; hojas con `<Sheet>` (`ui/overlays.tsx`); cambios sin guardar con `useUnsavedChanges` (`lib/navigation.ts`).

## Base de datos (Supabase)

- `supabase/schema.sql`: tablas, seguridad por fila (RLS) y **todas** las reglas del negocio como funciones: `storefront`, `product_page`, `storefront_sitemap`, `place_order` (públicas) y `pos_checkout`, `order_set_status`, `order_set_payment`, `order_update`, `cash_*`, `inventory_*`, `save_product`, `delete_product`, `save_category`, `delete_category`, `save_department`, `reorder_rows`, `set_integration_secret`, `integrations_status`, `cloudinary_signature`, `whoami` (equipo). Se puede volver a ejecutar.
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
