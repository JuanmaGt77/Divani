-- =============================================================================
--  Actualización del 19 de octubre de 2026: portada con prendas («vitrina»)
--
--  Los banners ahora forman la portada de la tienda: cada uno tiene un color de fondo
--  (arena, marfil, rosa, salvia o tinta) y muestra prendas con su precio. Las dos cosas se
--  guardan juntas en la columna theme como JSON (no cambia la estructura de la base):
--    {"color": "rosa", "showcase": {"source": "ofertas"}}
--
--  Da color y prendas a los tres banners de ejemplo, solo si siguen con el color de fábrica
--  (no pisa lo que ya configuraste en el panel). Se puede ejecutar más de una vez.
--  Ya se aplicó en la base de Divani el 19 de octubre de 2026 (desde el panel, sin SQL).
-- =============================================================================
begin;

update public.banners set theme = '{"color":"arena","showcase":{"source":"nuevo"}}'
 where id = '9d11ee3b-de41-4e89-9e18-cb9fe79aa53c' and theme in ('light', 'arena', '');

update public.banners set theme = '{"color":"rosa","showcase":{"source":"ofertas"}}'
 where id = '5f120398-e20c-4f86-b1a7-5a9ced9e2aa3' and theme in ('light', 'arena', '');

update public.banners set theme = '{"color":"salvia","showcase":{"source":"categoria","category":"jeans-y-pantalones"}}'
 where id = 'e94095ef-2743-4861-8270-2bebc53c3c10' and theme in ('light', 'arena', '');

commit;
