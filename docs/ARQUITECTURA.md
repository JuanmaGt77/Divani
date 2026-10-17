# Arquitectura

Dos aplicaciones en el mismo proyecto de Vite que comparten el modelo de datos:

- **Tienda** (`index.html`, `tienda.html`…): JavaScript moderno sin frameworks (módulos ES). Cada página tiene un punto de entrada en `src/pages/` que arranca lo común (`src/app.js`) y sus secciones.
- **Panel** (`admin.html`): Preact + JSX en `src/admin/`, con rutas por hash (`#/pedidos`), secciones que se cargan al abrirlas y componentes estilo iOS.
- **Compartido** (`src/backend/`): reglas del negocio en JavaScript puro (`model.js`, `ops.js`) que el SQL de Supabase replica exactamente, la base de demostración (`demo/`) y la configuración (`config.js`).

## Capas

```
HTML (index.html, tienda.html…)  +  fragmentos en src/partials/
        │
        ▼
src/pages/*.js            Punto de entrada de cada página
        │
        ├── src/sections/       Secciones de la portada (pintan datos en el HTML)
        ├── src/components/     Piezas reutilizables: hojas, bolsa, vista rápida, búsqueda…
        │
        ▼
src/store/                Estado del cliente (bolsa y favoritos) en localStorage, con suscripción
        │
        ▼
src/services/             Casos de uso: catálogo, contenido, pedidos, mensajes de WhatsApp
        │
        ▼
src/services/api/         Origen de datos según configuración (index.js)
        ├── supabase.adapter.js → rpc/storefront y rpc/place_order   (VITE_SUPABASE_URL)
        ├── demo.adapter.js     → base del panel en este navegador   (demostración)
        ├── mock.adapter.js     → public/data/*.json                 (catálogo de muestra)
        └── rest.adapter.js     → VITE_API_URL                        (backend propio)
```

Supabase y la demostración entregan un mismo «paquete de la tienda» (`payload.adapter.js`): productos con existencias por color y talla, categorías, banners vigentes, looks, preguntas, contenido de la portada y ajustes públicos, todo en una sola carga.

Regla: los componentes **nunca** hacen `fetch` directo; siempre pasan por un servicio. Así, conectar el backend no toca la interfaz.

## Flujo de compra

1. La tarjeta o la vista rápida llama a `cart.add(producto, { color, talla, cantidad })`.
2. `cart.store.js` guarda la bolsa en `localStorage` y avisa a sus suscriptores (contadores del encabezado y de la barra inferior, hoja de la bolsa).
3. En la hoja de la bolsa, el paso «Tus datos» arma el pedido con `OrderService.preview()`; el enlace `https://wa.me/<número>?text=<mensaje>` se actualiza mientras el cliente escribe.
4. Al presionar «Enviar pedido por WhatsApp»:
   - **Catálogo de muestra**: el enlace abre WhatsApp directamente.
   - **Con base de datos** (Supabase, demostración o backend propio): se abre una pestaña en el mismo toque, `OrderService.submit()` registra el pedido (valida existencias y precios en el servidor), la bolsa se vacía y la pestaña abre WhatsApp con el número de pedido oficial. Si el navegador bloquea la pestaña, la hoja muestra el botón para abrirlo.
5. El pedido aparece al instante en el panel (Pedidos) con aviso en tiempo real.

## Contenido editable de la portada

- Cada texto o foto editable lleva `data-slot="seccion.campo"` (`src/sections/site-content.js`); si el panel aún no tiene un valor, se queda el del HTML.
- Cada sección lleva `data-edit="…"`. Con `?editar=1` dentro del panel (`src/core/edit-bridge.js`), tocar una sección abre su editor y la vista previa se recarga en el mismo punto al guardar.
- Los ajustes del panel (nombre, WhatsApp, horario, redes, región y moneda) se aplican con `src/core/site-settings.js`.

## Componentes clave

| Archivo | Qué hace |
| --- | --- |
| `components/sheet.js` | Controla los `<dialog>`: abrir/cerrar con animación, bloqueo de scroll, foco, Esc, tocar fuera y arrastrar hacia abajo en celular |
| `components/island.js` | Notificación tipo Dynamic Island (`notify({ title, sub, image, action })`) |
| `components/product-card.js` | Plantilla de tarjeta, caché de productos mostrados y tarjeta compacta |
| `components/quick-view.js` | Detalle de producto en hoja: galería, colores, tallas, cantidad, WhatsApp, compartir |
| `components/cart.js` | Bolsa y pedido en dos pasos, validación y enlace de WhatsApp |
| `components/header.js` | Estado al hacer scroll, contadores, mega menú, cinta de avisos, enlaces de WhatsApp y redes |
| `components/segmented.js` | Control segmentado con «lente» deslizante |
| `components/tabbar.js` | Barra inferior estilo iOS 26 que se compacta al bajar |
| `services/api/query.js` | Filtros, orden, paginación y facetas (función pura, reutilizable en Node) |

## Acciones declarativas en el HTML

`src/app.js` escucha clics en todo el documento:

- `data-open="cart|favorites|search|menu|sizes"` abre la hoja correspondiente.
- `data-product-link="<slug>"` abre la vista rápida (Ctrl/⌘ + clic abre la tienda en otra pestaña).
- `data-quick-add="<slug>" data-size="M"` agrega directo a la bolsa.
- `data-fav="<slug>"` marca o desmarca favorito.
- `data-wa="greeting|vip"` recibe el enlace de WhatsApp con el mensaje correspondiente.

## Estilos

- `styles/base/tokens.css`: paleta, tipografía, espaciado, radios, curvas de animación y capas (`z-index`).
- `styles/components/glass.css`: material de vidrio líquido. Úsalo con `class="glass"` (+ `glass--strong`, `glass--dark`, `glass--live` para el reflejo que sigue al cursor).
- Animaciones de aparición: agrega `data-reveal` a cualquier elemento (y `style="--d: 1"` para escalonar). Se desactivan solas con «reducir movimiento».

## Estado en la URL

- Tienda: `?depto=mujer&cat=vestidos&talla=M&color=negro&min=500&max=1200&oferta=1&nuevo=1&disponible=1&q=satín&orden=precio-asc`
- Cualquier página: `?p=<slug>` abre la vista rápida de ese producto (enlaces para compartir por WhatsApp o redes).
