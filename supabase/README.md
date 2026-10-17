# Supabase · base de datos de Divani

| Archivo | Qué hace |
| --- | --- |
| `schema.sql` | Tablas, reglas de seguridad por fila (RLS), funciones del negocio (pedidos, punto de venta, caja, inventario, productos, firma de Cloudinary) y el administrador inicial. Se puede volver a ejecutar para actualizar. |
| `seed.sql` | Catálogo inicial (departamentos, categorías, productos con sus variantes y existencias, banners, look, preguntas, contenido de la portada y ajustes). No sobrescribe lo que ya cambiaste desde el panel. Se genera con `npm run seed:build`. |

Orden: primero `schema.sql`, después `seed.sql`. Guía completa en [`docs/CONEXION.md`](../docs/CONEXION.md).

## Lo que puede hacer cada quien

- **Público (tienda)**: solo `storefront()` (catálogo, contenido y ajustes públicos, sin costos) y `place_order()` (crea un pedido validando existencias y precios en el servidor).
- **Equipo con sesión iniciada** (`public.staff`): todo el panel. Las operaciones que mueven dinero o inventario (`pos_checkout`, `order_set_status`, `cash_close`, `inventory_adjust`…) son funciones transaccionales: o se hace todo o no se hace nada.
- **Nadie desde la página**: el esquema `private` (llaves de Cloudinary y lista de administradores iniciales).

## Reglas que aplica la base de datos

- Un pedido en línea descuenta inventario al pasar a *confirmado* (o preparando, enviado, entregado) y lo regresa si se cancela.
- Una venta del punto de venta descuenta al momento y necesita una caja abierta.
- Efectivo esperado en caja = fondo inicial + ventas en efectivo + ingresos − retiros − gastos.
- Cancelar una venta en efectivo de un corte ya cerrado registra un retiro en la caja abierta.
- Cada movimiento de inventario queda en el kardex (`inventory_movements`) con quién y cuándo.
