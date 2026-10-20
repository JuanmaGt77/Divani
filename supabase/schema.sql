-- =============================================================================
--  DIVANI · Base de datos para Supabase (PostgreSQL 15+)
--
--  Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
--  Después ejecuta supabase/seed.sql para cargar el catálogo inicial.
--
--  Se puede volver a ejecutar sin perder datos: crea lo que falte y actualiza
--  funciones y políticas. Las reglas del negocio viven aquí: la tienda y el panel
--  solo llaman a estas funciones.
-- =============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
--  Personal con acceso al panel
-- -----------------------------------------------------------------------------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  role       text not null default 'admin' check (role in ('admin', 'vendedor')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Correos que se vuelven administradores en cuanto existe su usuario
create table if not exists private.bootstrap_admins (email text primary key);
insert into private.bootstrap_admins (email) values ('somosdivani@gmail.com') on conflict do nothing;

-- Llaves privadas de integraciones (nunca se exponen por la API)
create table if not exists private.secrets (
  name       text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
--  Catálogo
-- -----------------------------------------------------------------------------
create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  public     jsonb not null default '{}'::jsonb,
  private    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.departments (
  slug        text primary key,
  name        text not null,
  description text not null default '',
  image       text not null default '',
  sort        int not null default 0,
  active      boolean not null default true
);

create table if not exists public.categories (
  slug        text primary key,
  department  text not null references public.departments (slug) on update cascade,
  name        text not null,
  description text not null default '',
  image       text not null default '',
  sort        int not null default 0,
  active      boolean not null default true
);

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  code             text not null unique,
  name             text not null,
  department       text not null references public.departments (slug) on update cascade,
  category         text references public.categories (slug) on update cascade on delete set null,
  description      text not null default '',
  details          text[] not null default '{}',
  material         text not null default '',
  care             text not null default '',
  origin           text not null default '',
  price            numeric(12, 2) not null default 0 check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price > 0),
  cost             numeric(12, 2) not null default 0 check (cost >= 0),
  tags             text[] not null default '{}',
  is_new           boolean not null default false,
  is_bestseller    boolean not null default false,
  is_featured      boolean not null default false,
  status           text not null default 'borrador' check (status in ('activo', 'borrador', 'archivado')),
  sort             int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists products_status_idx on public.products (status);

create table if not exists public.product_colors (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name       text not null,
  hex        text not null default '#D9C6A6',
  family     text not null default 'beige',
  images     text[] not null default '{}',
  sort       int not null default 0,
  constraint product_colors_name_key unique (product_id, name) deferrable initially deferred
);

create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  color_id   uuid not null references public.product_colors (id) on delete cascade,
  size       text not null,
  sku        text not null,
  stock      int not null default 0 check (stock >= 0),
  min_stock  int check (min_stock is null or min_stock >= 0),
  active     boolean not null default true,
  sort       int not null default 0,
  constraint product_variants_sku_key unique (sku) deferrable initially deferred,
  constraint product_variants_size_key unique (color_id, size) deferrable initially deferred
);
create index if not exists product_variants_product_idx on public.product_variants (product_id);

-- -----------------------------------------------------------------------------
--  Caja, pedidos e inventario
-- -----------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1001;
create sequence if not exists public.cash_number_seq start 1;

create table if not exists public.cash_sessions (
  id             uuid primary key default gen_random_uuid(),
  number         int not null unique default nextval('public.cash_number_seq'),
  status         text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  opened_at      timestamptz not null default now(),
  opened_by      uuid default auth.uid(),
  opened_by_name text not null default '',
  opening_amount numeric(12, 2) not null default 0 check (opening_amount >= 0),
  notes          text not null default '',
  closed_at      timestamptz,
  closed_by      uuid,
  closed_by_name text not null default '',
  expected_cash  numeric(12, 2),
  counted_cash   numeric(12, 2),
  difference     numeric(12, 2),
  breakdown      jsonb,
  summary        jsonb,
  close_notes    text not null default ''
);
create unique index if not exists cash_sessions_one_open on public.cash_sessions ((true)) where status = 'abierta';

create table if not exists public.cash_movements (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.cash_sessions (id) on delete cascade,
  type            text not null check (type in ('ingreso', 'retiro', 'gasto')),
  amount          numeric(12, 2) not null check (amount > 0),
  reason          text not null default '',
  created_by      uuid default auth.uid(),
  created_by_name text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists cash_movements_session_idx on public.cash_movements (session_id);

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique default ('DV-' || nextval('public.order_number_seq')),
  channel          text not null default 'web' check (channel in ('web', 'tienda', 'whatsapp', 'otro')),
  status           text not null default 'nuevo' check (status in ('nuevo', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado')),
  payment_status   text not null default 'pendiente' check (payment_status in ('pendiente', 'pagado', 'reembolsado')),
  payment_method   text not null default '',
  payments         jsonb not null default '[]'::jsonb,
  delivery_method  text not null default '',
  customer_name    text not null default '',
  customer_phone   text not null default '',
  customer_city    text not null default '',
  customer_address text not null default '',
  notes            text not null default '',
  internal_notes   text not null default '',
  items_count      int not null default 0,
  subtotal         numeric(12, 2) not null default 0,
  discount         numeric(12, 2) not null default 0,
  shipping         numeric(12, 2) not null default 0,
  total            numeric(12, 2) not null default 0,
  cost_total       numeric(12, 2) not null default 0,
  stock_applied    boolean not null default false,
  cash_session_id  uuid references public.cash_sessions (id) on delete set null,
  created_by       uuid,
  created_by_name  text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  confirmed_at     timestamptz,
  paid_at          timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  cancel_reason    text not null default ''
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_paid_idx on public.orders (paid_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_session_idx on public.orders (cash_session_id);
create index if not exists orders_phone_idx on public.orders (customer_phone);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  sku        text not null default '',
  name       text not null,
  color      text not null default '',
  size       text not null default '',
  image      text not null default '',
  unit_price numeric(12, 2) not null default 0,
  unit_cost  numeric(12, 2) not null default 0,
  qty        int not null check (qty > 0),
  discount   numeric(12, 2) not null default 0,
  total      numeric(12, 2) not null default 0,
  sort       int not null default 0
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_events (
  id              bigint generated always as identity primary key,
  order_id        uuid not null references public.orders (id) on delete cascade,
  type            text not null,
  from_status     text,
  to_status       text,
  note            text not null default '',
  created_by      uuid default auth.uid(),
  created_by_name text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id);

create table if not exists public.inventory_movements (
  id              bigint generated always as identity primary key,
  variant_id      uuid references public.product_variants (id) on delete set null,
  product_id      uuid references public.products (id) on delete set null,
  sku             text not null default '',
  product_name    text not null default '',
  variant_label   text not null default '',
  type            text not null check (type in ('inicial', 'entrada', 'venta', 'ajuste', 'devolucion', 'cancelacion')),
  qty             int not null,
  stock_after     int,
  unit_cost       numeric(12, 2) not null default 0,
  reason          text not null default '',
  reference       text not null default '',
  order_id        uuid references public.orders (id) on delete set null,
  created_by      uuid default auth.uid(),
  created_by_name text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists inventory_movements_created_idx on public.inventory_movements (created_at desc);
create index if not exists inventory_movements_variant_idx on public.inventory_movements (variant_id);

-- -----------------------------------------------------------------------------
--  Contenido del sitio
-- -----------------------------------------------------------------------------
create table if not exists public.banners (
  id           uuid primary key default gen_random_uuid(),
  placement    text not null default 'home-carousel',
  eyebrow      text not null default '',
  title        text not null default '',
  text         text not null default '',
  cta_label    text not null default '',
  cta_href     text not null default '',
  image        text not null default '',
  image_mobile text not null default '',
  -- Presentación en la portada: un color («arena», «rosa»…) o un JSON con el color y las prendas
  -- que muestra: {"color": "rosa", "showcase": {"source": "nuevo|ofertas|populares|categoria|elegidas|ninguna",
  -- "category": "slug", "products": ["slug", …]}}. La tienda y el panel lo leen con readBannerTheme.
  theme        text not null default 'light',
  sort         int not null default 0,
  active       boolean not null default true,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.lookbooks (
  id       uuid primary key default gen_random_uuid(),
  eyebrow  text not null default '',
  title    text not null default '',
  text     text not null default '',
  image    text not null default '',
  hotspots jsonb not null default '[]'::jsonb,
  sort     int not null default 0,
  active   boolean not null default true
);

create table if not exists public.faq (
  id       uuid primary key default gen_random_uuid(),
  question text not null,
  answer   text not null,
  sort     int not null default 0,
  active   boolean not null default true
);

create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- =============================================================================
--  Utilidades
-- =============================================================================
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and active and role = 'admin');
$$;

create or replace function private.require_staff(p_admin boolean default false) returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.staff where user_id = auth.uid() and active and (not p_admin or role = 'admin')
  ) then
    raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
  end if;
end $$;

create or replace function private.staff_name() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select nullif(name, '') from public.staff where user_id = auth.uid()),
    (select email from auth.users where id = auth.uid()),
    ''
  );
$$;

create or replace function private.clean(t text, max_len int) returns text
language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), max_len);
$$;

create or replace function private.clean_text(t text, max_len int) returns text
language sql immutable as $$
  select left(btrim(replace(replace(coalesce(t, ''), E'\r\n', E'\n'), E'\r', E'\n')), max_len);
$$;

create or replace function private.unaccent_basic(t text) returns text
language sql immutable as $$
  select translate(coalesce(t, ''),
    'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC');
$$;

create or replace function private.slugify(t text) returns text
language sql immutable as $$
  select left(btrim(regexp_replace(lower(private.unaccent_basic(replace(coalesce(t, ''), '&', ' y '))), '[^a-z0-9]+', '-', 'g'), '-'), 80);
$$;

create or replace function private.color_code(n text) returns text
language plpgsql immutable as $$
declare
  w text[];
  c text;
begin
  w := regexp_split_to_array(btrim(regexp_replace(lower(private.unaccent_basic(n)), '[^a-z0-9 ]', ' ', 'g')), '\s+');
  if w is null or array_length(w, 1) is null or w[1] = '' then return 'COL'; end if;
  if array_length(w, 1) = 1 then c := left(w[1], 3); else c := left(w[1], 2) || left(w[2], 1); end if;
  return rpad(upper(c), 3, 'X');
end $$;

create or replace function private.size_code(s text) returns text
language sql immutable as $$
  select case
    when x = '' then 'U'
    when x ~ '^(UNICA|UNITALLA)' then 'UNI'
    else left(x, 5)
  end
  from (select upper(regexp_replace(lower(private.unaccent_basic(s)), '[^a-z0-9.]', '', 'g')) as x) q;
$$;

create or replace function private.make_sku(p_code text, p_color text, p_size text) returns text
language sql immutable as $$
  select concat_ws('-', nullif(p_code, ''), private.color_code(p_color), private.size_code(p_size));
$$;

create or replace function public.size_rank(label text) returns numeric
language sql immutable as $$
  select case
    when u = any (array['XXS','XS','S','M','L','XL','XXL','2XL','3XL','4XL'])
      then 200 + array_position(array['XXS','XS','S','M','L','XL','XXL','2XL','3XL','4XL'], u) - 1
    when u ~ '^\d+T$' then substring(u from '^(\d+)T$')::numeric
    when u ~ '^\d+(\.\d+)?' then 20 + substring(u from '^(\d+(?:\.\d+)?)')::numeric
    when u in ('UNICA', 'ÚNICA', 'UNITALLA', 'OS', 'U') then 900
    else 500
  end
  from (select upper(btrim(coalesce(label, ''))) as u) q;
$$;

create or replace function private.status_label(s text) returns text
language sql immutable as $$
  select case s
    when 'nuevo' then 'Nuevo' when 'confirmado' then 'Confirmado' when 'preparando' then 'En preparación'
    when 'enviado' then 'Enviado' when 'entregado' then 'Entregado' when 'cancelado' then 'Cancelado' else s end;
$$;

create or replace function private.to_int(v text, lo int, hi int, fallback int) returns int
language sql immutable as $$
  select case when v ~ '^-?\d+(\.\d+)?$' then least(hi, greatest(lo, trunc(v::numeric)::int)) else fallback end;
$$;

create or replace function private.to_money(v text) returns numeric
language sql immutable as $$
  select case when v ~ '^-?\d+(\.\d+)?$' then round(v::numeric, 2) else null end;
$$;

-- Registra un movimiento de inventario con los datos actuales de la variante
create or replace function private.log_movement(
  p_variant uuid, p_qty int, p_type text, p_reason text, p_reference text, p_order uuid, p_unit_cost numeric
) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.inventory_movements
    (variant_id, product_id, sku, product_name, variant_label, type, qty, stock_after, unit_cost, reason, reference, order_id, created_by, created_by_name)
  select v.id, v.product_id, v.sku, p.name, concat_ws(' · ', c.name, v.size), p_type, p_qty, v.stock,
         coalesce(p_unit_cost, p.cost, 0), coalesce(p_reason, ''), coalesce(p_reference, ''), p_order, auth.uid(), private.staff_name()
  from public.product_variants v
  join public.products p on p.id = v.product_id
  left join public.product_colors c on c.id = v.color_id
  where v.id = p_variant;
$$;

-- Suma o resta existencias y deja constancia en el kardex
create or replace function private.change_stock(
  p_variant uuid, p_delta int, p_type text, p_reason text, p_reference text, p_order uuid, p_unit_cost numeric
) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v public.product_variants;
  pname text;
  label text;
begin
  if coalesce(p_delta, 0) = 0 then return null; end if;
  select * into v from public.product_variants where id = p_variant for update;
  if not found then raise exception 'No encontramos esa variante.'; end if;
  if v.stock + p_delta < 0 then
    select p.name, concat_ws(' · ', c.name, v.size) into pname, label
    from public.products p left join public.product_colors c on c.id = v.color_id where p.id = v.product_id;
    raise exception 'No hay existencias suficientes de % (%). Disponibles: %.', pname, label, v.stock;
  end if;
  update public.product_variants set stock = stock + p_delta where id = p_variant;
  update public.products set updated_at = now() where id = v.product_id;
  perform private.log_movement(p_variant, p_delta, p_type, p_reason, p_reference, p_order, p_unit_cost);
  return v.stock + p_delta;
end $$;

-- Recalcula los importes de un pedido a partir de sus prendas
create or replace function private.recalc_order(p_order uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t record;
begin
  select coalesce(sum(unit_price * qty), 0) as subtotal,
         coalesce(sum(greatest(discount, 0)), 0) as line_discount,
         coalesce(sum(unit_cost * qty), 0) as cost_total,
         coalesce(sum(qty), 0) as items_count
    into t from public.order_items where order_id = p_order;
  update public.orders o set
    subtotal    = round(t.subtotal, 2),
    discount    = round(least(greatest(o.discount, 0), greatest(t.subtotal - least(t.line_discount, t.subtotal), 0)), 2),
    items_count = t.items_count,
    cost_total  = round(t.cost_total, 2),
    total       = round(t.subtotal - least(t.line_discount, t.subtotal)
                        - least(greatest(o.discount, 0), greatest(t.subtotal - least(t.line_discount, t.subtotal), 0))
                        + greatest(o.shipping, 0), 2)
  where o.id = p_order;
end $$;

-- Efectivo cobrado en un pedido
create or replace function private.cash_of(p_payments jsonb) returns numeric
language sql immutable as $$
  select coalesce(sum((p->>'amount')::numeric), 0)
  from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) p
  where p->>'method' = 'efectivo';
$$;

-- Resumen de una caja: ventas por método, movimientos y efectivo esperado
create or replace function private.cash_summary(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.cash_sessions;
  by_method jsonb;
  mv record;
  sales record;
  cash_sales numeric;
  cancelled int;
begin
  select * into s from public.cash_sessions where id = p_session;
  select count(*) as n, coalesce(sum(total), 0) as total, coalesce(sum(items_count), 0) as items
    into sales from public.orders
    where cash_session_id = p_session and payment_status = 'pagado' and status <> 'cancelado';
  select coalesce(jsonb_object_agg(method, amount), '{}'::jsonb) into by_method from (
    select pay->>'method' as method, round(sum((pay->>'amount')::numeric), 2) as amount
    from public.orders o
    cross join lateral jsonb_array_elements(
      case when jsonb_array_length(o.payments) > 0 then o.payments
           else jsonb_build_array(jsonb_build_object('method', coalesce(nullif(o.payment_method, ''), 'otro'), 'amount', o.total)) end
    ) pay
    where o.cash_session_id = p_session and o.payment_status = 'pagado' and o.status <> 'cancelado'
    group by 1
  ) m;
  select coalesce(sum(amount) filter (where type = 'ingreso'), 0) as ingreso,
         coalesce(sum(amount) filter (where type = 'retiro'), 0) as retiro,
         coalesce(sum(amount) filter (where type = 'gasto'), 0) as gasto
    into mv from public.cash_movements where session_id = p_session;
  select count(*) into cancelled from public.orders where cash_session_id = p_session and status = 'cancelado';
  cash_sales := coalesce((by_method->>'efectivo')::numeric, 0);
  return jsonb_build_object(
    'salesCount', sales.n,
    'salesTotal', round(sales.total, 2),
    'items', sales.items,
    'cancelled', cancelled,
    'byMethod', by_method,
    'cashSales', cash_sales,
    'movements', jsonb_build_object('ingreso', mv.ingreso, 'retiro', mv.retiro, 'gasto', mv.gasto),
    'expected', round(s.opening_amount + cash_sales + mv.ingreso - mv.retiro - mv.gasto, 2)
  );
end $$;

-- =============================================================================
--  Tienda en línea (acceso público)
-- =============================================================================
-- Prendas a la venta (activas y con al menos una variante activa), ya en el formato que recibe
-- la tienda: una fila por prenda. La usan storefront() y product_page().
create or replace view private.store_products as
select p.id, p.slug, p.department, p.category, p.sort, p.created_at,
  jsonb_build_object(
    'id', p.id, 'sku', p.code, 'slug', p.slug, 'name', p.name, 'department', p.department, 'category', p.category,
    'price', p.price, 'compareAtPrice', p.compare_at_price, 'description', p.description, 'details', to_jsonb(p.details),
    'material', p.material, 'care', p.care, 'origin', p.origin, 'colors', c.colors, 'sizes', coalesce(s.sizes, '[]'::jsonb),
    'isNew', p.is_new, 'isBestseller', p.is_bestseller, 'isFeatured', p.is_featured, 'tags', to_jsonb(p.tags),
    'createdAt', p.created_at
  ) as data
from public.products p
cross join lateral (
  select jsonb_agg(jsonb_build_object(
           'name', pc.name, 'hex', pc.hex, 'family', pc.family,
           'images', case when cardinality(pc.images) > 0 then to_jsonb(pc.images) else '["images/placeholder-product.svg"]'::jsonb end,
           'sizes', vs.sizes) order by pc.sort) as colors
  from public.product_colors pc
  cross join lateral (
    select jsonb_agg(jsonb_build_object('label', v.size, 'stock', greatest(v.stock, 0), 'sku', v.sku)
                     order by public.size_rank(v.size), v.sort) as sizes
    from public.product_variants v
    where v.color_id = pc.id and v.active
  ) vs
  where pc.product_id = p.id and vs.sizes is not null
) c
cross join lateral (
  select jsonb_agg(jsonb_build_object('label', x.size, 'stock', x.stock) order by public.size_rank(x.size)) as sizes
  from (select v.size, sum(greatest(v.stock, 0))::int as stock
          from public.product_variants v
         where v.product_id = p.id and v.active
         group by v.size) x
) s
where p.status = 'activo' and c.colors is not null;

create or replace function public.storefront() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with visible as materialized (select * from private.store_products)
  select jsonb_build_object(
    'settings', (select public from public.settings where id = 1),
    'departments', coalesce((select jsonb_agg(jsonb_build_object('slug', d.slug, 'name', d.name, 'description', d.description, 'image', d.image) order by d.sort)
                    from public.departments d where d.active), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object(
                      'slug', c.slug, 'department', c.department, 'name', c.name, 'description', c.description,
                      'order', c.sort, 'image', c.image,
                      'productCount', (select count(*) from visible v where v.category = c.slug)) order by c.sort)
                    from public.categories c where c.active), '[]'::jsonb),
    'banners', coalesce((select jsonb_agg(jsonb_build_object(
                      'id', b.id, 'placement', b.placement, 'eyebrow', b.eyebrow, 'title', b.title, 'text', b.text,
                      'cta', jsonb_build_object('label', coalesce(nullif(b.cta_label, ''), 'Ver más'), 'href', coalesce(nullif(b.cta_href, ''), '/tienda')),
                      'image', b.image, 'imageMobile', b.image_mobile, 'theme', b.theme) order by b.sort)
                    from public.banners b
                    where b.active and (b.starts_at is null or b.starts_at <= now()) and (b.ends_at is null or b.ends_at >= now())), '[]'::jsonb),
    'lookbooks', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'eyebrow', l.eyebrow, 'title', l.title, 'text', l.text, 'image', l.image, 'hotspots', l.hotspots) order by l.sort)
                    from public.lookbooks l where l.active), '[]'::jsonb),
    'faq', coalesce((select jsonb_agg(jsonb_build_object('q', f.question, 'a', f.answer) order by f.sort) from public.faq f where f.active), '[]'::jsonb),
    'content', coalesce((select jsonb_object_agg(key, value) from public.site_content), '{}'::jsonb),
    'products', coalesce((select jsonb_agg(v.data order by v.sort, v.created_at desc) from visible v), '[]'::jsonb)
  );
$$;

-- Página de una prenda (/producto/…): la prenda, su categoría y departamento, prendas parecidas
-- y los ajustes públicos. Devuelve null si la prenda no existe o no está a la venta.
create or replace function public.product_page(p_slug text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with item as (select * from private.store_products where slug = p_slug limit 1)
  select jsonb_build_object(
    'settings', (select public from public.settings where id = 1),
    'product', i.data,
    'category', (select jsonb_build_object('slug', c.slug, 'department', c.department, 'name', c.name, 'description', c.description,
                                           'order', c.sort, 'image', c.image, 'productCount', 0)
                   from public.categories c where c.slug = i.category and c.active),
    'department', (select jsonb_build_object('slug', d.slug, 'name', d.name, 'description', d.description, 'image', d.image)
                     from public.departments d where d.slug = i.department and d.active),
    -- Primero las de la misma categoría, después el resto del departamento
    'related', coalesce((select jsonb_agg(r.data order by r.rank) from (
                 select sp.data, row_number() over (order by (sp.category is not distinct from i.category) desc, sp.sort, sp.created_at desc) as rank
                   from private.store_products sp
                  where sp.department = i.department and sp.id <> i.id
                  order by rank
                  limit 8) r), '[]'::jsonb)
  )
  from item i;
$$;

-- Direcciones de las prendas a la venta (mapa del sitio para los buscadores)
create or replace function public.storefront_sitemap() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', p.slug, 'updatedAt', p.updated_at) order by p.sort, p.created_at desc), '[]'::jsonb)
  from public.products p
  where p.status = 'activo'
    and exists (select 1 from public.product_variants v where v.product_id = p.id and v.active);
$$;

-- Pedido desde la tienda en línea: valida existencias y usa los precios de la base
create or replace function public.place_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c        jsonb := coalesce(payload->'customer', '{}'::jsonb);
  v_name   text := private.clean(c->>'name', 120);
  v_phone  text := left(regexp_replace(coalesce(c->>'phone', ''), '[^0-9+]', '', 'g'), 20);
  v_items  jsonb := coalesce(payload->'items', '[]'::jsonb);
  it       jsonb;
  r        record;
  v_qty    int;
  problems text[] := '{}';
  lines    jsonb := '{}'::jsonb;   -- variant_id → cantidad
  o        public.orders;
  n        int := 0;
  k        text;
begin
  if v_name = '' then raise exception 'Escribe tu nombre.'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'Tu bolsa está vacía.'; end if;
  if jsonb_array_length(v_items) > 40 then raise exception 'El pedido tiene demasiadas prendas distintas.'; end if;

  for it in select * from jsonb_array_elements(v_items) loop
    v_qty := private.to_int(it->>'qty', 1, 20, 1);
    select pv.id, pv.stock, p.name, p.status, concat_ws(' · ', pc.name, pv.size) as label
      into r
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      join public.product_colors pc on pc.id = pv.color_id
      where pv.active and (
            (nullif(it->>'variantId', '') is not null and pv.id::text = it->>'variantId')
         or (nullif(it->>'sku', '') is not null and lower(pv.sku) = lower(it->>'sku'))
         or (nullif(it->>'slug', '') is not null and p.slug = it->>'slug' and pc.name = it->>'color' and pv.size = it->>'size'))
      limit 1;
    if not found or r.status <> 'activo' then
      problems := problems || format('%s ya no está disponible.', coalesce(nullif(private.clean(it->>'name', 80), ''), 'Una prenda'));
      continue;
    end if;
    v_qty := v_qty + coalesce((lines->>r.id::text)::int, 0);
    if r.stock < v_qty then
      problems := problems || case when r.stock > 0
        then format('De %s (%s) solo %s %s.', r.name, r.label, case when r.stock = 1 then 'queda' else 'quedan' end, r.stock)
        else format('%s (%s) se agotó.', r.name, r.label) end;
      continue;
    end if;
    lines := lines || jsonb_build_object(r.id::text, v_qty);
  end loop;

  if cardinality(problems) > 0 then raise exception '%', array_to_string(problems, ' '); end if;

  if v_phone <> '' and (select count(*) from public.orders where customer_phone = v_phone and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Recibimos varios pedidos seguidos desde este teléfono. Escríbenos por WhatsApp para ayudarte.';
  end if;

  insert into public.orders (channel, payment_method, delivery_method, customer_name, customer_phone, customer_city, customer_address, notes)
  values ('web', private.clean(payload->>'payment', 40), private.clean(payload->>'delivery', 40), v_name, v_phone,
          private.clean(c->>'city', 120), private.clean_text(c->>'address', 300), private.clean_text(payload->>'notes', 500))
  returning * into o;

  for k in select jsonb_object_keys(lines) loop
    insert into public.order_items (order_id, product_id, variant_id, sku, name, color, size, image, unit_price, unit_cost, qty, total, sort)
    select o.id, p.id, pv.id, pv.sku, p.name, pc.name, pv.size, coalesce(pc.images[1], ''), p.price, p.cost,
           (lines->>k)::int, round(p.price * (lines->>k)::int, 2), n
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    join public.product_colors pc on pc.id = pv.color_id
    where pv.id = k::uuid;
    n := n + 1;
  end loop;

  perform private.recalc_order(o.id);
  insert into public.order_events (order_id, type, note) values (o.id, 'creado', 'Pedido recibido desde la tienda en línea');
  select * into o from public.orders where id = o.id;
  return jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total, 'status', o.status);
end $$;

-- =============================================================================
--  Pedidos (panel)
-- =============================================================================

-- Aplica (sign = -1) o regresa (sign = 1) las piezas de un pedido al inventario
create or replace function private.order_stock(p_order uuid, p_sign int, p_type text, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o  public.orders;
  it record;
begin
  select * into o from public.orders where id = p_order;
  -- Cada prenda se resuelve por su variante o, si la variante se borró, por su SKU
  if p_sign < 0 then
    for it in
      select oi.name, oi.sku, oi.qty, concat_ws(' · ', nullif(oi.color, ''), nullif(oi.size, '')) as label, pv.id as vid, pv.stock
      from public.order_items oi
      left join public.product_variants pv
        on pv.id = coalesce(oi.variant_id, (select x.id from public.product_variants x where lower(x.sku) = lower(oi.sku) limit 1))
      where oi.order_id = p_order
    loop
      if it.vid is null then
        raise exception '% (%) ya no existe en el inventario. Quítalo del pedido para continuar.', it.name, it.sku;
      end if;
      if it.stock < it.qty then
        raise exception 'No hay existencias suficientes de % (%). Disponibles: %, se necesitan %.', it.name, it.label, it.stock, it.qty;
      end if;
    end loop;
  end if;

  for it in
    select oi.qty, oi.unit_cost,
           coalesce(oi.variant_id, (select x.id from public.product_variants x where lower(x.sku) = lower(oi.sku) limit 1)) as vid
    from public.order_items oi where oi.order_id = p_order order by oi.sort
  loop
    if it.vid is null then continue; end if;
    perform private.change_stock(it.vid, p_sign * it.qty, p_type, coalesce(p_reason, 'Pedido ' || o.number), o.number, o.id, it.unit_cost);
  end loop;
  update public.orders set stock_applied = (p_sign < 0) where id = p_order;
end $$;

-- Devuelve el efectivo de una venta que ya está en un corte cerrado (retiro en la caja abierta)
create or replace function private.refund_cash(p_order uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o       public.orders;
  v_cash  numeric;
  v_state text;
  v_open  uuid;
begin
  select * into o from public.orders where id = p_order;
  v_cash := private.cash_of(o.payments);
  if v_cash <= 0 then return; end if;
  select status into v_state from public.cash_sessions where id = o.cash_session_id;
  if v_state = 'abierta' then return; end if;
  select id into v_open from public.cash_sessions where status = 'abierta';
  if v_open is null then raise exception 'Abre la caja para registrar la devolución del efectivo.'; end if;
  insert into public.cash_movements (session_id, type, amount, reason, created_by_name)
  values (v_open, 'retiro', round(v_cash, 2), 'Devolución del pedido ' || o.number, private.staff_name());
end $$;

create or replace function public.order_set_status(p_order uuid, p_status text, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o      public.orders;
  wants  boolean;
  v_from text;
begin
  perform private.require_staff();
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'No encontramos ese pedido.'; end if;
  if p_status not in ('nuevo', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado') then raise exception 'Estado no válido.'; end if;
  if o.status = p_status then return jsonb_build_object('id', o.id, 'status', o.status); end if;
  v_from := o.status;
  wants := p_status in ('confirmado', 'preparando', 'enviado', 'entregado');

  if wants and not o.stock_applied then perform private.order_stock(o.id, -1, 'venta', null); end if;
  if not wants and o.stock_applied then
    if p_status = 'cancelado' then perform private.order_stock(o.id, 1, 'cancelacion', null);
    else perform private.order_stock(o.id, 1, 'ajuste', format('Pedido %s regresó a «%s»', o.number, private.status_label(p_status)));
    end if;
  end if;

  if p_status = 'cancelado' then
    if o.payment_status = 'pagado' then
      perform private.refund_cash(o.id);
      update public.orders set payment_status = 'reembolsado' where id = o.id;
    end if;
    update public.orders set cancelled_at = now(), cancel_reason = private.clean(p_note, 300) where id = o.id;
  elsif v_from = 'cancelado' then
    update public.orders set cancelled_at = null, cancel_reason = '' where id = o.id;
  end if;

  update public.orders set
    status = p_status,
    updated_at = now(),
    confirmed_at = case when wants and confirmed_at is null then now() else confirmed_at end,
    delivered_at = case when p_status = 'entregado' then now() else delivered_at end
  where id = o.id;

  insert into public.order_events (order_id, type, from_status, to_status, note, created_by_name)
  values (o.id, 'estado', v_from, p_status, private.clean(p_note, 300), private.staff_name());
  return jsonb_build_object('id', o.id, 'status', p_status);
end $$;

create or replace function public.order_set_payment(
  p_order uuid, p_status text, p_method text default null, p_payments jsonb default null, p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o       public.orders;
  v_from  text;
  v_pays  jsonb;
  v_sum   numeric;
  v_open  uuid;
  v_state text;
begin
  perform private.require_staff();
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'No encontramos ese pedido.'; end if;
  if p_status not in ('pendiente', 'pagado', 'reembolsado') then raise exception 'Estado de pago no válido.'; end if;
  if o.payment_status = p_status and p_status <> 'pagado' then return jsonb_build_object('id', o.id, 'paymentStatus', o.payment_status); end if;
  if p_status = 'pagado' and o.status = 'cancelado' then raise exception 'Este pedido está cancelado.'; end if;
  v_from := o.payment_status;

  if p_status = 'pagado' then
    if p_payments is not null and jsonb_typeof(p_payments) = 'array' and jsonb_array_length(p_payments) > 0 then
      select jsonb_agg(jsonb_build_object('method', private.clean(p->>'method', 40), 'amount', private.to_money(p->>'amount')))
        into v_pays from jsonb_array_elements(p_payments) p;
    else
      v_pays := jsonb_build_array(jsonb_build_object('method', coalesce(nullif(private.clean(p_method, 40), ''), nullif(o.payment_method, ''), 'transferencia'), 'amount', o.total));
    end if;
    select coalesce(sum((p->>'amount')::numeric), 0) into v_sum from jsonb_array_elements(v_pays) p;
    if abs(v_sum - o.total) > 0.01 then raise exception 'La suma de los pagos no coincide con el total del pedido.'; end if;
    select id into v_open from public.cash_sessions where status = 'abierta';
    update public.orders set
      payments = v_pays,
      payment_method = case when jsonb_array_length(v_pays) > 1 then 'mixto' else v_pays->0->>'method' end,
      paid_at = case when v_from = 'pagado' and paid_at is not null then paid_at else now() end,
      cash_session_id = case when private.cash_of(v_pays) > 0 and v_open is not null and cash_session_id is null then v_open else cash_session_id end
    where id = o.id;
  elsif p_status = 'pendiente' then
    select status into v_state from public.cash_sessions where id = o.cash_session_id;
    if v_state = 'cerrada' then raise exception 'Este pago ya forma parte de un corte de caja cerrado.'; end if;
    update public.orders set payments = '[]'::jsonb, paid_at = null, cash_session_id = null where id = o.id;
  else
    if v_from = 'pagado' then perform private.refund_cash(o.id); end if;
  end if;

  update public.orders set payment_status = p_status, updated_at = now() where id = o.id;
  insert into public.order_events (order_id, type, from_status, to_status, note, created_by_name)
  values (o.id, 'pago', v_from, p_status, private.clean(p_note, 300), private.staff_name());
  return jsonb_build_object('id', o.id, 'paymentStatus', p_status);
end $$;

-- Datos del pedido: cliente, envío, descuento, notas y (si sigue «Nuevo») cantidades
create or replace function public.order_update(p_order uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o      public.orders;
  money  boolean := p_patch ? 'shipping' or p_patch ? 'discount' or jsonb_typeof(p_patch->'items') = 'array';
  cust   jsonb := p_patch->'customer';
  ch     jsonb;
  v_qty  int;
  left_n int;
begin
  perform private.require_staff();
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'No encontramos ese pedido.'; end if;
  if money and o.payment_status = 'pagado' then raise exception 'El pedido ya está pagado: no se pueden cambiar sus importes.'; end if;
  if money and o.status = 'cancelado' then raise exception 'Este pedido está cancelado.'; end if;

  if cust is not null then
    update public.orders set
      customer_name = private.clean(coalesce(cust->>'name', customer_name), 120),
      customer_phone = left(regexp_replace(coalesce(cust->>'phone', customer_phone), '[^0-9+]', '', 'g'), 20),
      customer_city = private.clean(coalesce(cust->>'city', customer_city), 120),
      customer_address = private.clean_text(coalesce(cust->>'address', customer_address), 300)
    where id = o.id;
  end if;
  if p_patch ? 'shipping' then update public.orders set shipping = greatest(coalesce(private.to_money(p_patch->>'shipping'), 0), 0) where id = o.id; end if;
  if p_patch ? 'discount' then update public.orders set discount = greatest(coalesce(private.to_money(p_patch->>'discount'), 0), 0) where id = o.id; end if;
  if p_patch ? 'internalNotes' then update public.orders set internal_notes = private.clean_text(p_patch->>'internalNotes', 1000) where id = o.id; end if;
  if p_patch ? 'deliveryMethod' then update public.orders set delivery_method = private.clean(p_patch->>'deliveryMethod', 40) where id = o.id; end if;
  if p_patch ? 'paymentMethod' and o.payment_status <> 'pagado' then
    update public.orders set payment_method = private.clean(p_patch->>'paymentMethod', 40) where id = o.id;
  end if;

  if jsonb_typeof(p_patch->'items') = 'array' then
    if o.stock_applied then raise exception 'Regresa el pedido a «Nuevo» para cambiar sus prendas.'; end if;
    for ch in select * from jsonb_array_elements(p_patch->'items') loop
      v_qty := private.to_int(ch->>'qty', 0, 99, 0);
      if v_qty = 0 then
        delete from public.order_items where id = (ch->>'id')::uuid and order_id = o.id;
      else
        update public.order_items set qty = v_qty, total = round(unit_price * v_qty - greatest(discount, 0), 2)
        where id = (ch->>'id')::uuid and order_id = o.id;
      end if;
    end loop;
    -- Las prendas que no vinieron en la lista se quitan
    delete from public.order_items
    where order_id = o.id and id::text not in (select x->>'id' from jsonb_array_elements(p_patch->'items') x);
    select count(*) into left_n from public.order_items where order_id = o.id;
    if left_n = 0 then raise exception 'El pedido debe tener al menos una prenda. Si ya no va, cancélalo.'; end if;
  end if;

  perform private.recalc_order(o.id);
  update public.orders set updated_at = now() where id = o.id;
  if money then
    insert into public.order_events (order_id, type, note, created_by_name) values (o.id, 'nota', 'Se actualizaron los importes del pedido', private.staff_name());
  end if;
  return jsonb_build_object('id', o.id);
end $$;

-- =============================================================================
--  Punto de venta
-- =============================================================================
create or replace function public.pos_checkout(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_session uuid;
  it        jsonb;
  r         record;
  v_qty     int;
  v_disc    numeric;
  o         public.orders;
  n         int := 0;
  pays      jsonb := '[]'::jsonb;
  p         jsonb;
  v_amount  numeric;
  v_recv    numeric;
  v_sum     numeric := 0;
  c         jsonb := coalesce(payload->'customer', '{}'::jsonb);
  line      record;
begin
  perform private.require_staff();
  select id into v_session from public.cash_sessions where status = 'abierta';
  if v_session is null then raise exception 'Abre la caja para registrar ventas.'; end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then
    raise exception 'Agrega al menos una prenda al ticket.';
  end if;

  insert into public.orders (channel, status, payment_status, customer_name, customer_phone, notes, cash_session_id,
                             created_by, created_by_name, confirmed_at, paid_at, delivered_at, discount)
  values ('tienda', 'entregado', 'pagado', private.clean(c->>'name', 120), left(regexp_replace(coalesce(c->>'phone', ''), '[^0-9+]', '', 'g'), 20),
          private.clean_text(payload->>'notes', 500), v_session, auth.uid(), private.staff_name(), now(), now(), now(),
          greatest(coalesce(private.to_money(payload->>'discount'), 0), 0))
  returning * into o;

  for it in select * from jsonb_array_elements(payload->'items') loop
    v_qty := private.to_int(it->>'qty', 1, 999, 1);
    select pv.id, pv.sku, pv.size, pv.stock, p.id as product_id, p.name, p.price, p.cost, pc.name as color, coalesce(pc.images[1], '') as image
      into r
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      join public.product_colors pc on pc.id = pv.color_id
      where (nullif(it->>'variantId', '') is not null and pv.id::text = it->>'variantId')
         or (nullif(it->>'sku', '') is not null and lower(pv.sku) = lower(it->>'sku'))
      limit 1;
    if not found then raise exception 'Una de las prendas ya no existe.'; end if;
    v_disc := least(greatest(coalesce(private.to_money(it->>'discount'), 0), 0), round(r.price * v_qty, 2));
    insert into public.order_items (order_id, product_id, variant_id, sku, name, color, size, image, unit_price, unit_cost, qty, discount, total, sort)
    values (o.id, r.product_id, r.id, r.sku, r.name, r.color, r.size, r.image, r.price, r.cost, v_qty, v_disc, round(r.price * v_qty - v_disc, 2), n);
    n := n + 1;
  end loop;

  perform private.recalc_order(o.id);
  select * into o from public.orders where id = o.id;

  -- Pagos
  if jsonb_typeof(payload->'payments') = 'array' then
    for p in select * from jsonb_array_elements(payload->'payments') loop
      v_amount := coalesce(private.to_money(p->>'amount'), 0);
      if private.clean(p->>'method', 40) = '' or v_amount <= 0 then continue; end if;
      if p->>'method' = 'efectivo' then
        v_recv := coalesce(private.to_money(p->>'received'), v_amount);
        if v_recv + 0.001 < v_amount then raise exception 'El efectivo recibido es menor al importe a cobrar.'; end if;
        pays := pays || jsonb_build_array(jsonb_build_object('method', 'efectivo', 'amount', v_amount, 'received', v_recv, 'change', round(v_recv - v_amount, 2)));
      else
        pays := pays || jsonb_build_array(jsonb_build_object('method', private.clean(p->>'method', 40), 'amount', v_amount));
      end if;
      v_sum := v_sum + v_amount;
    end loop;
  end if;
  if jsonb_array_length(pays) = 0 then raise exception 'Indica cómo se pagó la venta.'; end if;
  if abs(round(v_sum, 2) - o.total) > 0.01 then raise exception 'Los pagos suman % y el total es %.', round(v_sum, 2), o.total; end if;

  update public.orders set
    payments = pays,
    payment_method = case when jsonb_array_length(pays) > 1 then 'mixto' else pays->0->>'method' end,
    stock_applied = true
  where id = o.id;

  for line in select * from public.order_items where order_id = o.id loop
    perform private.change_stock(line.variant_id, -line.qty, 'venta', 'Venta ' || o.number, o.number, o.id, line.unit_cost);
  end loop;

  insert into public.order_events (order_id, type, note, created_by_name) values (o.id, 'creado', 'Venta en mostrador', private.staff_name());
  select * into o from public.orders where id = o.id;
  return jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total);
end $$;

-- =============================================================================
--  Inventario
-- =============================================================================
create or replace function public.inventory_adjust(
  p_variant uuid, p_mode text, p_qty int, p_reason text default 'Ajuste', p_note text default '', p_reference text default ''
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_stock  int;
  v_target int;
  v_new    int;
begin
  perform private.require_staff();
  select stock into v_stock from public.product_variants where id = p_variant for update;
  if not found then raise exception 'No encontramos esa variante.'; end if;
  v_target := case when p_mode = 'set' then greatest(least(coalesce(p_qty, 0), 1000000), 0) else v_stock + coalesce(p_qty, 0) end;
  if v_target < 0 then raise exception 'No puedes dejar el inventario en negativo. Disponibles: %.', v_stock; end if;
  v_new := coalesce(private.change_stock(p_variant, v_target - v_stock, 'ajuste',
    concat_ws(' · ', coalesce(nullif(private.clean(p_reason, 80), ''), 'Ajuste'), nullif(private.clean(p_note, 200), '')),
    private.clean(p_reference, 80), null, null), v_stock);
  return jsonb_build_object('variantId', p_variant, 'stock', v_new);
end $$;

create or replace function public.inventory_receive(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  it      jsonb;
  v_qty   int;
  v_cost  numeric;
  v_prod  uuid;
  units   int := 0;
  n       int := 0;
  upd     boolean := coalesce((payload->>'updateCost')::boolean, true);
begin
  perform private.require_staff();
  for it in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) loop
    v_qty := private.to_int(it->>'qty', 0, 1000000, 0);
    if v_qty <= 0 then continue; end if;
    v_cost := private.to_money(it->>'unitCost');
    select product_id into v_prod from public.product_variants where id = (it->>'variantId')::uuid;
    if v_prod is null then raise exception 'Una de las variantes ya no existe.'; end if;
    perform private.change_stock((it->>'variantId')::uuid, v_qty, 'entrada',
      coalesce(nullif(private.clean(payload->>'note', 200), ''), 'Entrada de mercancía'),
      private.clean(payload->>'reference', 80), null,
      case when v_cost > 0 then v_cost else null end);
    if upd and v_cost > 0 then update public.products set cost = v_cost where id = v_prod; end if;
    units := units + v_qty;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Agrega al menos una prenda con cantidad.'; end if;
  return jsonb_build_object('units', units, 'lines', n);
end $$;

-- =============================================================================
--  Caja
-- =============================================================================
create or replace function public.cash_open(p_amount numeric, p_notes text default '') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.cash_sessions;
begin
  perform private.require_staff();
  if exists (select 1 from public.cash_sessions where status = 'abierta') then raise exception 'Ya hay una caja abierta.'; end if;
  if coalesce(p_amount, 0) < 0 then raise exception 'El fondo inicial no puede ser negativo.'; end if;
  insert into public.cash_sessions (opening_amount, notes, opened_by_name)
  values (round(coalesce(p_amount, 0), 2), private.clean_text(p_notes, 500), private.staff_name())
  returning * into s;
  return jsonb_build_object('id', s.id, 'number', s.number);
end $$;

create or replace function public.cash_movement(p_type text, p_amount numeric, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_session uuid;
  v_expected numeric;
  m public.cash_movements;
begin
  perform private.require_staff();
  select id into v_session from public.cash_sessions where status = 'abierta' for update;
  if v_session is null then raise exception 'La caja está cerrada.'; end if;
  if p_type not in ('ingreso', 'retiro', 'gasto') then raise exception 'Tipo de movimiento no válido.'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Escribe un importe mayor a cero.'; end if;
  if p_type <> 'ingreso' then
    v_expected := (private.cash_summary(v_session)->>'expected')::numeric;
    if round(p_amount, 2) > v_expected + 0.001 then raise exception 'En caja debería haber %; no puedes sacar más que eso.', v_expected; end if;
  end if;
  insert into public.cash_movements (session_id, type, amount, reason, created_by_name)
  values (v_session, p_type, round(p_amount, 2), private.clean(p_reason, 200), private.staff_name())
  returning * into m;
  return jsonb_build_object('id', m.id);
end $$;

create or replace function public.cash_close(p_counted numeric, p_breakdown jsonb default null, p_notes text default '') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_session uuid;
  v_summary jsonb;
  v_expected numeric;
begin
  perform private.require_staff();
  select id into v_session from public.cash_sessions where status = 'abierta' for update;
  if v_session is null then raise exception 'No hay una caja abierta.'; end if;
  if coalesce(p_counted, 0) < 0 then raise exception 'El efectivo contado no puede ser negativo.'; end if;
  v_summary := private.cash_summary(v_session);
  v_expected := (v_summary->>'expected')::numeric;
  update public.cash_sessions set
    status = 'cerrada', closed_at = now(), closed_by = auth.uid(), closed_by_name = private.staff_name(),
    expected_cash = v_expected, counted_cash = round(coalesce(p_counted, 0), 2),
    difference = round(coalesce(p_counted, 0) - v_expected, 2),
    breakdown = p_breakdown, summary = v_summary, close_notes = private.clean_text(p_notes, 500)
  where id = v_session;
  return jsonb_build_object('id', v_session, 'expected', v_expected, 'difference', round(coalesce(p_counted, 0) - v_expected, 2));
end $$;

create or replace function public.cash_session_summary(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform private.require_staff();
  return private.cash_summary(p_session);
end $$;

-- =============================================================================
--  Productos
-- =============================================================================
create or replace function public.save_product(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id       uuid := case when coalesce(payload->>'id', '') ~ '^[0-9a-f-]{36}$' then (payload->>'id')::uuid else null end;
  existing   public.products;
  v_name     text := private.clean(payload->>'name', 140);
  v_dep      text := payload->>'department';
  v_cat      text := nullif(payload->>'category', '');
  v_price    numeric := private.to_money(payload->>'price');
  v_compare  numeric := nullif(private.to_money(payload->>'compareAtPrice'), 0);
  v_status   text := case when payload->>'status' in ('activo', 'borrador', 'archivado') then payload->>'status' else 'borrador' end;
  v_slug     text;
  v_base     text;
  v_code     text := upper(private.clean(payload->>'code', 40));
  v_prefix   text;
  v_depcode  text;
  v_next     int;
  i          int;
  col        jsonb;
  var        jsonb;
  key_map    jsonb := '{}'::jsonb;
  v_color    uuid;
  v_hex      text;
  v_cname    text;
  v_size     text;
  v_sku      text;
  v_auto     boolean;
  used       text[] := '{}';
  combos     text[] := '{}';
  keep_vars  uuid[] := '{}';
  keep_cols  uuid[] := '{}';
  v_var      uuid;
  v_stock    int;
  v_old      int;
  v_min      int;
  other_name text;
  ncolors    int := jsonb_array_length(coalesce(payload->'colors', '[]'::jsonb));
  nvars      int := jsonb_array_length(coalesce(payload->'variants', '[]'::jsonb));
  rec        record;
begin
  perform private.require_staff(true);
  if v_id is not null then
    select * into existing from public.products where id = v_id for update;
    if not found then raise exception 'Ese producto ya no existe.'; end if;
  end if;
  if v_name = '' then raise exception 'Escribe el nombre del producto.'; end if;
  if not exists (select 1 from public.departments where slug = v_dep) then raise exception 'Elige un departamento.'; end if;
  if v_cat is not null and not exists (select 1 from public.categories where slug = v_cat and department = v_dep) then
    raise exception 'La categoría no pertenece a ese departamento.';
  end if;
  if v_price is null or v_price < 0 then raise exception 'Escribe un precio válido.'; end if;
  if v_compare is not null and v_compare <= v_price then
    raise exception 'El precio anterior debe ser mayor que el precio actual para mostrarse como oferta.';
  end if;
  if v_status = 'activo' and (ncolors = 0 or nvars = 0) then
    raise exception 'Para publicar el producto agrega al menos un color y una talla.';
  end if;

  -- Dirección (slug) única
  v_base := coalesce(nullif(private.slugify(coalesce(nullif(payload->>'slug', ''), v_name)), ''), 'producto');
  v_slug := v_base;
  if nullif(payload->>'slug', '') is not null and exists (select 1 from public.products where slug = v_slug and id is distinct from v_id) then
    raise exception 'Ya existe otro producto con la dirección «%».', v_slug;
  end if;
  i := 2;
  while exists (select 1 from public.products where slug = v_slug and id is distinct from v_id) loop
    v_slug := v_base || '-' || i; i := i + 1;
  end loop;

  -- Código del producto
  if v_code = '' then v_code := coalesce(existing.code, ''); end if;
  if v_code = '' then
    v_prefix := coalesce(nullif((select private->'inventory'->>'skuPrefix' from public.settings where id = 1), ''), 'DV');
    v_depcode := case v_dep when 'mujer' then 'MUJ' when 'ninas' then 'NNA' when 'ninos' then 'NNO' when 'hombre' then 'HOM' else upper(left(v_dep, 3)) end;
    select coalesce(max(nullif(regexp_replace(substring(code from length(v_prefix || '-' || v_depcode || '-') + 1), '\D', '', 'g'), '')::int), 0) + 1
      into v_next from public.products where code like v_prefix || '-' || v_depcode || '-%';
    v_code := v_prefix || '-' || v_depcode || '-' || lpad(v_next::text, 3, '0');
  end if;
  if exists (select 1 from public.products where code = v_code and id is distinct from v_id) then
    raise exception 'El código % ya lo usa otro producto.', v_code;
  end if;

  -- Producto
  if v_id is null then
    insert into public.products (slug, code, name, department, category, price, status, sort)
    values (v_slug, v_code, v_name, v_dep, v_cat, v_price, v_status, coalesce((select max(sort) + 1 from public.products), 0))
    returning id into v_id;
  end if;
  update public.products set
    slug = v_slug, code = v_code, name = v_name, department = v_dep, category = v_cat,
    description = private.clean_text(payload->>'description', 2000),
    details = coalesce((select array_agg(private.clean(d, 160)) from jsonb_array_elements_text(coalesce(payload->'details', '[]'::jsonb)) d where private.clean(d, 160) <> ''), '{}'),
    material = private.clean(payload->>'material', 160), care = private.clean(payload->>'care', 300), origin = private.clean(payload->>'origin', 80),
    price = v_price, compare_at_price = v_compare, cost = greatest(coalesce(private.to_money(payload->>'cost'), 0), 0),
    tags = coalesce((select array_agg(distinct lower(private.clean(t, 30))) from jsonb_array_elements_text(coalesce(payload->'tags', '[]'::jsonb)) t where private.clean(t, 30) <> ''), '{}'),
    is_new = coalesce((payload->>'isNew')::boolean, false),
    is_bestseller = coalesce((payload->>'isBestseller')::boolean, false),
    is_featured = coalesce((payload->>'isFeatured')::boolean, false),
    status = v_status, updated_at = now()
  where id = v_id;

  -- Colores
  i := 0;
  for col in select * from jsonb_array_elements(coalesce(payload->'colors', '[]'::jsonb)) loop
    v_cname := private.clean(col->>'name', 60);
    if v_cname = '' then raise exception 'Cada color necesita un nombre.'; end if;
    v_hex := case when coalesce(col->>'hex', '') ~* '^#[0-9a-f]{6}$' then upper(col->>'hex') else '#D9C6A6' end;
    v_color := null;
    if coalesce(col->>'id', '') ~ '^[0-9a-f-]{36}$' then
      select id into v_color from public.product_colors where id = (col->>'id')::uuid and product_id = v_id;
    end if;
    if v_color is null then
      insert into public.product_colors (product_id, name, hex, family, images, sort)
      values (v_id, v_cname, v_hex, coalesce(nullif(col->>'family', ''), 'beige'), '{}', i)
      returning id into v_color;
    end if;
    update public.product_colors set
      name = v_cname, hex = v_hex, family = coalesce(nullif(col->>'family', ''), 'beige'), sort = i,
      images = coalesce((select array_agg(x) from (select jsonb_array_elements_text(coalesce(col->'images', '[]'::jsonb)) x limit 12) q where x <> ''), '{}')
    where id = v_color;
    key_map := key_map || jsonb_build_object(v_color::text, v_color::text);
    if nullif(col->>'key', '') is not null then key_map := key_map || jsonb_build_object(col->>'key', v_color::text); end if;
    if nullif(col->>'id', '') is not null then key_map := key_map || jsonb_build_object(col->>'id', v_color::text); end if;
    keep_cols := keep_cols || v_color;
    i := i + 1;
  end loop;
  if (select count(distinct lower(name)) from public.product_colors where id = any (keep_cols)) <> cardinality(keep_cols) then
    raise exception 'Hay dos colores con el mismo nombre.';
  end if;

  -- Variantes: primero se registran y quitan las eliminadas
  for rec in
    select v.id, v.stock from public.product_variants v
    where v.product_id = v_id
      and v.id::text not in (select coalesce(x->>'id', '') from jsonb_array_elements(coalesce(payload->'variants', '[]'::jsonb)) x)
  loop
    if rec.stock > 0 then
      update public.product_variants set stock = 0 where id = rec.id;
      perform private.log_movement(rec.id, -rec.stock, 'ajuste', 'Variante eliminada', '', null, null);
    end if;
    delete from public.product_variants where id = rec.id;
  end loop;
  delete from public.product_colors where product_id = v_id and not (id = any (keep_cols));

  i := 0;
  for var in select * from jsonb_array_elements(coalesce(payload->'variants', '[]'::jsonb)) loop
    v_color := (key_map->>coalesce(nullif(var->>'colorKey', ''), var->>'colorId'))::uuid;
    if v_color is null then raise exception 'Una talla quedó sin color.'; end if;
    v_size := private.clean(var->>'size', 20);
    if v_size = '' then raise exception 'Cada variante necesita una talla.'; end if;
    if (v_color::text || '|' || lower(v_size)) = any (combos) then raise exception 'Hay tallas repetidas dentro de un mismo color.'; end if;
    combos := combos || (v_color::text || '|' || lower(v_size));
    select name into v_cname from public.product_colors where id = v_color;

    v_sku := upper(private.clean(var->>'sku', 60));
    v_auto := v_sku = '';
    if v_auto then
      v_sku := private.make_sku(v_code, v_cname, v_size);
      i := 2;
      while lower(v_sku) = any (used)
         or exists (select 1 from public.product_variants where lower(sku) = lower(v_sku) and product_id <> v_id) loop
        v_sku := private.make_sku(v_code, v_cname, v_size) || '-' || i; i := i + 1;
      end loop;
    end if;
    select p.name into other_name from public.product_variants pv join public.products p on p.id = pv.product_id
      where lower(pv.sku) = lower(v_sku) and pv.product_id <> v_id limit 1;
    if other_name is not null then raise exception 'El SKU % ya existe en «%».', v_sku, other_name; end if;
    if lower(v_sku) = any (used) then raise exception 'El SKU % está repetido.', v_sku; end if;
    used := used || lower(v_sku);

    v_stock := private.to_int(var->>'stock', 0, 1000000, 0);
    v_min := case when coalesce(var->>'minStock', '') = '' then null else private.to_int(var->>'minStock', 0, 1000000, 0) end;
    v_var := null;
    v_old := null;
    if coalesce(var->>'id', '') ~ '^[0-9a-f-]{36}$' then
      select id, stock into v_var, v_old from public.product_variants where id = (var->>'id')::uuid and product_id = v_id for update;
    end if;
    if v_var is null then
      insert into public.product_variants (product_id, color_id, size, sku, stock, min_stock, active, sort)
      values (v_id, v_color, v_size, v_sku, v_stock, v_min, coalesce((var->>'active')::boolean, true), cardinality(used))
      returning id into v_var;
      if v_stock > 0 then perform private.log_movement(v_var, v_stock, 'entrada', 'Alta de producto', '', null, null); end if;
    else
      update public.product_variants set
        color_id = v_color, size = v_size, sku = v_sku, stock = v_stock, min_stock = v_min,
        active = coalesce((var->>'active')::boolean, true), sort = cardinality(used)
      where id = v_var;
      if v_stock <> v_old then perform private.log_movement(v_var, v_stock - v_old, 'ajuste', 'Edición del producto', '', null, null); end if;
    end if;
  end loop;

  -- Orden: por color y talla
  update public.product_variants v set sort = q.rn - 1
  from (
    select pv.id, row_number() over (order by pc.sort, public.size_rank(pv.size), pv.size) as rn
    from public.product_variants pv join public.product_colors pc on pc.id = pv.color_id
    where pv.product_id = v_id
  ) q where q.id = v.id;

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'code', v_code);
end $$;

create or replace function public.delete_product(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_slug text;
begin
  perform private.require_staff(true);
  delete from public.products where id = p_id returning slug into v_slug;
  if v_slug is null then raise exception 'Ese producto ya no existe.'; end if;
  update public.lookbooks set hotspots = coalesce((
    select jsonb_agg(h) from jsonb_array_elements(hotspots) h where h->>'product' <> v_slug
  ), '[]'::jsonb);
  return jsonb_build_object('id', p_id);
end $$;

-- Reordenar listas (banners, preguntas, categorías, looks)
create or replace function public.reorder_rows(p_table text, p_keys text[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i int;
begin
  perform private.require_staff(true);
  if p_table not in ('banners', 'faq', 'lookbooks', 'categories', 'departments') then raise exception 'Tabla no válida.'; end if;
  for i in 1 .. coalesce(array_length(p_keys, 1), 0) loop
    if p_table in ('categories', 'departments') then
      execute format('update public.%I set sort = $1 where slug = $2', p_table) using i - 1, p_keys[i];
    else
      execute format('update public.%I set sort = $1 where id::text = $2', p_table) using i - 1, p_keys[i];
    end if;
  end loop;
end $$;

-- Departamentos: solo se editan (nombre, descripción, foto y si se muestran)
create or replace function public.save_department(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d public.departments;
begin
  perform private.require_staff(true);
  update public.departments set
    name        = coalesce(nullif(private.clean(payload->>'name', 60), ''), name),
    description = private.clean(payload->>'description', 200),
    image       = coalesce(payload->>'image', image),
    active      = coalesce((payload->>'active')::boolean, true)
  where slug = payload->>'slug'
  returning * into d;
  if d.slug is null then raise exception 'Departamento no encontrado.'; end if;
  return to_jsonb(d);
end $$;

-- Categorías: crear o editar. Una categoría con productos no cambia de departamento.
create or replace function public.save_category(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_name text := private.clean(payload->>'name', 60);
  v_dept text := payload->>'department';
  v_slug text := nullif(payload->>'slug', '');
  c public.categories;
  n int := 2;
begin
  perform private.require_staff(true);
  if v_name = '' then raise exception 'Escribe el nombre de la categoría.'; end if;
  if not exists (select 1 from public.departments where slug = v_dept) then raise exception 'Elige un departamento.'; end if;
  if v_slug is not null then
    select * into c from public.categories where slug = v_slug for update;
  end if;

  if c.slug is null then
    -- Nueva: el identificador sale del nombre (y del departamento si no es Mujer)
    v_slug := private.slugify(case when v_dept = 'mujer' then v_name else v_name || '-' || v_dept end);
    while exists (select 1 from public.categories where slug = v_slug) loop
      v_slug := private.slugify(v_name) || '-' || v_dept || '-' || n;
      n := n + 1;
    end loop;
    insert into public.categories (slug, department, name, description, image, sort, active)
    values (v_slug, v_dept, v_name, private.clean(payload->>'description', 200), coalesce(payload->>'image', ''),
            coalesce((select max(sort) + 1 from public.categories), 0), coalesce((payload->>'active')::boolean, true))
    returning * into c;
  else
    if c.department <> v_dept and exists (select 1 from public.products where category = c.slug) then
      raise exception 'Esta categoría tiene productos: muévelos antes de cambiarla de departamento.';
    end if;
    update public.categories set
      department  = v_dept,
      name        = v_name,
      description = private.clean(payload->>'description', 200),
      image       = coalesce(nullif(payload->>'image', ''), image),
      active      = coalesce((payload->>'active')::boolean, true)
    where slug = c.slug
    returning * into c;
  end if;
  return to_jsonb(c);
end $$;

-- Eliminar una categoría (solo si ya no tiene productos)
create or replace function public.delete_category(p_slug text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  used int;
begin
  perform private.require_staff(true);
  select count(*) into used from public.products where category = p_slug;
  if used > 0 then
    raise exception 'Esta categoría tiene % producto%. Muévelos a otra categoría antes de eliminarla.',
      used, case when used = 1 then '' else 's' end;
  end if;
  delete from public.categories where slug = p_slug;
  return jsonb_build_object('slug', p_slug);
end $$;

-- =============================================================================
--  Integraciones (Cloudinary)
-- =============================================================================
create or replace function public.set_integration_secret(p_name text, p_value text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.require_staff(true);
  if p_name not in ('cloudinary_api_secret') then raise exception 'Llave no válida.'; end if;
  if coalesce(btrim(p_value), '') = '' then
    delete from private.secrets where name = p_name;
  else
    insert into private.secrets (name, value) values (p_name, btrim(p_value))
    on conflict (name) do update set value = excluded.value, updated_at = now();
  end if;
end $$;

create or replace function public.integrations_status() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  cfg jsonb;
begin
  perform private.require_staff();
  select coalesce(private->'cloudinary', '{}'::jsonb) into cfg from public.settings where id = 1;
  return jsonb_build_object('cloudinary', jsonb_build_object(
    'cloudName', coalesce(cfg->>'cloudName', ''),
    'apiKey', coalesce(cfg->>'apiKey', ''),
    'folder', coalesce(nullif(cfg->>'folder', ''), 'divani'),
    'hasSecret', exists (select 1 from private.secrets where name = 'cloudinary_api_secret')
  ));
end $$;

-- Firma una subida a Cloudinary. El secreto nunca sale de la base de datos.
create or replace function public.cloudinary_signature(p_params jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  cfg      jsonb;
  v_secret text;
  v_folder text;
  v_root   text;
  v_ts     bigint := extract(epoch from now())::bigint;
  params   jsonb;
  to_sign  text;
begin
  perform private.require_staff();
  select coalesce(private->'cloudinary', '{}'::jsonb) into cfg from public.settings where id = 1;
  select value into v_secret from private.secrets where name = 'cloudinary_api_secret';
  if coalesce(cfg->>'cloudName', '') = '' or coalesce(cfg->>'apiKey', '') = '' or v_secret is null then
    raise exception 'Cloudinary no está configurado. Ve a Configuración → Conexiones.';
  end if;
  v_root := coalesce(nullif(cfg->>'folder', ''), 'divani');
  v_folder := coalesce(nullif(p_params->>'folder', ''), v_root);
  if v_folder <> v_root and v_folder not like v_root || '/%' then raise exception 'Carpeta no permitida.'; end if;
  -- Solo se firman parámetros conocidos
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into params
  from jsonb_each_text(coalesce(p_params, '{}'::jsonb))
  where key in ('public_id', 'tags', 'overwrite', 'unique_filename', 'use_filename', 'context') and value <> '';
  params := params || jsonb_build_object('folder', v_folder, 'timestamp', v_ts::text);
  select string_agg(key || '=' || value, '&' order by key) into to_sign from jsonb_each_text(params);
  return jsonb_build_object(
    'signature', encode(extensions.digest(to_sign || v_secret, 'sha1'), 'hex'),
    'timestamp', v_ts,
    'apiKey', cfg->>'apiKey',
    'cloudName', cfg->>'cloudName',
    'params', params
  );
end $$;

create or replace function public.whoami() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'userId', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'name', coalesce((select name from public.staff where user_id = auth.uid()), ''),
    'role', (select role from public.staff where user_id = auth.uid() and active),
    'isStaff', public.is_staff()
  );
$$;

-- =============================================================================
--  Administrador inicial
-- =============================================================================
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from private.bootstrap_admins b where lower(b.email) = lower(new.email)) then
    insert into public.staff (user_id, name, role) values (new.id, 'Administración', 'admin')
    on conflict (user_id) do update set role = 'admin', active = true;
  end if;
  return new;
end $$;

drop trigger if exists divani_on_auth_user_created on auth.users;
create trigger divani_on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.staff (user_id, name, role)
select u.id, 'Administración', 'admin'
from auth.users u join private.bootstrap_admins b on lower(b.email) = lower(u.email)
on conflict (user_id) do update set role = 'admin', active = true;

-- =============================================================================
--  Seguridad: políticas por fila y permisos
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['staff', 'settings', 'departments', 'categories', 'products', 'product_colors', 'product_variants',
                           'cash_sessions', 'cash_movements', 'orders', 'order_items', 'order_events', 'inventory_movements',
                           'banners', 'lookbooks', 'faq', 'site_content'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists divani_staff_read on public.%I', t);
    execute format('drop policy if exists divani_admin_write on public.%I', t);
    execute format('drop policy if exists divani_staff_write on public.%I', t);
    execute format('create policy divani_staff_read on public.%I for select to authenticated using (public.is_staff())', t);
  end loop;

  -- Catálogo, contenido y ajustes: solo administración
  foreach t in array array['settings', 'departments', 'categories', 'products', 'product_colors', 'product_variants',
                           'banners', 'lookbooks', 'faq', 'site_content'] loop
    execute format('create policy divani_admin_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;

  -- Operación diaria (pedidos, caja): todo el personal
  foreach t in array array['orders', 'order_items', 'order_events', 'cash_sessions', 'cash_movements', 'inventory_movements'] loop
    execute format('create policy divani_staff_write on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- staff: cada quien puede ver su propio registro (para saber si tiene acceso)
drop policy if exists divani_self_read on public.staff;
create policy divani_self_read on public.staff for select to authenticated using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.storefront() to anon, authenticated;
grant execute on function public.product_page(text) to anon, authenticated;
grant execute on function public.storefront_sitemap() to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.size_rank(text) to anon, authenticated;

-- Avisos en tiempo real de pedidos nuevos para el panel
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
exception when others then
  raise notice 'No se activó realtime para pedidos: %', sqlerrm;
end $$;

commit;
