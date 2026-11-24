-- Los proyectos nuevos de Supabase no dan permisos de tabla a anon/authenticated por defecto.
-- Se conceden aquí de forma explícita; las políticas RLS de 0001 siguen decidiendo QUÉ filas ve cada quien.

-- Público (sin cuenta): solo lectura de lo que muestra la web
grant select on ajustes, categorias, zonas_delivery, productos_publicos to anon;
-- productos: sin la columna costo_usd (ya concedido por columnas en 0001; se repite por si acaso)
grant select (id, categoria_id, nombre, descripcion, precio_usd, foto_url, alergenos, disponible, activo, solo_salon, orden, created_at)
  on productos to anon;

-- Personal con sesión: RLS filtra por perfil
grant select on all tables in schema public to authenticated;
grant insert, update, delete on perfiles, ajustes, categorias, productos, mesas, zonas_delivery, reservas to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- service_role (servidor) lo necesita para crear cuentas del personal
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
