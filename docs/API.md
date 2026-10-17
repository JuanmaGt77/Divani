# Contrato de la API (backend)

El frontend consume una API REST en `VITE_API_URL` (por ejemplo `https://api.divani.mx/v1`). Mientras esa variable esté vacía, la tienda usa los JSON de `public/data/`, que ya tienen **exactamente la misma forma** que deben devolver estos endpoints.

- Formato: JSON, UTF-8. Precios en pesos mexicanos (enteros o con decimales).
- Rutas de imágenes: URL absolutas (`https://cdn…/foto.webp`) o relativas al sitio.
- Errores: código HTTP adecuado y cuerpo `{ "error": { "message": "Texto para el cliente" } }`.
- CORS: permite el dominio de la tienda (`Access-Control-Allow-Origin`).

| Método | Ruta | Uso en la tienda |
| --- | --- | --- |
| GET | `/settings` | Cinta de avisos, opciones de entrega y pago, búsquedas populares |
| GET | `/categories` | Departamentos, categorías y familias de color |
| GET | `/products` | Catálogo, filtros, búsqueda, novedades, carriles |
| GET | `/products/:slug` | Vista rápida / enlaces compartidos |
| GET | `/banners?placement=` | Carrusel y banners de la portada |
| GET | `/lookbooks` | Sección «Arma tu look» |
| GET | `/faq` | Preguntas frecuentes |
| POST | `/orders` | Registrar el pedido antes de abrir WhatsApp |
| POST | `/subscribers` | (Opcional) lista VIP |

---

## GET /products

Parámetros (todos opcionales):

| Parámetro | Ejemplo | Descripción |
| --- | --- | --- |
| `department` | `mujer` | `mujer`, `ninas`, `ninos`, `hombre` |
| `category` | `vestidos,faldas` | Slugs separados por coma |
| `size` | `S,M` | Tallas con existencia (`stock > 0`) |
| `color` | `negro,beige` | Familias de color |
| `minPrice` / `maxPrice` | `500` / `1200` | Rango de precio |
| `onSale` | `true` | Solo con `compareAtPrice > price` |
| `isNew` | `true` | Solo novedades |
| `isBestseller` | `true` | Solo más pedidos |
| `inStock` | `true` | Oculta agotados |
| `q` | `mezclilla` | Búsqueda en nombre, descripción, material, etiquetas, colores y categoría |
| `ids` | `slug-1,slug-2` | Productos específicos (favoritos, look) |
| `sort` | `nuevo` | `destacados` (predeterminado), `nuevo`, `populares`, `precio-asc`, `precio-desc` |
| `page` / `pageSize` | `1` / `12` | Paginación (máx. 100 por página) |

Respuesta:

```json
{
  "data": [ { …Producto } ],
  "meta": { "total": 45, "page": 1, "pageSize": 12, "pages": 4 },
  "facets": {
    "categories": { "vestidos": 6, "faldas": 3 },
    "sizes": { "S": 18, "M": 21 },
    "colors": { "negro": 9, "beige": 11 },
    "price": { "min": 299, "max": 1890 }
  }
}
```

`facets` se calcula sobre los productos que coinciden con `department` y `q` (sin los demás filtros), para que el panel de filtros muestre todas las opciones disponibles. La implementación de referencia está en `src/services/api/query.js`.

### Producto

```json
{
  "id": "DV-0001",
  "sku": "DV-MUJ-001",
  "slug": "vestido-slip-satinado",
  "name": "Vestido slip satinado",
  "department": "mujer",
  "category": "vestidos",
  "price": 899,
  "compareAtPrice": 1190,
  "currency": "MXN",
  "description": "Corte al bies con caída líquida y escote en V.",
  "details": ["Tirantes ajustables", "Largo midi"],
  "material": "Satín de poliéster",
  "care": "Lavar a mano en agua fría.",
  "origin": "Importado de EE. UU.",
  "colors": [
    {
      "name": "Champagne",
      "hex": "#E3CFAE",
      "family": "beige",
      "images": ["https://cdn…/vestido-champagne-1.webp", "https://cdn…/vestido-champagne-2.webp"]
    }
  ],
  "sizes": [
    { "label": "S", "stock": 3 },
    { "label": "M", "stock": 0 }
  ],
  "isNew": true,
  "isBestseller": false,
  "isFeatured": true,
  "tags": ["satín", "fiesta"],
  "createdAt": "2026-10-12"
}
```

Notas:
- `images[0]` es la foto principal; `images[1]` (opcional) se muestra al pasar el cursor y en la galería.
- `compareAtPrice` puede ser `null`.
- Etiquetas que calcula el frontend: «Agotado» (existencia total 0), «−X %» (descuento), «Nuevo» (`isNew`) y «Últimas piezas» (existencia total ≤ 2, configurable en `CATALOG.lowStock`).

## GET /products/:slug

Devuelve un **Producto** o `404` si no existe.

## GET /categories

```json
{
  "departments": [
    { "slug": "mujer", "name": "Mujer", "description": "…", "image": "images/categories/vestidos.webp" }
  ],
  "categories": [
    { "slug": "vestidos", "department": "mujer", "name": "Vestidos", "description": "…", "image": "…", "order": 1, "productCount": 6 }
  ],
  "colorFamilies": [
    { "id": "negro", "name": "Negro", "hex": "#1B1A19" },
    { "id": "estampado", "name": "Estampados", "hex": "pattern" }
  ]
}
```

Admite `?department=mujer` para devolver solo esas categorías.

## GET /banners?placement=home-carousel

Ubicaciones usadas: `home-carousel` (carrusel principal). `home-kids` y `home-men` quedan listas para usarse.

```json
[
  {
    "id": "bn-rebajas",
    "placement": "home-carousel",
    "eyebrow": "Rebajas de temporada",
    "title": "Hasta *30%* en piezas seleccionadas",
    "text": "…",
    "cta": { "label": "Ver ofertas", "href": "tienda.html?oferta=1" },
    "image": "media/banners/rebajas.webp"
  }
]
```

En `title`, el texto entre `*asteriscos*` se muestra en cursiva.

## GET /lookbooks

```json
[
  {
    "id": "look-sastreria-suave",
    "eyebrow": "Arma tu look",
    "title": "Sastrería *suave*",
    "text": "…",
    "image": "images/lookbook/look-01.webp",
    "hotspots": [ { "product": "blazer-sastre", "color": "Marfil", "x": 26.7, "y": 44 } ]
  }
]
```

`x` y `y` son porcentajes sobre la imagen (puntos interactivos).

## GET /settings

```json
{
  "announcements": ["Ropa americana con etiqueta original", "Envíos a todo México"],
  "checkout": {
    "deliveryMethods": [ { "id": "envio", "label": "Envío a domicilio", "requiresAddress": true } ],
    "paymentMethods": [ { "id": "transferencia", "label": "Transferencia" } ],
    "freeShippingFrom": null,
    "note": "El costo y tiempo de envío te los confirmamos por WhatsApp según tu ciudad."
  },
  "popularSearches": ["Vestidos", "Mezclilla"]
}
```

`freeShippingFrom` (número o `null`) activa la barra de «Te faltan $X para envío gratis» en la bolsa.

## GET /content

Fotos y textos de la portada que se editan en el panel (Sitio web → Portada). Mismo formato que `public/data/content.json`:

```json
{
  "hero": { "eyebrow": "…", "title": "Moda americana, *elegida para ti.*", "subtitle": "…", "video": "…mp4", "videoPortrait": "…mp4", "poster": "…", "posterPortrait": "…" },
  "ribbons": { "primary": ["…"], "secondary": ["…"] },
  "editorial": { "image": "…", "eyebrow": "…", "title": "…" },
  "kids": { "title": "…", "lead": "…", "girlsImage": "…", "boysImage": "…" },
  "about": { "title": "…", "image": "…", "paragraphs": ["…"] },
  "men": { "title": "…", "bannerTitle": "…", "image": "…" },
  "vip": { "title": "…", "text": "…", "image": "…" }
}
```

Las partes entre `*asteriscos*` se muestran en cursiva. Si tu backend no tiene esta ruta, la tienda usa los textos del HTML.

> Con Supabase no necesitas un backend propio: la función `storefront()` de `supabase/schema.sql` entrega todo esto en una sola llamada y `place_order()` registra los pedidos.

## GET /faq

```json
[ { "q": "¿La ropa es original?", "a": "Sí. Todas nuestras prendas…" } ]
```

## POST /orders

Se llama cuando el cliente presiona «Enviar pedido por WhatsApp» (solo si `VITE_API_URL` está definido).

Cuerpo:

```json
{
  "items": [ { "slug": "vestido-slip-satinado", "sku": "DV-MUJ-001", "color": "Champagne", "size": "M", "qty": 1, "price": 899 } ],
  "customer": { "name": "Ana López", "phone": "3312345678", "city": "Guadalajara, Jalisco", "address": "Av. Chapultepec 123…" },
  "delivery": "envio",
  "payment": "transferencia",
  "notes": "",
  "subtotal": 899,
  "channel": "whatsapp"
}
```

Respuesta `201`:

```json
{ "orderNumber": "DV-000123", "status": "pendiente", "createdAt": "2026-10-16T18:20:00Z", "total": 899 }
```

Recomendado en el backend: volver a validar precios y existencias (no confíes en los precios que manda el navegador) y apartar las piezas por un tiempo mientras se confirma el pago.

## POST /subscribers (opcional)

```json
{ "name": "Ana", "phone": "3312345678" }
```

---

## Modelo de datos sugerido

```
departments (slug PK, name, description, image, order)
categories  (slug PK, department → departments, name, description, image, order)
products    (id PK, sku, slug UNIQUE, name, department, category → categories, price, compare_at_price,
             description, details JSON, material, care, origin, is_new, is_bestseller, is_featured,
             tags JSON, created_at, published)
product_colors (id PK, product_id → products, name, hex, family, position)
product_images (id PK, color_id → product_colors, url, position)
product_sizes  (id PK, product_id → products, label, stock, position)
banners     (id PK, placement, eyebrow, title, text, cta_label, cta_href, image, position, active, starts_at, ends_at)
lookbooks   (id PK, eyebrow, title, text, image) + lookbook_hotspots (lookbook_id, product_slug, color, x, y)
orders      (id PK, order_number UNIQUE, customer JSON, delivery, payment, notes, subtotal, status, created_at)
order_items (id PK, order_id → orders, product_id, sku, name, color, size, qty, price)
settings    (key PK, value JSON)
faq         (id PK, question, answer, position)
```
