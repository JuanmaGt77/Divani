-- =============================================================================
--  Actualización del 18 de octubre de 2026: tienda en Guatemala y ropa americana premium
--
--  Corrige los datos que ya están en Supabase (cargados con la versión anterior):
--   · Los textos de la tienda ya no hablan de «etiqueta original»: la ropa es americana premium.
--   · Envíos «a toda Guatemala» en lugar de «a todo México».
--   · Región Guatemala: quetzales (GTQ), lada +502 y billetes y monedas de quetzal en la caja.
--   · Enlaces de los banners con las direcciones nuevas (/tienda en lugar de tienda.html).
--
--  Solo cambia esas frases: lo que ya hayas editado en el panel se respeta.
--  Se puede ejecutar más de una vez.
--  Cómo: primero supabase/schema.sql y después este archivo (Supabase → SQL Editor → Run).
-- =============================================================================
begin;

-- Cambia las frases viejas por las nuevas dentro de un texto (o de un JSON convertido a texto)
create or replace function pg_temp.fix_text(t text) returns text language sql immutable as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(replace(coalesce(t, ''),
    'Prendas con etiqueta original, seleccionadas para', 'Ropa americana premium, seleccionada para'),
    'Ropa americana. *Etiqueta original.*', 'Ropa americana. *Calidad premium.*'),
    'Traemos desde Estados Unidos prendas con su etiqueta original y las seleccionamos con cuidado, pensando en cómo te van a quedar y en cuánto las vas a usar.',
    'Traemos desde Estados Unidos ropa americana premium y la seleccionamos con cuidado, pensando en cómo te va a quedar y en cuánto la vas a usar.'),
    'Ropa americana con etiqueta original', 'Ropa americana premium'),
    'Mezclilla con *etiqueta original*', 'Mezclilla *americana*'),
    'Todas nuestras prendas son importadas de Estados Unidos y llegan con su etiqueta original.',
    'Toda nuestra ropa es americana premium, traída de Estados Unidos.'),
    'conserva su etiqueta,', 'en las mismas condiciones en que la recibiste,'),
    'Etiqueta original', 'Calidad premium'),
    'todo México', 'toda Guatemala');
$$;

-- Direcciones viejas (tienda.html, index.html#…) → nuevas (/tienda, /#…)
create or replace function pg_temp.fix_href(h text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(coalesce(h, ''), '^(\./)?tienda\.html', '/tienda'), '^(\./)?index\.html', '/');
$$;

-- Portada (textos editables)
update public.site_content
   set value = pg_temp.fix_text(value::text)::jsonb, updated_at = now()
 where value::text <> pg_temp.fix_text(value::text);

-- Banners
update public.banners
   set eyebrow = pg_temp.fix_text(eyebrow), title = pg_temp.fix_text(title), text = pg_temp.fix_text(text),
       cta_href = pg_temp.fix_href(cta_href)
 where (eyebrow, title, text, cta_href) is distinct from
       (pg_temp.fix_text(eyebrow), pg_temp.fix_text(title), pg_temp.fix_text(text), pg_temp.fix_href(cta_href));

-- Arma tu look
update public.lookbooks
   set eyebrow = pg_temp.fix_text(eyebrow), title = pg_temp.fix_text(title), text = pg_temp.fix_text(text)
 where (eyebrow, title, text) is distinct from (pg_temp.fix_text(eyebrow), pg_temp.fix_text(title), pg_temp.fix_text(text));

-- Preguntas frecuentes
update public.faq
   set question = pg_temp.fix_text(question), answer = pg_temp.fix_text(answer)
 where (question, answer) is distinct from (pg_temp.fix_text(question), pg_temp.fix_text(answer));

-- Ajustes: avisos, región Guatemala y denominaciones de la caja en quetzales
update public.settings
   set public = (pg_temp.fix_text(public::text)::jsonb - 'whatsappNote')
                || jsonb_build_object('region', jsonb_build_object(
                     'preset', 'gt', 'locale', 'es-GT', 'currency', 'GTQ', 'currencyName', 'quetzales',
                     'phonePrefix', '502', 'shippingArea', 'toda Guatemala',
                     'cityLabel', 'Municipio y departamento', 'cityPlaceholder', 'Ej. Mixco, Guatemala')),
       private = private || jsonb_build_object('cash', coalesce(private->'cash', '{}'::jsonb) || jsonb_build_object(
                     'denominations', jsonb_build_object('bills', '[200, 100, 50, 20, 10, 5, 1]'::jsonb,
                                                         'coins', '[1, 0.5, 0.25, 0.1, 0.05, 0.01]'::jsonb))),
       updated_at = now()
 where id = 1;

commit;
