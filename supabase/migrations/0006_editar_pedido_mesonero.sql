-- =====================================================================
-- Migración 0006: Edición de pedidos enviados a cocina por el mesonero
-- =====================================================================

-- 1. Registrar cuándo un pedido fue editado para disparar alerta en cocina
alter table pedidos add column if not exists editado_at timestamptz;

-- 2. RPC para que el mesonero (o cajero/admin) edite un pedido ya creado/enviado/listo
--    y agregue o modifique notas, notificando a cocina en tiempo real.
create or replace function editar_pedido_personal(
  p_pedido uuid,
  p_items jsonb,
  p_notas text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  ped pedidos;
  sub numeric;
begin
  if not tiene_rol('admin', 'cajero', 'mesonero') then
    raise exception 'Sin permiso';
  end if;

  select * into ped from pedidos where id = p_pedido for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if ped.tipo <> 'mesa' then
    raise exception 'Solo se pueden editar pedidos de mesa';
  end if;

  if ped.estado in ('servido', 'entregado', 'cancelado') then
    raise exception 'Este pedido ya está cerrado y no se puede editar';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe tener al menos un plato';
  end if;

  -- Reemplazar ítems validando precios en servidor
  delete from pedido_items where pedido_id = p_pedido;
  sub := _insertar_items(p_pedido, p_items, false);

  update pedidos
  set notas = nullif(left(coalesce(p_notas, ''), 300), ''),
      subtotal_usd = sub,
      editado_at = now()
  where id = p_pedido;
end $$;

revoke execute on function editar_pedido_personal(uuid, jsonb, text) from public, anon;
grant execute on function editar_pedido_personal(uuid, jsonb, text) to authenticated;
