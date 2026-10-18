# Supabase · base de datos de Divani

| Archivo | Qué hace |
| --- | --- |
| `schema.sql` | Tablas, reglas de seguridad por fila (RLS), funciones del negocio (tienda, pedidos, punto de venta, caja, inventario, productos, categorías, firma de Cloudinary) y el administrador inicial. Se puede volver a ejecutar para actualizar. |
| `seed.sql` | Catálogo de ejemplo (departamentos, categorías, productos con sus variantes y existencias, banners, look, preguntas, contenido de la portada y ajustes). **Generado** con `npm run seed:build` desde `datos/*.json`: no lo edites a mano. |
| `datos/*.json` | Fuente del catálogo de ejemplo y de los textos de fábrica de la portada. |
| `actualizaciones/*.sql` | Correcciones de datos para bases que ya existían (por ejemplo, textos o región). Se ejecutan en orden por fecha y se pueden repetir. |

Orden: `schema.sql` → `seed.sql` (solo la primera vez) → `actualizaciones/`. Guía completa en [`docs/CONEXION.md`](../docs/CONEXION.md).

## Lo que puede hacer cada quien

- **Público (tienda)**: `storefront()` (catálogo, contenido y ajustes públicos, sin costos), `product_page(slug)` (una prenda y parecidas), `storefront_sitemap()` (direcciones de las prendas) y `place_order()` (crea un pedido validando existencias y precios en el servidor).
- **Equipo con sesión iniciada** (`public.staff`): todo el panel. Las operaciones que mueven dinero o inventario (`pos_checkout`, `order_set_status`, `cash_close`, `inventory_adjust`…) son funciones transaccionales: o se hace todo o no se hace nada.
- **Nadie desde la página**: el esquema `private` (secretos cifrados, lista de administradores iniciales y la vista `store_products`).

## Reglas que aplica la base de datos

- Un pedido en línea descuenta inventario al pasar a *confirmado* (o preparando, enviado, entregado) y lo regresa si se cancela.
- Una venta del punto de venta descuenta al momento y necesita una caja abierta.
- Efectivo esperado en caja = fondo inicial + ventas en efectivo + ingresos − retiros − gastos.
- Cancelar una venta en efectivo de un corte ya cerrado registra un retiro en la caja abierta.
- Cada movimiento de inventario queda en el kardex (`inventory_movements`) con quién y cuándo.
- Una categoría con productos no se puede eliminar ni cambiar de departamento.
