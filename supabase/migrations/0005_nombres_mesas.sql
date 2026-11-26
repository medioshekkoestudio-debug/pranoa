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
