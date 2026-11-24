import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function supabaseServidor() {
  const almacen = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // en Server Components no se pueden escribir cookies; el middleware las refresca
        }
      },
    },
  });
}

/** Solo en el servidor: salta RLS. Usar únicamente tras comprobar que quien llama es admin. */
export function supabaseServicio() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Usuario y perfil del personal en el servidor (null si no hay sesión o no es personal activo) */
export async function perfilActual() {
  const sb = supabaseServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('perfiles').select('id, nombre, rol, telefono, activo').eq('id', user.id).maybeSingle();
  if (!data || !data.activo) return null;
  return data as import('../tipos').Perfil;
}
