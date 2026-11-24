-- Corrección: proteger_perfil era SECURITY DEFINER, así que current_user siempre era el dueño
-- (postgres) y la función dejaba pasar todo: un mesonero podía ponerse rol admin.
-- Ahora corre con el rol de quien hace el cambio (authenticated / service_role).
create or replace function proteger_perfil() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then return new; end if;
  if not tiene_rol('admin') then
    if new.rol is distinct from old.rol or new.activo is distinct from old.activo or new.id is distinct from old.id then
      raise exception 'Solo un administrador puede cambiar rol o estado';
    end if;
  end if;
  if old.id = auth.uid() and old.rol = 'admin' and (new.rol <> 'admin' or not new.activo) then
    raise exception 'No puedes quitarte el rol de administrador a ti mismo';
  end if;
  return new;
end $$;
