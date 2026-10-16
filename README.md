# Divani · Tienda en línea

Tienda de ropa americana premium con compra por WhatsApp. Frontend completo (sin backend todavía), con una capa de datos lista para conectar tu API.

| Inicio (escritorio) | Celular | Tienda |
| --- | --- | --- |
| ![Inicio en escritorio](docs/capturas/inicio-escritorio.jpg) | ![Inicio en celular](docs/capturas/inicio-celular.jpg) | ![Tienda](docs/capturas/tienda-escritorio.jpg) |

- **Inicio** (`index.html`): video de marca, cintas, categorías, novedades, banners, «arma tu look», niñas y niños, acerca de nosotros, cómo comprar, hombre, preguntas frecuentes y lista VIP.
- **Tienda** (`tienda.html`): catálogo con departamentos, categorías, filtros (talla, color, precio, ofertas), orden, búsqueda y «cargar más». Los filtros viven en la URL, así que se pueden compartir.
- **Bolsa y pedido por WhatsApp**: el cliente arma su bolsa, llena sus datos y se abre WhatsApp con el pedido escrito (prendas, tallas, total, entrega y forma de pago).
- **Vista rápida de producto**, favoritos, búsqueda instantánea, guía de tallas americanas, notificaciones tipo Dynamic Island, barra inferior estilo iOS 26 en celular y superficies de vidrio líquido.
- Páginas extra: `404.html` y `aviso-de-privacidad.html` (plantilla).

---

## Arranque rápido

Requisitos: **Node.js 18 o superior**.

```bash
npm install
cp .env.example .env      # y escribe tu número de WhatsApp
npm run dev               # servidor local en http://localhost:5173
npm run build             # genera la versión final en dist/
npm run preview           # sirve dist/ para revisarla
```

### Publicar

La carpeta `dist/` es un sitio estático: súbela tal cual a Netlify, Vercel, Cloudflare Pages, GitHub Pages, Hostinger o cualquier hosting con cPanel. Funciona en la raíz del dominio o dentro de una subcarpeta (las rutas son relativas).

> Abrir `index.html` con doble clic no funciona: el navegador bloquea los módulos y la lectura de datos desde `file://`. Usa `npm run dev`, `npm run preview` o súbelo a un hosting.

---

## Antes de publicar (lista de revisión)

| Qué | Dónde |
| --- | --- |
| Tu número de WhatsApp | `.env` → `VITE_WHATSAPP_NUMBER` (52 + 10 dígitos, ej. `525512345678`), **o sin recompilar:** `data/settings.json` → `"whatsapp"` (también dentro de `dist/`) |
| Redes sociales, horario, dominio | `src/config/site.config.js` (`social`, `hours`, `url`) |
| Políticas de envío, pagos y cambios | `public/data/faq.json` y `public/data/settings.json` → `checkout` |
| Aviso de privacidad | `aviso-de-privacidad.html` (completa los datos marcados) |
| Textos de la cinta superior | `public/data/settings.json` → `announcements` |
| Productos y fotos reales | `public/data/products.json` + `public/images/products/` (o tu backend) |
| Imagen para compartir en redes | Cambia `og:image` en `src/partials/head.html` por la URL completa de tu dominio |

Las prendas, precios, existencias y fotos actuales **son de prueba**: las ilustraciones se generaron para la demostración. Reemplázalas con tus fotos reales antes de vender.

---

## Estructura

```
divani/
├── index.html · tienda.html · 404.html · aviso-de-privacidad.html
├── vite.config.js            # build multipágina + inserción de fragmentos HTML
├── .env.example              # WhatsApp y URL del backend
├── docs/
│   ├── API.md                # contrato REST que debe cumplir tu backend
│   └── ARQUITECTURA.md       # capas, flujo de datos y convenciones
├── public/                   # se copia tal cual a dist/
│   ├── data/                 # API de prueba (JSON) ← lo reemplaza tu backend
│   │   ├── products.json · categories.json · banners.json
│   │   └── settings.json · faq.json · lookbooks.json
│   ├── images/               # products/ · categories/ · lookbook/
│   ├── media/                # video/ (hero mp4 + webm + pósters) · banners/ · editorial/
│   ├── brand/                # logo en SVG (completo, monograma, wordmark) e imagen para compartir
│   ├── icons/                # favicon, ícono de app (iPhone/Android)
│   └── manifest.webmanifest · robots.txt
└── src/
    ├── config/site.config.js # nombre, WhatsApp, redes, API, claves de almacenamiento
    ├── core/                 # utilidades: DOM y plantillas, formato de moneda, URL, almacenamiento, animación
    ├── services/
    │   ├── api/              # index.js elige adaptador · mock.adapter.js · rest.adapter.js · query.js · http.js
    │   ├── catalog.service.js · content.service.js · order.service.js
    │   └── whatsapp.service.js   # mensajes de pedido, producto, look y favoritos
    ├── store/                # estado de la bolsa y favoritos (persistido en el navegador)
    ├── components/           # header, hojas, bolsa/checkout, vista rápida, búsqueda, favoritos, tallas…
    ├── sections/             # secciones de la portada
    ├── pages/                # home.js · shop.js · simple.js (punto de entrada de cada página)
    ├── partials/             # fragmentos HTML compartidos (head, header, footer, hojas, íconos)
    └── styles/               # base/ (tokens, tipografía) · components/ · sections/ · pages/
```

---

## Conectar tu backend

1. Implementa los endpoints de [`docs/API.md`](docs/API.md) (productos, categorías, banners, ajustes, preguntas frecuentes, pedidos).
2. En `.env` pon `VITE_API_URL=https://tu-api.com/v1` y vuelve a compilar.

Eso es todo: `src/services/api/index.js` cambia automáticamente del adaptador de prueba (`mock.adapter.js`) al real (`rest.adapter.js`). Ningún componente llama a `fetch` directamente; todos pasan por los servicios.

- La lógica de filtros y orden está en `src/services/api/query.js` como función pura: si tu backend es Node, puedes reutilizarla tal cual para responder `GET /products`.
- Con backend activo, el botón «Enviar pedido por WhatsApp» primero registra el pedido con `POST /orders` y luego abre WhatsApp con el número de pedido que devuelve tu API.

## Cambiar productos sin backend

Edita `public/data/products.json`. Cada producto lleva colores (cada color con sus fotos) y tallas con existencias:

```json
{
  "slug": "vestido-slip-satinado",
  "name": "Vestido slip satinado",
  "department": "mujer",
  "category": "vestidos",
  "price": 899,
  "compareAtPrice": 1190,
  "colors": [
    { "name": "Champagne", "hex": "#E3CFAE", "family": "beige",
      "images": ["images/products/vestido-champagne-1.webp", "images/products/vestido-champagne-2.webp"] }
  ],
  "sizes": [{ "label": "S", "stock": 3 }, { "label": "M", "stock": 0 }]
}
```

- Fotos en proporción **4:5** (recomendado 1200 × 1500 px, WebP o JPG). La segunda foto aparece al pasar el cursor.
- `stock: 0` muestra la talla tachada; si todo el producto está en 0 se marca «Agotado».
- `compareAtPrice` mayor que `price` activa la etiqueta de descuento.
- `family` agrupa colores para el filtro (negro, blanco, beige, cafe, azul, rosa, verde, gris, rojo, estampado).

## Diseño

Todos los colores, tipografías, radios y curvas de animación están en `src/styles/base/tokens.css`. El vidrio líquido vive en `src/styles/components/glass.css` (clases `.glass`, `.glass--strong`, `.glass--dark`).

Tipografías: Bodoni Moda (títulos) y Jost (texto), servidas por Google Fonts.

## Navegadores

Safari 15+ (iPhone y Mac), Chrome, Edge y Firefox recientes. Las animaciones ligadas al scroll y las esquinas «squircle» se activan solo donde el navegador las soporta; respeta la preferencia de «reducir movimiento».
