-- =============================================================================
--  Actualización del 19 de octubre de 2026: portada con prendas («vitrina»)
--
--  Los banners ahora forman la portada de la tienda: cada uno tiene un color de fondo
--  (arena, marfil, rosa, salvia o tinta) y muestra prendas con su precio.
--   · Agrega la columna showcase (qué prendas muestra cada banner).
--   · Da color y prendas a los tres banners de ejemplo, solo si nadie los configuró antes.
--   · Los colores anteriores («light» y «dark») pasan a «arena» y «tinta».
--
--  Se puede ejecutar más de una vez. Cómo: primero supabase/schema.sql y después este
--  archivo (Supabase → SQL Editor → Run).
-- =============================================================================
begin;

alter table public.banners add column if not exists showcase jsonb not null default '{}'::jsonb;
alter table public.banners alter column theme set default 'arena';

update public.banners set theme = 'arena', showcase = '{"source": "nuevo"}'::jsonb
 where id = '9d11ee3b-de41-4e89-9e18-cb9fe79aa53c' and showcase = '{}'::jsonb;

update public.banners set theme = 'rosa', showcase = '{"source": "ofertas"}'::jsonb
 where id = '5f120398-e20c-4f86-b1a7-5a9ced9e2aa3' and showcase = '{}'::jsonb;

update public.banners set theme = 'salvia', showcase = '{"source": "categoria", "category": "jeans-y-pantalones"}'::jsonb
 where id = 'e94095ef-2743-4861-8270-2bebc53c3c10' and showcase = '{}'::jsonb;

update public.banners set theme = 'arena' where theme in ('light', '');
update public.banners set theme = 'tinta' where theme = 'dark';

commit;
