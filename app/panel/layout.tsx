import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { perfilActual, supabaseServidor } from '@/lib/supabase/servidor';
import { INICIO_ROL, puedeEntrar } from '@/lib/permisos';
import { MarcoPanel } from './MarcoPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel' };

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const perfil = await perfilActual();
  if (!perfil) {
    // sesión de alguien que no es personal activo
    await supabaseServidor().auth.signOut();
    redirect('/entrar');
  }
  const ruta = headers().get('x-ruta') || '/panel';
  if (ruta !== '/panel' && !puedeEntrar(perfil.rol, ruta)) redirect(INICIO_ROL[perfil.rol]);

  return <MarcoPanel perfil={perfil}>{children}</MarcoPanel>;
}
