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
