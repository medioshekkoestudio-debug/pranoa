import { redirect } from 'next/navigation';
import { perfilActual } from '@/lib/supabase/servidor';
import { INICIO_ROL } from '@/lib/permisos';

export default async function Panel() {
  const perfil = await perfilActual();
  redirect(perfil ? INICIO_ROL[perfil.rol] : '/entrar');
}
