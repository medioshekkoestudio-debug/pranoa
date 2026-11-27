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
