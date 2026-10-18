# Divani · Tienda en línea y panel de administración

Tienda de ropa americana premium (Guatemala) con compra por WhatsApp y un panel para administrar todo: productos, inventario, pedidos, punto de venta, caja con cortes, reportes, clientes, la portada del sitio y la configuración. Hecha con **Astro + React + TypeScript**, base de datos en **Supabase**, fotos en **Cloudinary** y publicada en **Cloudflare**.

| Tienda (escritorio) | Tienda (celular) | Catálogo |
| --- | --- | --- |
| ![Inicio en escritorio](docs/capturas/inicio-escritorio.jpg) | ![Inicio en celular](docs/capturas/inicio-celular.jpg) | ![Tienda](docs/capturas/tienda-escritorio.jpg) |

| Panel · Resumen | Panel · Punto de venta | Panel · Sitio web | Panel en celular |
| --- | --- | --- | --- |
| ![Resumen](docs/capturas/panel-resumen.jpg) | ![Punto de venta](docs/capturas/panel-punto-de-venta.jpg) | ![Sitio web](docs/capturas/panel-sitio-web.jpg) | ![Panel en celular](docs/capturas/panel-celular.jpg) |

---

## Qué incluye

### Tienda (`/`, `/tienda`, `/producto/…`)
- Portada con video de marca, cintas, categorías, novedades, banners, «arma tu look», niñas y niños, acerca de nosotros, cómo comprar, hombre, preguntas frecuentes y lista VIP. **Todo lo de la portada se cambia desde el panel.**
- Catálogo con filtros (departamento, categoría, talla, color, precio, ofertas), búsqueda y vista rápida con existencias **por color y talla**. Los filtros quedan en la dirección para poder compartirlos.
- Una página por prenda (`/producto/vestido-slip-satinado`) con foto, nombre y precio para que se vea bien al compartirla por WhatsApp o redes, y datos para buscadores.
- Bolsa y pedido por WhatsApp: el pedido se registra primero (el servidor valida existencias y precios) y WhatsApp se abre con el número de pedido oficial.
- Precios, moneda, lada y textos según la región (Guatemala por defecto; también México o Estados Unidos).

### Panel (`/admin`)
| Sección | Qué haces ahí |
| --- | --- |
| **Resumen** | Ventas de hoy y del mes, ticket promedio, pedidos por atender, gráfica de ventas, lo más vendido, existencias y avisos. |
| **Pedidos** | Pedidos de la tienda y de WhatsApp: estados (nuevo → confirmado → en preparación → enviado → entregado), pagos, notas, mensajes listos para WhatsApp, impresión de la nota. |
| **Punto de venta** | Venta en mostrador: buscar o escanear SKU, tallas, descuentos, cobro en efectivo (con cambio), tarjeta, transferencia o mixto, ticket impreso. |
| **Caja** | Apertura con fondo, ingresos, retiros y gastos, efectivo esperado, corte con conteo por billetes y monedas, diferencias y reporte del corte. |
| **Productos** | Alta y edición con fotos por color, precios, oferta, costo y margen, tallas, SKU automático por variante y etiquetas con código de barras. |
| **Inventario** | Existencias por variante, ajustes con motivo, entrada de mercancía, kardex completo y alertas de últimas piezas. |
| **Clientes** | Se registran solos con cada pedido: historial, frecuentes, por reactivar y contacto por WhatsApp. |
| **Reportes** | Ventas por periodo con filtros, comparación con el periodo anterior, productos, cortes de caja y exportación a CSV/impresión. |
| **Sitio web** | Vista previa en vivo (computadora o iPhone): toca cualquier sección para cambiar sus fotos y textos. Banners con fechas, categorías, «arma tu look» y preguntas frecuentes. |
| **Configuración** | Tienda y contacto, región y moneda, pedidos en línea, punto de venta y caja, inventario, conexiones (Cloudinary), cuenta y respaldo. |

---

## Trabajar en tu computadora

Requisitos: **Node.js 22.22 o superior** (recomendado 24).

```bash
npm install
npm run dev          # tienda http://localhost:5173  ·  panel http://localhost:5173/admin
```

La tienda y el panel necesitan Supabase: el archivo `.env.local` (no se sube a GitHub) debe tener `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Copia `.env.example` como `.env.local` y llénalo. Guía completa: **[docs/CONEXION.md](docs/CONEXION.md)**.

| Comando | Para qué |
| --- | --- |
| `npm run dev` | Tienda y panel en modo desarrollo |
| `npm run build` | Genera el sitio en `dist/` (falla si faltan las variables de Supabase) |
| `npm run preview` | Prueba `dist/` con el mismo motor de Cloudflare |
| `npm run verify` | Revisión completa: tipos, estilo de código, pruebas y compilación |
| `npm run deploy` | Compila y publica en Cloudflare |
| `npm run seed:build` | Regenera `supabase/seed.sql` desde `supabase/datos/*.json` |
| `npm run setup:supabase` | Prepara Supabase (SQL, usuario administrador, Cloudinary) |

## Publicar en Cloudflare

Ver **[docs/CONEXION.md → Publicar la tienda](docs/CONEXION.md#publicar-la-tienda-en-cloudflare)**. En resumen: Cloudflare → Workers & Pages → importar el repositorio de GitHub, comando de compilación `npm run build`, comando de publicación `npx wrangler deploy` y las variables `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `PUBLIC_SITE_URL`.

---

## Estructura

```
divani/
├── src/
│   ├── pages/            Páginas de Astro: index, tienda, producto/[slug], admin/[...ruta], 404, aviso de privacidad, sitemap y robots
│   ├── layouts/          StoreLayout.astro: <head>, íconos, encabezado, pie y hojas de la tienda
│   ├── components/       Componentes de Astro (íconos SVG, página no encontrada)
│   ├── store/            Tienda en React: islands/ (secciones interactivas) · components/ · data/ · state/ · lib/
│   ├── admin/            Panel en React: api/ · pages/ · components/ · ui/ · lib/ · layout/ · styles/
│   ├── lib/              Compartido: tipos, formato (moneda y fechas), reglas de presentación, consultas del catálogo
│   └── styles/           Estilos de la tienda (tokens, vidrio, componentes, secciones, páginas)
├── supabase/             schema.sql · seed.sql (generado) · datos/*.json · actualizaciones/*.sql
├── scripts/              build-seed.ts (genera seed.sql) · setup-supabase.mjs (prepara Supabase)
├── public/               imágenes, video, logotipos e íconos
└── docs/                 CONEXION.md · ARQUITECTURA.md · capturas/
```

Detalles técnicos en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Seguridad

- La página solo lleva la **clave publicable** de Supabase. Las reglas por fila (RLS) dejan que el público lea el catálogo y cree pedidos; costos, clientes, caja y reportes solo los ve el equipo con sesión iniciada.
- Las reglas del negocio (existencias, precios, caja) se aplican en la base de datos: la página no puede saltárselas.
- El **API Secret de Cloudinary** se guarda cifrado en la base de datos y solo el servidor lo usa para firmar subidas.
- Ninguna contraseña ni llave secreta vive en el código: `.env` y `.env.local` están en `.gitignore`, y la compilación no copia esos archivos al servidor.
- El panel no aparece en buscadores (`noindex`, `robots.txt`) ni se guarda en caché.

## Diseño

Mismo ADN en tienda y panel: marfil, arena y tinta, vidrio líquido estilo iOS 26, tipografías Bodoni Moda y Jost. Tokens de la tienda en `src/styles/base/tokens.css`; del panel en `src/admin/styles/base.css`. Respeta «reducir movimiento» y áreas táctiles de 44 px.
