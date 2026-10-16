# Arquitectura del frontend

JavaScript moderno sin frameworks (módulos ES), empaquetado con Vite. Cada página HTML tiene un punto de entrada en `src/pages/` que arranca lo común (`src/app.js`) y sus secciones.

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
src/services/api/         Adaptador según configuración
        ├── mock.adapter.js  → public/data/*.json  (hoy)
        └── rest.adapter.js  → VITE_API_URL         (con tu backend)
```

Regla: los componentes **nunca** hacen `fetch` directo; siempre pasan por un servicio. Así, conectar el backend no toca la interfaz.

## Flujo de compra

1. La tarjeta o la vista rápida llama a `cart.add(producto, { color, talla, cantidad })`.
2. `cart.store.js` guarda la bolsa en `localStorage` y avisa a sus suscriptores (contadores del encabezado y de la barra inferior, hoja de la bolsa).
3. En la hoja de la bolsa, el paso «Tus datos» arma el pedido con `OrderService.preview()`; el enlace `https://wa.me/<número>?text=<mensaje>` se actualiza mientras el cliente escribe.
4. Al presionar «Enviar pedido por WhatsApp»:
   - **Sin backend**: el enlace abre WhatsApp directamente.
   - **Con backend**: `OrderService.submit()` hace `POST /orders`, recibe el número de pedido oficial y abre WhatsApp con él.
5. La hoja muestra «¡Tu pedido está listo!» con opción de vaciar la bolsa.

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
