-- Freno contra pedidos en masa. Copia TODO este archivo en Supabase → SQL Editor y presiona Run.
-- Es el mismo bloque «seguridad» de schema.sql. Se puede repetir sin perder datos.

-- >>> seguridad
-- =============================================================================
--  Freno contra pedidos en masa desde la tienda
--  Este bloque se puede ejecutar solo en el SQL Editor. Se puede repetir sin perder datos.
--
--  place_order es pública y el teléfono es opcional, así que alguien podría llenar el panel de
--  pedidos falsos. Se limita por conexión y en total. La dirección IP nunca se guarda: solo una
--  huella que cambia cada día. Solo aplica a la tienda en línea; el punto de venta no se toca.
-- =============================================================================
create table if not exists private.rate_limits (
  bucket       text primary key,
  hits         int not null default 0,
  window_start timestamptz not null default now()
);

-- Suma un intento y devuelve cuántos van en la ventana. Si el pedido se rechaza, la transacción se
-- deshace y el contador se queda en el máximo: sigue rechazando hasta que termine la ventana.
create or replace function private.rate_hit(p_bucket text, p_window interval) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hits int;
begin
  insert into private.rate_limits as r (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update set
    hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into v_hits;
  return v_hits;
end $$;

create or replace function private.limite_pedidos() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_headers jsonb;
  v_ip      text;
begin
  if new.channel <> 'web' then return new; end if;
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := nullif(btrim(coalesce(v_headers->>'cf-connecting-ip', split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1))), '');
  if v_ip is not null
     and private.rate_hit('ip:' || encode(extensions.digest(v_ip || current_date::text, 'sha256'), 'hex'), interval '10 minutes') > 12 then
    raise exception 'Recibimos muchos pedidos seguidos desde tu conexión. Intenta en unos minutos o escríbenos por WhatsApp.';
  end if;
  if private.rate_hit('todos', interval '10 minutes') > 120 then
    raise exception 'Estamos recibiendo muchos pedidos. Intenta en unos minutos o escríbenos por WhatsApp.';
  end if;
  if random() < 0.02 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return new;
end $$;

drop trigger if exists divani_limite_pedidos on public.orders;
create trigger divani_limite_pedidos before insert on public.orders
for each row execute function private.limite_pedidos();

revoke all on table private.rate_limits from public, anon, authenticated;
revoke all on function private.rate_hit(text, interval) from public, anon, authenticated;
revoke all on function private.limite_pedidos() from public, anon, authenticated;
-- <<< seguridad
