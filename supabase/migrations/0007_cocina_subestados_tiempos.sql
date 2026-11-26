-- =====================================================================
-- Migración 0007: Subestados por plato en cocina + tiempo estimado de preparación
-- =====================================================================

-- 1. Tiempo estimado de preparación (minutos) por producto (configurable por admin)
alter table productos add column if not exists tiempo_prep_min int check (tiempo_prep_min is null or tiempo_prep_min between 1 and 240);

-- Actualizar vista productos_publicos para exponer tiempo_prep_min (nunca costo_usd)
create or replace view productos_publicos with (security_invoker = true) as
  select id, categoria_id, nombre, descripcion, precio_usd, foto_url, alergenos,
         disponible, solo_salon, orden, tiempo_prep_min
  from productos where activo;

-- Permitir que anon lea tiempo_prep_min también
grant select (tiempo_prep_min) on productos to anon;

-- 2. Subestado y tiempo estimado por plato en pedido_items
alter table pedido_items add column if not exists estado text not null default 'preparando';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedido_items_estado_check') then
    alter table pedido_items add constraint pedido_items_estado_check
      check (estado in ('preparando', 'retirar', 'entregado'));
  end if;
end $$;
alter table pedido_items add column if not exists tiempo_prep_min int;

-- Sincronizar ítems históricos de pedidos ya listos o servidos
update pedido_items pi
set estado = case
  when p.estado in ('servido', 'entregado') then 'entregado'
  when p.estado = 'listo' then 'retirar'
  else 'preparando'
end
from pedidos p
where pi.pedido_id = p.id
  and p.estado in ('listo', 'servido', 'entregado');

-- 3. Actualizar _insertar_items para copiar tiempo_prep_min del producto
create or replace function _insertar_items(p_pedido uuid, p_items jsonb, p_es_delivery boolean)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  it jsonb; prod productos; cant int; subtotal numeric := 0;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío';
  end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'Demasiados platos en un pedido'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from productos where id = (it->>'producto_id')::uuid and activo;
    if not found then raise exception 'Un plato ya no está en la carta'; end if;
    if not prod.disponible then raise exception '«%» se agotó', prod.nombre; end if;
    if p_es_delivery and prod.solo_salon then raise exception '«%» no está disponible por delivery', prod.nombre; end if;
    cant := greatest(1, least(50, coalesce((it->>'cantidad')::int, 1)));
    insert into pedido_items (pedido_id, producto_id, nombre, precio_usd, cantidad, notas, comensal, estado, tiempo_prep_min)
    values (p_pedido, prod.id, prod.nombre, prod.precio_usd, cant,
            nullif(left(coalesce(it->>'notas', ''), 200), ''),
            greatest(1, least(30, coalesce((it->>'comensal')::int, 1))),
            'preparando',
            prod.tiempo_prep_min);
    subtotal := subtotal + prod.precio_usd * cant;
  end loop;
  update pedidos set subtotal_usd = subtotal where id = p_pedido;
  return subtotal;
end $$;
revoke all on function _insertar_items(uuid, jsonb, boolean) from public, anon, authenticated;

-- 4. RPC para cambiar el subestado de un plato individual (Preparando -> Retirar -> Entregado)
--    y ubicar automáticamente el pedido en su estado principal según el avance de sus platos.
create or replace function cambiar_estado_item(p_item uuid, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
declare
  it pedido_items;
  ped pedidos;
  r rol_personal := mi_rol();
  pendientes int;
  por_retirar int;
  total_items int;
  nuevo_estado estado_pedido;
begin
  if r is null then raise exception 'Sin permiso'; end if;
  if p_estado not in ('preparando', 'retirar', 'entregado') then
    raise exception 'Subestado no válido';
  end if;

  select * into it from pedido_items where id = p_item for update;
  if not found then raise exception 'Plato no encontrado'; end if;

  select * into ped from pedidos where id = it.pedido_id for update;
  if not found then raise exception 'Pedido no encontrado'; end if;

  -- Permisos: cocina y admin manejan todos los subestados; mesonero/cajero pueden marcar entregado cuando retiran
  if not (r in ('admin', 'cocina') or (r in ('mesonero', 'cajero') and it.estado = 'retirar' and p_estado = 'entregado')) then
    raise exception 'Sin permiso para cambiar el estado del plato';
  end if;

  update pedido_items set estado = p_estado where id = p_item;

  -- Recalcular estado principal del pedido según los subestados de todos sus platos
  select
    count(*),
    count(*) filter (where estado = 'preparando'),
    count(*) filter (where estado = 'retirar')
  into total_items, pendientes, por_retirar
  from pedido_items
  where pedido_id = ped.id;

  if ped.estado not in ('cancelado', 'en_ruta', 'entregado') then
    if total_items > 0 and pendientes = 0 and por_retirar = 0 then
      -- Todos los platos fueron entregados al mesonero
      nuevo_estado := case when ped.tipo = 'mesa' then 'servido'::estado_pedido else 'listo'::estado_pedido end;
    elsif total_items > 0 and pendientes = 0 and por_retirar > 0 then
      -- Ninguno en preparación y al menos uno listo para retirar
      nuevo_estado := 'listo'::estado_pedido;
    else
      -- Aún hay platos preparándose
      nuevo_estado := 'preparando'::estado_pedido;
    end if;

    if nuevo_estado <> ped.estado then
      update pedidos set
        estado = nuevo_estado,
        iniciado_at = case when nuevo_estado in ('preparando', 'listo', 'servido') then coalesce(iniciado_at, now()) else iniciado_at end,
        listo_at = case when nuevo_estado = 'listo' then coalesce(listo_at, now()) when nuevo_estado = 'preparando' then null else listo_at end,
        cerrado_at = case when nuevo_estado = 'servido' then now() else cerrado_at end
      where id = ped.id;
    end if;
  end if;
end $$;

revoke execute on function cambiar_estado_item(uuid, text) from public, anon;
grant execute on function cambiar_estado_item(uuid, text) to authenticated;

-- 5. Mantener sincronizados los subestados cuando se cambia el estado principal del pedido completo
create or replace function cambiar_estado_pedido(p_pedido uuid, p_estado estado_pedido)
returns void language plpgsql security definer set search_path = public as $$
declare p pedidos; r rol_personal := mi_rol(); ok boolean := false;
begin
  if r is null then raise exception 'Sin permiso'; end if;
  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p.estado = p_estado then return; end if;

  ok := case
    when p.estado = 'por_aprobar' and p_estado = 'nuevo' then
      r = 'admin' or (p.tipo = 'mesa' and r in ('mesonero', 'cajero')) or (p.tipo = 'delivery' and r = 'cajero')
    when p.estado = 'nuevo' and p_estado = 'preparando' then r in ('admin', 'cocina')
    when p.estado = 'preparando' and p_estado = 'listo' then r in ('admin', 'cocina')
    when p.estado = 'preparando' and p_estado = 'nuevo' then r in ('admin', 'cocina')
    when p.estado = 'listo' and p_estado = 'preparando' then r in ('admin', 'cocina')
    when p.tipo = 'mesa' and p.estado = 'listo' and p_estado = 'servido' then r in ('admin', 'cajero', 'mesonero', 'cocina')
    when p.tipo = 'delivery' and p.estado = 'listo' and p_estado = 'en_ruta' then
      (r in ('admin', 'cajero') and p.motorizado_id is not null) or (r = 'motorizado' and p.motorizado_id = auth.uid())
    when p.tipo = 'delivery' and p.estado = 'en_ruta' and p_estado = 'entregado' then
      r in ('admin', 'cajero') or (r = 'motorizado' and p.motorizado_id = auth.uid())
    when p_estado = 'cancelado' then
      case
        when p.estado in ('por_aprobar', 'nuevo') then r in ('admin', 'cajero', 'mesonero')
        when p.estado in ('preparando', 'listo') then r in ('admin', 'cajero')
        else r = 'admin'
      end
    else false
  end;

  if not ok then raise exception 'No tienes permiso para pasar el pedido de % a %', p.estado, p_estado; end if;

  update pedidos set
    estado = p_estado,
    aprobado_at = case when p_estado = 'nuevo' and aprobado_at is null then now() else aprobado_at end,
    iniciado_at = case when p_estado = 'preparando' then coalesce(iniciado_at, now()) when p_estado = 'nuevo' then null else iniciado_at end,
    listo_at = case when p_estado = 'listo' then now() when p_estado in ('preparando', 'nuevo') then null else listo_at end,
    cerrado_at = case when p_estado in ('servido', 'entregado', 'cancelado') then now() else cerrado_at end,
    mesonero_id = case when p.tipo = 'mesa' and p_estado = 'nuevo' and r = 'mesonero' then coalesce(mesonero_id, auth.uid()) else mesonero_id end
  where id = p_pedido;

  -- Sincronizar subestados de los platos
  if p_estado = 'listo' then
    update pedido_items set estado = 'retirar' where pedido_id = p_pedido and estado = 'preparando';
  elsif p_estado in ('servido', 'entregado') then
    update pedido_items set estado = 'entregado' where pedido_id = p_pedido;
  elsif p_estado = 'nuevo' then
    update pedido_items set estado = 'preparando' where pedido_id = p_pedido;
  end if;
end $$;
