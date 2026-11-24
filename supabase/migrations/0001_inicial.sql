-- =====================================================================
-- PRANOA · Migración inicial
-- Perfiles: admin, cajero, mesonero, cocina, motorizado (personal)
--           + público (comensal por QR y cliente de delivery, sin cuenta)
-- El público NUNCA escribe directo en tablas: todo pasa por funciones
-- (security definer) que calculan precios en el servidor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type rol_personal as enum ('admin', 'cajero', 'mesonero', 'cocina', 'motorizado');
create type tipo_pedido as enum ('mesa', 'delivery');
create type estado_pedido as enum (
  'por_aprobar',  -- llegó por QR o web y espera validación (mesonero / caja)
  'nuevo',        -- en cocina, columna "Por preparar"
  'preparando',
  'listo',
  'servido',      -- mesa: entregado en la mesa
  'en_ruta',      -- delivery: con el motorizado
  'entregado',    -- delivery: entregado
  'cancelado'
);
create type metodo_pago as enum ('pago_movil', 'zelle', 'efectivo_usd', 'efectivo_bs', 'punto');
create type ambiente_mesa as enum ('salon', 'terraza');
create type estado_reserva as enum ('pendiente', 'confirmada', 'cancelada', 'completada');

-- ---------- Perfiles del personal ----------
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol rol_personal not null,
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Rol del usuario actual (null si no es personal activo)
create or replace function mi_rol() returns rol_personal
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

create or replace function tiene_rol(variadic roles rol_personal[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() = any(roles), false)
$$;

-- Nadie (salvo service_role) puede cambiar su propio rol ni activarse
create or replace function proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then return new; end if;
  if not tiene_rol('admin') then
    if new.rol is distinct from old.rol or new.activo is distinct from old.activo then
      raise exception 'Solo un administrador puede cambiar rol o estado';
    end if;
  end if;
  -- un admin no puede quitarse a sí mismo el rol de admin (evita quedarse sin admins)
  if old.id = auth.uid() and old.rol = 'admin' and (new.rol <> 'admin' or not new.activo) then
    raise exception 'No puedes quitarte el rol de administrador a ti mismo';
  end if;
  return new;
end $$;
create trigger trg_proteger_perfil before update on perfiles
  for each row execute function proteger_perfil();

-- ---------- Ajustes generales (una sola fila) ----------
create table ajustes (
  id int primary key default 1 check (id = 1),
  nombre text not null default 'Pranoa',
  lema text not null default 'un refugio seguro',
  direccion text default 'Valencia, Carabobo, Venezuela',
  mapa_url text,
  whatsapp text,               -- solo dígitos con código de país: 58412...
  instagram text,
  horario text default 'Martes a domingo · 12:00 m. a 10:00 p. m.',
  tasa_bs numeric(14,4) not null default 0,
  tasa_fuente text,
  tasa_actualizada timestamptz,
  qr_requiere_aprobacion boolean not null default true,
  delivery_activo boolean not null default true,
  pago_movil_datos text,        -- banco, teléfono, cédula
  zelle_datos text,
  alerta_minutos int not null default 15,
  updated_at timestamptz not null default now()
);
insert into ajustes (id) values (1);

create table tasas (
  id bigserial primary key,
  valor numeric(14,4) not null check (valor > 0),
  fuente text not null default 'manual',
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Menú ----------
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int not null default 0,
  activa boolean not null default true
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categorias(id) on delete set null,
  nombre text not null,
  descripcion text,
  precio_usd numeric(10,2) not null check (precio_usd >= 0),
  costo_usd numeric(10,2),          -- escandallo básico (solo admin lo ve)
  foto_url text,
  alergenos text[] not null default '{}',
  disponible boolean not null default true,  -- agotado en el servicio
  activo boolean not null default true,      -- existe en la carta
  solo_salon boolean not null default false, -- no se ofrece por delivery
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- El costo no debe llegar al público: vista sin costo
create view productos_publicos with (security_invoker = true) as
  select id, categoria_id, nombre, descripcion, precio_usd, foto_url, alergenos,
         disponible, solo_salon, orden
  from productos where activo;

-- ---------- Mesas y cuentas ----------
create table mesas (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique,
  ambiente ambiente_mesa not null default 'salon',
  capacidad int not null default 4,
  token uuid not null unique default gen_random_uuid(),  -- va en el QR
  activa boolean not null default true
);

-- Una cuenta = la sesión de una mesa desde que se sientan hasta que pagan
create table cuentas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references mesas(id),
  abierta boolean not null default true,
  mesonero_id uuid references perfiles(id),
  abierta_at timestamptz not null default now(),
  cerrada_at timestamptz,
  cerrada_por uuid references perfiles(id)
);
create unique index una_cuenta_abierta_por_mesa on cuentas(mesa_id) where abierta;

-- ---------- Delivery ----------
create table zonas_delivery (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tarifa_usd numeric(10,2) not null check (tarifa_usd >= 0),
  activa boolean not null default true,
  orden int not null default 0
);

-- ---------- Pedidos ----------
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigserial unique,
  tipo tipo_pedido not null,
  estado estado_pedido not null default 'nuevo',
  origen text not null default 'personal' check (origen in ('qr', 'web', 'personal')),
  mesa_id uuid references mesas(id),
  cuenta_id uuid references cuentas(id),
  cliente_nombre text,
  cliente_telefono text,
  direccion text,
  zona_id uuid references zonas_delivery(id),
  costo_envio_usd numeric(10,2) not null default 0,
  subtotal_usd numeric(10,2) not null default 0,
  notas text,
  mesonero_id uuid references perfiles(id),
  motorizado_id uuid references perfiles(id),
  token_publico uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  aprobado_at timestamptz,
  iniciado_at timestamptz,
  listo_at timestamptz,
  cerrado_at timestamptz,
  check ((tipo = 'mesa' and mesa_id is not null) or (tipo = 'delivery' and zona_id is not null))
);
create index on pedidos(estado);
create index on pedidos(cuenta_id);
create index on pedidos(created_at);

create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  nombre text not null,
  precio_usd numeric(10,2) not null,
  cantidad int not null check (cantidad between 1 and 50),
  notas text,
  comensal int not null default 1 check (comensal between 1 and 30)  -- para dividir la cuenta
);
create index on pedido_items(pedido_id);

-- ---------- Pagos ----------
create table pagos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid references cuentas(id),
  pedido_id uuid references pedidos(id),
  metodo metodo_pago not null,
  monto_usd numeric(10,2) not null check (monto_usd > 0),  -- equivalente en USD
  monto_bs numeric(14,2),
  tasa numeric(14,4),
  referencia text,
  comensal int,                 -- si se dividió la cuenta por comensal
  verificado boolean not null default false,
  verificado_por uuid references perfiles(id),
  registrado_por uuid references perfiles(id),
  origen text not null default 'personal' check (origen in ('personal', 'web')),
  created_at timestamptz not null default now(),
  check (cuenta_id is not null or pedido_id is not null)
);
create index on pagos(created_at);

-- ---------- Llamadas desde la mesa ----------
create table llamadas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references mesas(id),
  tipo text not null check (tipo in ('mesonero', 'cuenta')),
  atendida boolean not null default false,
  atendida_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Reservas ----------
create table reservas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null,
  fecha date not null,
  hora time not null,
  personas int not null check (personas between 1 and 40),
  ambiente ambiente_mesa not null default 'salon',
  notas text,
  estado estado_reserva not null default 'pendiente',
  created_at timestamptz not null default now()
);

-- =====================================================================
-- RLS
-- =====================================================================
alter table perfiles enable row level security;
alter table ajustes enable row level security;
alter table tasas enable row level security;
alter table categorias enable row level security;
alter table productos enable row level security;
alter table mesas enable row level security;
alter table cuentas enable row level security;
alter table zonas_delivery enable row level security;
alter table pedidos enable row level security;
alter table pedido_items enable row level security;
alter table pagos enable row level security;
alter table llamadas enable row level security;
alter table reservas enable row level security;

-- perfiles: el personal ve a sus compañeros (nombres de motorizados, mesoneros)
create policy perfiles_ver on perfiles for select to authenticated using (mi_rol() is not null or id = auth.uid());
create policy perfiles_admin on perfiles for all to authenticated
  using (tiene_rol('admin')) with check (tiene_rol('admin'));
create policy perfiles_propio on perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ajustes: lectura pública; solo admin edita (la tasa va por función)
create policy ajustes_ver on ajustes for select using (true);
create policy ajustes_admin on ajustes for update to authenticated
  using (tiene_rol('admin')) with check (tiene_rol('admin'));

create policy tasas_ver on tasas for select to authenticated using (mi_rol() is not null);

-- menú: el público ve lo activo; admin gestiona
create policy categorias_ver on categorias for select using (activa or mi_rol() is not null);
create policy categorias_admin on categorias for all to authenticated
  using (tiene_rol('admin')) with check (tiene_rol('admin'));
-- el público lee productos solo a través de productos_publicos (sin costo)
create policy productos_ver_publico on productos for select to anon using (activo);
create policy productos_ver_personal on productos for select to authenticated using (activo or mi_rol() is not null);
create policy productos_admin on productos for all to authenticated
  using (tiene_rol('admin')) with check (tiene_rol('admin'));
-- anon no puede leer la columna costo_usd
revoke select on productos from anon;
grant select (id, categoria_id, nombre, descripcion, precio_usd, foto_url, alergenos, disponible, activo, solo_salon, orden, created_at)
  on productos to anon;

create policy zonas_ver on zonas_delivery for select using (activa or mi_rol() is not null);
create policy zonas_admin on zonas_delivery for all to authenticated
  using (tiene_rol('admin')) with check (tiene_rol('admin'));

-- mesas: solo personal (el público entra por token mediante función)
create policy mesas_ver on mesas for select to authenticated using (mi_rol() is not null);
create policy mesas_admin on mesas for all to authenticated
  using (tiene_rol('admin')) with check (tiene_rol('admin'));

create policy cuentas_ver on cuentas for select to authenticated
  using (tiene_rol('admin', 'cajero', 'mesonero'));

-- pedidos: el motorizado solo ve los suyos; los cambios van por funciones
create policy pedidos_ver on pedidos for select to authenticated
  using (tiene_rol('admin', 'cajero', 'mesonero', 'cocina') or (tiene_rol('motorizado') and motorizado_id = auth.uid()));
create policy items_ver on pedido_items for select to authenticated
  using (exists (select 1 from pedidos p where p.id = pedido_id));  -- hereda la política de pedidos

create policy pagos_ver on pagos for select to authenticated using (tiene_rol('admin', 'cajero', 'mesonero'));

create policy llamadas_ver on llamadas for select to authenticated using (tiene_rol('admin', 'cajero', 'mesonero'));

create policy reservas_ver on reservas for select to authenticated using (tiene_rol('admin', 'cajero', 'mesonero'));
create policy reservas_editar on reservas for update to authenticated
  using (tiene_rol('admin', 'cajero', 'mesonero')) with check (tiene_rol('admin', 'cajero', 'mesonero'));
create policy reservas_borrar on reservas for delete to authenticated using (tiene_rol('admin'));

-- =====================================================================
-- FUNCIONES PÚBLICAS (comensal por QR y cliente delivery)
-- =====================================================================

-- Datos de la mesa por el token del QR
create or replace function mesa_por_token(p_token uuid)
returns table (id uuid, numero int, ambiente ambiente_mesa)
language sql stable security definer set search_path = public as $$
  select id, numero, ambiente from mesas where token = p_token and activa
$$;

-- Arma los ítems a partir del carrito, con precio del servidor.
-- p_items: [{ "producto_id": uuid, "cantidad": int, "notas": text, "comensal": int }]
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
    insert into pedido_items (pedido_id, producto_id, nombre, precio_usd, cantidad, notas, comensal)
    values (p_pedido, prod.id, prod.nombre, prod.precio_usd, cant,
            nullif(left(coalesce(it->>'notas', ''), 200), ''),
            greatest(1, least(30, coalesce((it->>'comensal')::int, 1))));
    subtotal := subtotal + prod.precio_usd * cant;
  end loop;
  update pedidos set subtotal_usd = subtotal where id = p_pedido;
  return subtotal;
end $$;
revoke all on function _insertar_items(uuid, jsonb, boolean) from public, anon, authenticated;

-- Abre (o reutiliza) la cuenta de una mesa
create or replace function _cuenta_de_mesa(p_mesa uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select id into c from cuentas where mesa_id = p_mesa and abierta;
  if c is null then
    insert into cuentas (mesa_id) values (p_mesa) returning id into c;
  end if;
  return c;
end $$;
revoke all on function _cuenta_de_mesa(uuid) from public, anon, authenticated;

-- Pedido desde el QR de la mesa
create or replace function crear_pedido_mesa(p_token uuid, p_items jsonb, p_notas text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare m mesas; ped uuid; aprob boolean; pendientes int;
begin
  select * into m from mesas where token = p_token and activa;
  if not found then raise exception 'Código QR no válido'; end if;
  -- freno anti-abuso: máximo 5 pedidos por aprobar en la mesa
  select count(*) into pendientes from pedidos where mesa_id = m.id and estado = 'por_aprobar';
  if pendientes >= 5 then raise exception 'Hay pedidos esperando al mesonero. Espera un momento.'; end if;
  select qr_requiere_aprobacion into aprob from ajustes where id = 1;
  insert into pedidos (tipo, estado, origen, mesa_id, cuenta_id, notas, aprobado_at)
  values ('mesa', case when aprob then 'por_aprobar' else 'nuevo' end::estado_pedido, 'qr', m.id,
          _cuenta_de_mesa(m.id), nullif(left(coalesce(p_notas, ''), 300), ''),
          case when aprob then null else now() end)
  returning id into ped;
  perform _insertar_items(ped, p_items, false);
  return ped;
end $$;

-- Pedidos de la cuenta abierta de la mesa (para que el comensal vea el estado)
create or replace function pedidos_de_mesa(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'numero', p.numero, 'estado', p.estado, 'subtotal_usd', p.subtotal_usd, 'created_at', p.created_at,
    'items', (select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad))
              from pedido_items i where i.pedido_id = p.id)
  ) order by p.created_at), '[]'::jsonb)
  from pedidos p
  join mesas m on m.id = p.mesa_id and m.token = p_token
  join cuentas c on c.id = p.cuenta_id and c.abierta
  where p.estado <> 'cancelado'
$$;

-- Llamar al mesonero / pedir la cuenta
create or replace function llamar_desde_mesa(p_token uuid, p_tipo text)
returns void language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  if p_tipo not in ('mesonero', 'cuenta') then raise exception 'Tipo no válido'; end if;
  select id into m from mesas where token = p_token and activa;
  if m is null then raise exception 'Código QR no válido'; end if;
  -- no duplicar llamadas pendientes
  if not exists (select 1 from llamadas where mesa_id = m and tipo = p_tipo and not atendida) then
    insert into llamadas (mesa_id, tipo) values (m, p_tipo);
  end if;
end $$;

-- Pedido de delivery
create or replace function crear_pedido_delivery(
  p_nombre text, p_telefono text, p_direccion text, p_zona uuid, p_items jsonb,
  p_notas text default null, p_metodo metodo_pago default null, p_referencia text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare z zonas_delivery; ped uuid; tok uuid; sub numeric; aj ajustes;
begin
  select * into aj from ajustes where id = 1;
  if not aj.delivery_activo then raise exception 'El delivery no está disponible en este momento'; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe tu nombre'; end if;
  if length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')) < 10 then raise exception 'Teléfono no válido'; end if;
  if length(trim(coalesce(p_direccion, ''))) < 8 then raise exception 'Escribe la dirección completa'; end if;
  select * into z from zonas_delivery where id = p_zona and activa;
  if not found then raise exception 'Zona de entrega no válida'; end if;

  insert into pedidos (tipo, estado, origen, cliente_nombre, cliente_telefono, direccion, zona_id,
                       costo_envio_usd, notas)
  values ('delivery', 'por_aprobar', 'web', left(trim(p_nombre), 80), left(trim(p_telefono), 30),
          left(trim(p_direccion), 300), z.id, z.tarifa_usd, nullif(left(coalesce(p_notas, ''), 300), ''))
  returning id, token_publico into ped, tok;
  sub := _insertar_items(ped, p_items, true);

  -- pago reportado por el cliente: queda sin verificar hasta que caja lo revise
  if p_metodo is not null and p_metodo in ('pago_movil', 'zelle') then
    if length(trim(coalesce(p_referencia, ''))) < 4 then raise exception 'Escribe la referencia del pago'; end if;
    insert into pagos (pedido_id, metodo, monto_usd, monto_bs, tasa, referencia, origen)
    values (ped, p_metodo, sub + z.tarifa_usd,
            case when p_metodo = 'pago_movil' then round((sub + z.tarifa_usd) * aj.tasa_bs, 2) end,
            aj.tasa_bs, left(trim(p_referencia), 40), 'web');
  end if;
  return tok;
end $$;

-- Seguimiento público del delivery
create or replace function estado_pedido_publico(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'numero', p.numero, 'estado', p.estado, 'subtotal_usd', p.subtotal_usd,
    'costo_envio_usd', p.costo_envio_usd, 'created_at', p.created_at,
    'cliente_nombre', p.cliente_nombre, 'zona', z.nombre,
    'motorizado', (select nombre from perfiles where id = p.motorizado_id),
    'items', (select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'precio_usd', i.precio_usd))
              from pedido_items i where i.pedido_id = p.id)
  )
  from pedidos p left join zonas_delivery z on z.id = p.zona_id
  where p.token_publico = p_token
$$;

create or replace function crear_reserva(
  p_nombre text, p_telefono text, p_fecha date, p_hora time, p_personas int,
  p_ambiente ambiente_mesa, p_notas text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe tu nombre'; end if;
  if length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')) < 10 then raise exception 'Teléfono no válido'; end if;
  if p_fecha < (now() at time zone 'America/Caracas')::date then raise exception 'La fecha ya pasó'; end if;
  if p_fecha > (now() at time zone 'America/Caracas')::date + 90 then raise exception 'Solo aceptamos reservas hasta 90 días antes'; end if;
  if p_personas not between 1 and 40 then raise exception 'Número de personas no válido'; end if;
  if (select count(*) from reservas where telefono = trim(p_telefono) and estado = 'pendiente') >= 3 then
    raise exception 'Ya tienes reservas pendientes. Te contactaremos pronto.';
  end if;
  insert into reservas (nombre, telefono, fecha, hora, personas, ambiente, notas)
  values (left(trim(p_nombre), 80), left(trim(p_telefono), 30), p_fecha, p_hora, p_personas, p_ambiente,
          nullif(left(coalesce(p_notas, ''), 300), ''));
end $$;

-- =====================================================================
-- FUNCIONES DEL PERSONAL (cada una revisa el rol)
-- =====================================================================

-- Mesonero / caja / admin cargan un pedido en la mesa
create or replace function crear_pedido_personal(p_mesa uuid, p_items jsonb, p_notas text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare ped uuid; c uuid;
begin
  if not tiene_rol('admin', 'cajero', 'mesonero') then raise exception 'Sin permiso'; end if;
  if not exists (select 1 from mesas where id = p_mesa and activa) then raise exception 'Mesa no válida'; end if;
  c := _cuenta_de_mesa(p_mesa);
  update cuentas set mesonero_id = coalesce(mesonero_id, auth.uid()) where id = c;
  insert into pedidos (tipo, estado, origen, mesa_id, cuenta_id, notas, mesonero_id, aprobado_at)
  values ('mesa', 'nuevo', 'personal', p_mesa, c, nullif(left(coalesce(p_notas, ''), 300), ''), auth.uid(), now())
  returning id into ped;
  perform _insertar_items(ped, p_items, false);
  return ped;
end $$;

-- Abrir mesa sin pedido (se sentaron)
create or replace function abrir_mesa(p_mesa uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if not tiene_rol('admin', 'cajero', 'mesonero') then raise exception 'Sin permiso'; end if;
  c := _cuenta_de_mesa(p_mesa);
  update cuentas set mesonero_id = coalesce(mesonero_id, auth.uid()) where id = c;
  return c;
end $$;

-- Cambiar a qué comensal pertenece un plato (dividir cuenta)
create or replace function asignar_comensal(p_item uuid, p_comensal int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('admin', 'cajero', 'mesonero') then raise exception 'Sin permiso'; end if;
  update pedido_items set comensal = greatest(1, least(30, p_comensal)) where id = p_item;
end $$;

-- Máquina de estados: quién puede mover un pedido y a dónde
create or replace function cambiar_estado_pedido(p_pedido uuid, p_estado estado_pedido)
returns void language plpgsql security definer set search_path = public as $$
declare p pedidos; r rol_personal := mi_rol(); ok boolean := false;
begin
  if r is null then raise exception 'Sin permiso'; end if;
  select * into p from pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p.estado = p_estado then return; end if;

  ok := case
    -- aprobar: mesonero aprueba los de mesa; caja aprueba los de delivery
    when p.estado = 'por_aprobar' and p_estado = 'nuevo' then
      r = 'admin' or (p.tipo = 'mesa' and r in ('mesonero', 'cajero')) or (p.tipo = 'delivery' and r = 'cajero')
    -- cocina
    when p.estado = 'nuevo' and p_estado = 'preparando' then r in ('admin', 'cocina')
    when p.estado = 'preparando' and p_estado = 'listo' then r in ('admin', 'cocina')
    when p.estado = 'preparando' and p_estado = 'nuevo' then r in ('admin', 'cocina')  -- deshacer
    when p.estado = 'listo' and p_estado = 'preparando' then r in ('admin', 'cocina')  -- deshacer
    -- sala
    when p.tipo = 'mesa' and p.estado = 'listo' and p_estado = 'servido' then r in ('admin', 'cajero', 'mesonero')
    -- delivery
    when p.tipo = 'delivery' and p.estado = 'listo' and p_estado = 'en_ruta' then
      (r in ('admin', 'cajero') and p.motorizado_id is not null) or (r = 'motorizado' and p.motorizado_id = auth.uid())
    when p.tipo = 'delivery' and p.estado = 'en_ruta' and p_estado = 'entregado' then
      r in ('admin', 'cajero') or (r = 'motorizado' and p.motorizado_id = auth.uid())
    -- cancelar: gratis antes de cocina; una vez en preparación solo caja/admin
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
end $$;

create or replace function asignar_motorizado(p_pedido uuid, p_motorizado uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('admin', 'cajero') then raise exception 'Sin permiso'; end if;
  if p_motorizado is not null and not exists (select 1 from perfiles where id = p_motorizado and rol = 'motorizado' and activo) then
    raise exception 'Motorizado no válido';
  end if;
  update pedidos set motorizado_id = p_motorizado where id = p_pedido and tipo = 'delivery'
    and estado not in ('entregado', 'cancelado');
end $$;

-- Encender / apagar un plato agotado
create or replace function cambiar_disponibilidad(p_producto uuid, p_disponible boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('admin', 'cajero', 'cocina', 'mesonero') then raise exception 'Sin permiso'; end if;
  update productos set disponible = p_disponible where id = p_producto;
end $$;

create or replace function atender_llamada(p_llamada uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('admin', 'cajero', 'mesonero') then raise exception 'Sin permiso'; end if;
  update llamadas set atendida = true, atendida_por = auth.uid() where id = p_llamada;
end $$;

-- Tasa del día (manual o BCV)
create or replace function fijar_tasa(p_valor numeric, p_fuente text default 'manual') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('admin', 'cajero') then raise exception 'Sin permiso'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Tasa no válida'; end if;
  insert into tasas (valor, fuente, creado_por) values (p_valor, left(p_fuente, 40), auth.uid());
  update ajustes set tasa_bs = p_valor, tasa_fuente = left(p_fuente, 40), tasa_actualizada = now(), updated_at = now()
  where id = 1;
end $$;

-- Registrar un pago
create or replace function registrar_pago(
  p_cuenta uuid, p_pedido uuid, p_metodo metodo_pago, p_monto_usd numeric,
  p_monto_bs numeric default null, p_referencia text default null, p_comensal int default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; t numeric;
begin
  if not tiene_rol('admin', 'cajero') then raise exception 'Sin permiso'; end if;
  if p_cuenta is null and p_pedido is null then raise exception 'Falta la cuenta o el pedido'; end if;
  if p_monto_usd is null or p_monto_usd <= 0 then raise exception 'Monto no válido'; end if;
  if p_metodo in ('pago_movil', 'zelle') and length(trim(coalesce(p_referencia, ''))) < 4 then
    raise exception 'Escribe la referencia';
  end if;
  select tasa_bs into t from ajustes where id = 1;
  insert into pagos (cuenta_id, pedido_id, metodo, monto_usd, monto_bs, tasa, referencia, comensal,
                     verificado, verificado_por, registrado_por)
  values (p_cuenta, p_pedido, p_metodo, round(p_monto_usd, 2), p_monto_bs, t, nullif(trim(coalesce(p_referencia, '')), ''),
          p_comensal,
          -- lo registra caja después de comprobarlo: queda verificado
          true, auth.uid(), auth.uid())
  returning id into pid;
  return pid;
end $$;

create or replace function verificar_pago(p_pago uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('admin', 'cajero') then raise exception 'Sin permiso'; end if;
  if p_ok then
    update pagos set verificado = true, verificado_por = auth.uid() where id = p_pago;
  else
    delete from pagos where id = p_pago and not verificado;  -- referencia falsa: se descarta
  end if;
end $$;

-- Cerrar la cuenta de la mesa (libera la mesa)
create or replace function cerrar_cuenta(p_cuenta uuid, p_forzar boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare total numeric; pagado numeric; pendientes int; c cuentas;
begin
  if not tiene_rol('admin', 'cajero') then raise exception 'Sin permiso'; end if;
  select * into c from cuentas where id = p_cuenta and abierta for update;
  if not found then raise exception 'La cuenta ya está cerrada'; end if;
  select count(*) into pendientes from pedidos
    where cuenta_id = p_cuenta and estado in ('por_aprobar', 'nuevo', 'preparando', 'listo');
  if pendientes > 0 and not p_forzar then raise exception 'Hay platos sin servir en esta mesa'; end if;
  select coalesce(sum(subtotal_usd), 0) into total from pedidos where cuenta_id = p_cuenta and estado <> 'cancelado';
  select coalesce(sum(monto_usd), 0) into pagado from pagos where cuenta_id = p_cuenta and verificado;
  if pagado + 0.009 < total and not (p_forzar and tiene_rol('admin')) then
    raise exception 'Falta cobrar % USD', round(total - pagado, 2);
  end if;
  update cuentas set abierta = false, cerrada_at = now(), cerrada_por = auth.uid() where id = p_cuenta;
  update llamadas set atendida = true, atendida_por = auth.uid() where mesa_id = c.mesa_id and not atendida;
end $$;

-- Mover una cuenta a otra mesa (cambio de mesa)
create or replace function mover_cuenta(p_cuenta uuid, p_mesa_destino uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol('admin', 'cajero', 'mesonero') then raise exception 'Sin permiso'; end if;
  if exists (select 1 from cuentas where mesa_id = p_mesa_destino and abierta) then
    raise exception 'La mesa destino está ocupada';
  end if;
  update cuentas set mesa_id = p_mesa_destino where id = p_cuenta and abierta;
  update pedidos set mesa_id = p_mesa_destino where cuenta_id = p_cuenta;
end $$;

-- Reporte de ventas (solo admin). Zona horaria de Venezuela.
create or replace function resumen_ventas(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb; d timestamptz; h timestamptz;
begin
  if not tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  d := (p_desde::timestamp at time zone 'America/Caracas');
  h := ((p_hasta + 1)::timestamp at time zone 'America/Caracas');
  select jsonb_build_object(
    'ventas_usd', (select coalesce(sum(subtotal_usd + costo_envio_usd), 0) from pedidos
                   where created_at >= d and created_at < h and estado not in ('cancelado', 'por_aprobar')),
    'pedidos', (select count(*) from pedidos where created_at >= d and created_at < h and estado <> 'cancelado' and estado <> 'por_aprobar'),
    'pedidos_mesa', (select count(*) from pedidos where created_at >= d and created_at < h and tipo = 'mesa' and estado not in ('cancelado', 'por_aprobar')),
    'pedidos_delivery', (select count(*) from pedidos where created_at >= d and created_at < h and tipo = 'delivery' and estado not in ('cancelado', 'por_aprobar')),
    'cancelados', (select count(*) from pedidos where created_at >= d and created_at < h and estado = 'cancelado'),
    'cobrado_usd', (select coalesce(sum(monto_usd), 0) from pagos where created_at >= d and created_at < h and verificado),
    'por_metodo', (select coalesce(jsonb_object_agg(metodo, jsonb_build_object('usd', usd, 'bs', bs, 'n', n)), '{}'::jsonb) from (
        select metodo, sum(monto_usd) usd, sum(coalesce(monto_bs, 0)) bs, count(*) n from pagos
        where created_at >= d and created_at < h and verificado group by metodo) x),
    'top_platos', (select coalesce(jsonb_agg(x order by x.cantidad desc), '[]'::jsonb) from (
        select i.nombre, sum(i.cantidad) cantidad, sum(i.cantidad * i.precio_usd) usd
        from pedido_items i join pedidos p on p.id = i.pedido_id
        where p.created_at >= d and p.created_at < h and p.estado not in ('cancelado', 'por_aprobar')
        group by i.nombre order by sum(i.cantidad) desc limit 10) x),
    'por_dia', (select coalesce(jsonb_agg(x order by x.dia), '[]'::jsonb) from (
        select (created_at at time zone 'America/Caracas')::date dia, sum(subtotal_usd + costo_envio_usd) usd, count(*) n
        from pedidos where created_at >= d and created_at < h and estado not in ('cancelado', 'por_aprobar')
        group by 1) x),
    'tiempo_cocina_min', (select round(avg(extract(epoch from (listo_at - iniciado_at)) / 60)::numeric, 1) from pedidos
        where created_at >= d and created_at < h and listo_at is not null and iniciado_at is not null)
  ) into res;
  return res;
end $$;

-- Permisos de ejecución
-- Supabase da EXECUTE a anon/authenticated por defecto: se quita a todos y se concede uno por uno
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function mi_rol(), tiene_rol(rol_personal[]) to anon, authenticated;
grant execute on function mesa_por_token(uuid), crear_pedido_mesa(uuid, jsonb, text), pedidos_de_mesa(uuid),
  llamar_desde_mesa(uuid, text),
  crear_pedido_delivery(text, text, text, uuid, jsonb, text, metodo_pago, text),
  estado_pedido_publico(uuid),
  crear_reserva(text, text, date, time, int, ambiente_mesa, text)
  to anon, authenticated;
grant execute on function crear_pedido_personal(uuid, jsonb, text), abrir_mesa(uuid), asignar_comensal(uuid, int),
  cambiar_estado_pedido(uuid, estado_pedido), asignar_motorizado(uuid, uuid), cambiar_disponibilidad(uuid, boolean),
  atender_llamada(uuid), fijar_tasa(numeric, text),
  registrar_pago(uuid, uuid, metodo_pago, numeric, numeric, text, int), verificar_pago(uuid, boolean),
  cerrar_cuenta(uuid, boolean), mover_cuenta(uuid, uuid), resumen_ventas(date, date)
  to authenticated;

-- =====================================================================
-- TIEMPO REAL (WebSockets de Supabase)
-- =====================================================================
alter publication supabase_realtime add table pedidos, pedido_items, llamadas, cuentas, pagos, productos, reservas, ajustes;

-- =====================================================================
-- FOTOS DEL MENÚ (Storage)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('menu', 'menu', true)
  on conflict (id) do nothing;
create policy menu_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'menu' and public.tiene_rol('admin'));
create policy menu_fotos_editar on storage.objects for update to authenticated
  using (bucket_id = 'menu' and public.tiene_rol('admin')) with check (bucket_id = 'menu' and public.tiene_rol('admin'));
create policy menu_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'menu' and public.tiene_rol('admin'));
