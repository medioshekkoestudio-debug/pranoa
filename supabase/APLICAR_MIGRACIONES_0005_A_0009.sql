-- Script consolidado: migraciones 0005 a 0009 (se puede correr completo y mas de una vez)

-- ===== 0005_nombres_mesas.sql =====
-- =====================================================================
-- Migración 0005: Nombres de mesas alfanuméricos + puestos configurables
-- =====================================================================

-- 1. Agregar columna nombre a mesas
alter table mesas add column if not exists nombre text;
update mesas set nombre = 'Mesa ' || numero::text where nombre is null;
alter table mesas alter column nombre set not null;

-- Evitar duplicados si se corre dos veces
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mesas_nombre_unique') then
    alter table mesas add constraint mesas_nombre_unique unique (nombre);
  end if;
end $$;

-- 2. Hacer que `numero` se autogenere si no se envía al crear una mesa
create sequence if not exists mesas_numero_seq;
select setval('mesas_numero_seq', greatest(coalesce((select max(numero) from mesas), 0), 100));
alter table mesas alter column numero set default nextval('mesas_numero_seq');

-- 3. Limpiar mesas de ejemplo antiguas (solo si no tienen historial en cuentas o pedidos)
delete from mesas
where nombre like 'Mesa %'
  and id not in (select distinct mesa_id from cuentas where mesa_id is not null)
  and id not in (select distinct mesa_id from pedidos where mesa_id is not null);

-- Desactivar las de ejemplo que sí tengan historial para que no estorben
update mesas set activa = false
where nombre like 'Mesa %'
  and (id in (select distinct mesa_id from cuentas where mesa_id is not null)
    or id in (select distinct mesa_id from pedidos where mesa_id is not null));

-- 4. Insertar mesas oficiales de Pranoa
-- A01: 6 puestos
insert into mesas (nombre, numero, ambiente, capacidad, activa)
values ('A01', 101, 'salon', 6, true)
on conflict (nombre) do update set capacidad = excluded.capacidad, activa = true;

-- B01 al B06: 6 puestos cada mesa
insert into mesas (nombre, numero, ambiente, capacidad, activa) values
  ('B01', 201, 'salon', 6, true),
  ('B02', 202, 'salon', 6, true),
  ('B03', 203, 'salon', 6, true),
  ('B04', 204, 'salon', 6, true),
  ('B05', 205, 'salon', 6, true),
  ('B06', 206, 'salon', 6, true)
on conflict (nombre) do update set capacidad = excluded.capacidad, activa = true;

-- C01 al C06: 2 puestos cada mesa
insert into mesas (nombre, numero, ambiente, capacidad, activa) values
  ('C01', 301, 'salon', 2, true),
  ('C02', 302, 'salon', 2, true),
  ('C03', 303, 'salon', 2, true),
  ('C04', 304, 'salon', 2, true),
  ('C05', 305, 'salon', 2, true),
  ('C06', 306, 'salon', 2, true)
on conflict (nombre) do update set capacidad = excluded.capacidad, activa = true;

-- D01 y D02: 8 puestos cada mesa
insert into mesas (nombre, numero, ambiente, capacidad, activa) values
  ('D01', 401, 'salon', 8, true),
  ('D02', 402, 'salon', 8, true)
on conflict (nombre) do update set capacidad = excluded.capacidad, activa = true;

-- E01: 8 puestos
insert into mesas (nombre, numero, ambiente, capacidad, activa)
values ('E01', 501, 'terraza', 8, true)
on conflict (nombre) do update set capacidad = excluded.capacidad, activa = true;

-- F01 al F07: 4 puestos cada mesa
insert into mesas (nombre, numero, ambiente, capacidad, activa) values
  ('F01', 601, 'terraza', 4, true),
  ('F02', 602, 'terraza', 4, true),
  ('F03', 603, 'terraza', 4, true),
  ('F04', 604, 'terraza', 4, true),
  ('F05', 605, 'terraza', 4, true),
  ('F06', 606, 'terraza', 4, true),
  ('F07', 607, 'terraza', 4, true)
on conflict (nombre) do update set capacidad = excluded.capacidad, activa = true;

-- G01: 10 puestos
insert into mesas (nombre, numero, ambiente, capacidad, activa)
values ('G01', 701, 'terraza', 10, true)
on conflict (nombre) do update set capacidad = excluded.capacidad, activa = true;

-- 5. Actualizar mesa_por_token para devolver también nombre y capacidad
drop function if exists mesa_por_token(uuid);
create or replace function mesa_por_token(p_token uuid)
returns table (id uuid, numero int, nombre text, ambiente ambiente_mesa, capacidad int)
language sql stable security definer set search_path = public as $$
  select id, numero, nombre, ambiente, capacidad from mesas where token = p_token and activa
$$;
revoke execute on function mesa_por_token(uuid) from public;
grant execute on function mesa_por_token(uuid) to anon, authenticated;

-- 6. Permiso de secuencia para que el admin pueda insertar mesas nuevas sin pasar `numero`
grant usage, select on sequence mesas_numero_seq to authenticated;


-- ===== 0006_editar_pedido_mesonero.sql =====
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


-- ===== 0007_cocina_subestados_tiempos.sql =====
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


-- ===== 0008_flujo_factura_cuenta.sql =====
-- =====================================================================
-- Migración 0008: Flujo de factura/recibo (Mesonero <-> Cajero) y cierre por pago
-- =====================================================================

-- 1. Campos de solicitud de factura y datos fiscales del cliente en `cuentas`
alter table cuentas add column if not exists factura_estado text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cuentas_factura_estado_check') then
    alter table cuentas add constraint cuentas_factura_estado_check
      check (factura_estado is null or factura_estado in ('solicitada', 'lista', 'pagada'));
  end if;
end $$;
alter table cuentas add column if not exists factura_solicitada_at timestamptz;
alter table cuentas add column if not exists factura_lista_at timestamptz;
alter table cuentas add column if not exists cliente_nombre text;
alter table cuentas add column if not exists cliente_cedula text;
alter table cuentas add column if not exists cliente_telefono text;
alter table cuentas add column if not exists cliente_correo text;

-- 2. Mesonero solicita factura/recibo a Caja con datos opcionales del cliente
create or replace function solicitar_factura_cuenta(
  p_cuenta uuid,
  p_nombre text default null,
  p_cedula text default null,
  p_telefono text default null,
  p_correo text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  c cuentas;
begin
  if not tiene_rol('admin', 'cajero', 'mesonero') then
    raise exception 'Sin permiso';
  end if;

  select * into c from cuentas where id = p_cuenta and abierta for update;
  if not found then
    raise exception 'La cuenta ya está cerrada';
  end if;

  update cuentas set
    factura_estado = 'solicitada',
    factura_solicitada_at = now(),
    cliente_nombre = nullif(left(trim(coalesce(p_nombre, '')), 120), ''),
    cliente_cedula = nullif(left(trim(coalesce(p_cedula, '')), 40), ''),
    cliente_telefono = nullif(left(trim(coalesce(p_telefono, '')), 30), ''),
    cliente_correo = nullif(left(trim(coalesce(p_correo, '')), 120), '')
  where id = p_cuenta;

  -- Crear alerta de cuenta para caja si no existe una pendiente
  if not exists (select 1 from llamadas where mesa_id = c.mesa_id and tipo = 'cuenta' and not atendida) then
    insert into llamadas (mesa_id, tipo) values (c.mesa_id, 'cuenta');
  end if;
end $$;

-- 3. Cajero marca que la factura está lista para que el mesonero la retire
create or replace function marcar_factura_lista(p_cuenta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c cuentas;
begin
  if not tiene_rol('admin', 'cajero') then
    raise exception 'Solo caja o administración puede marcar la factura como lista';
  end if;

  select * into c from cuentas where id = p_cuenta and abierta for update;
  if not found then
    raise exception 'La cuenta ya está cerrada';
  end if;

  update cuentas set
    factura_estado = 'lista',
    factura_lista_at = now()
  where id = p_cuenta;

  update llamadas set atendida = true, atendida_por = auth.uid()
  where mesa_id = c.mesa_id and tipo = 'cuenta' and not atendida;
end $$;

-- 4. Mesonero (o cajero/admin) marca la mesa como Pagada para cerrarla y liberarla
create or replace function marcar_mesa_pagada(p_cuenta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c cuentas;
begin
  if not tiene_rol('admin', 'cajero', 'mesonero') then
    raise exception 'Sin permiso';
  end if;

  select * into c from cuentas where id = p_cuenta and abierta for update;
  if not found then
    raise exception 'La cuenta ya está cerrada';
  end if;

  update cuentas set
    abierta = false,
    factura_estado = 'pagada',
    cerrada_at = now(),
    cerrada_por = auth.uid()
  where id = p_cuenta;

  update llamadas set atendida = true, atendida_por = auth.uid()
  where mesa_id = c.mesa_id and not atendida;
end $$;

revoke execute on function solicitar_factura_cuenta(uuid, text, text, text, text) from public, anon;
revoke execute on function marcar_factura_lista(uuid) from public, anon;
revoke execute on function marcar_mesa_pagada(uuid) from public, anon;
grant execute on function solicitar_factura_cuenta(uuid, text, text, text, text), marcar_factura_lista(uuid), marcar_mesa_pagada(uuid) to authenticated;


-- ===== 0009_clientes_y_llamadas_nota.sql =====
-- =====================================================================
-- Migración 0009: Clientes QR, estatus por plato en mesa y nota al llamar mesonero
-- =====================================================================

-- 1. Tabla de clientes registrados (desde el QR o para delivery futuro)
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cedula text,
  telefono text not null unique,
  correo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clientes enable row level security;

-- Solo admin y cajero pueden listar clientes desde el panel; el público opera vía RPC
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'clientes' and policyname = 'clientes_ver_admin') then
    create policy clientes_ver_admin on clientes for select to authenticated
      using (tiene_rol('admin', 'cajero'));
  end if;
end $$;
grant select on clientes to authenticated;
grant all on clientes to service_role;

-- Endurecer tasas: solo admin y cajero leen histórico de tasas (cocina y motorizado no lo necesitan)
drop policy if exists tasas_ver on tasas;
create policy tasas_ver on tasas for select to authenticated using (tiene_rol('admin', 'cajero'));

-- 2. Agregar columna nota a `llamadas` para mensajes del cliente al mesonero
alter table llamadas add column if not exists nota text;

-- 3. Actualizar llamar_desde_mesa para aceptar una nota opcional del comensal
drop function if exists llamar_desde_mesa(uuid, text);
create or replace function llamar_desde_mesa(p_token uuid, p_tipo text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  m uuid;
  nota_limpia text;
  existente uuid;
begin
  if p_tipo not in ('mesonero', 'cuenta') then raise exception 'Tipo no válido'; end if;
  select id into m from mesas where token = p_token and activa;
  if m is null then raise exception 'Código QR no válido'; end if;

  nota_limpia := nullif(left(trim(coalesce(p_nota, '')), 250), '');

  select id into existente from llamadas
  where mesa_id = m and tipo = p_tipo and not atendida
  order by created_at desc limit 1;

  if existente is null then
    insert into llamadas (mesa_id, tipo, nota) values (m, p_tipo, nota_limpia);
  elsif nota_limpia is not null then
    -- Si el comensal envía una nota nueva, insertar un aviso nuevo para disparar el sonido en tiempo real
    insert into llamadas (mesa_id, tipo, nota) values (m, p_tipo, nota_limpia);
  end if;
end $$;

-- 4. RPC pública para registrar / actualizar perfil de cliente desde el QR de la mesa
create or replace function registrar_cliente_qr(
  p_token uuid,
  p_nombre text,
  p_telefono text,
  p_cedula text default null,
  p_correo text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m mesas;
  tel_norm text;
  cli clientes;
  c_abierta uuid;
begin
  select * into m from mesas where token = p_token and activa;
  if not found then raise exception 'Código QR no válido'; end if;

  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe tu nombre'; end if;
  tel_norm := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  if length(tel_norm) < 10 then raise exception 'Teléfono no válido (mínimo 10 dígitos)'; end if;

  insert into clientes (nombre, cedula, telefono, correo, updated_at)
  values (
    left(trim(p_nombre), 100),
    nullif(left(trim(coalesce(p_cedula, '')), 40), ''),
    left(tel_norm, 20),
    nullif(left(trim(coalesce(p_correo, '')), 120), ''),
    now()
  )
  on conflict (telefono) do update set
    nombre = excluded.nombre,
    cedula = coalesce(excluded.cedula, clientes.cedula),
    correo = coalesce(excluded.correo, clientes.correo),
    updated_at = now()
  returning * into cli;

  -- Si la mesa ya tiene cuenta abierta sin datos del cliente, precargarlos para facturación
  select id into c_abierta from cuentas where mesa_id = m.id and abierta limit 1;
  if c_abierta is not null then
    update cuentas set
      cliente_nombre = coalesce(cliente_nombre, cli.nombre),
      cliente_cedula = coalesce(cliente_cedula, cli.cedula),
      cliente_telefono = coalesce(cliente_telefono, cli.telefono),
      cliente_correo = coalesce(cliente_correo, cli.correo)
    where id = c_abierta;
  end if;

  return jsonb_build_object(
    'id', cli.id,
    'nombre', cli.nombre,
    'cedula', cli.cedula,
    'telefono', cli.telefono,
    'correo', cli.correo
  );
end $$;

-- 5. Actualizar pedidos_de_mesa para incluir el subestado de cada plato (Preparando / Retirar / Entregado)
create or replace function pedidos_de_mesa(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'numero', p.numero, 'estado', p.estado, 'subtotal_usd', p.subtotal_usd, 'created_at', p.created_at,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'nombre', i.nombre,
        'cantidad', i.cantidad,
        'precio_usd', i.precio_usd,
        'estado', i.estado
      ))
      from pedido_items i where i.pedido_id = p.id
    )
  ) order by p.created_at), '[]'::jsonb)
  from pedidos p
  join mesas m on m.id = p.mesa_id and m.token = p_token
  join cuentas c on c.id = p.cuenta_id and c.abierta
  where p.estado <> 'cancelado'
$$;

revoke execute on function llamar_desde_mesa(uuid, text, text) from public;
grant execute on function llamar_desde_mesa(uuid, text, text) to anon, authenticated;

revoke execute on function registrar_cliente_qr(uuid, text, text, text, text) from public;
grant execute on function registrar_cliente_qr(uuid, text, text, text, text) to anon, authenticated;

revoke execute on function pedidos_de_mesa(uuid) from public;
grant execute on function pedidos_de_mesa(uuid) to anon, authenticated;


-- Refrescar caché de la API de Supabase (PostgREST) inmediatamente
notify pgrst, 'reload schema';
