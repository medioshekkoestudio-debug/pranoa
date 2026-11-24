import { redirect } from 'next/navigation';
import { perfilActual } from '@/lib/supabase/servidor';
import { INICIO_ROL } from '@/lib/permisos';
import { Logo } from '@/components/Logo';
import { FormEntrar } from './FormEntrar';

export const metadata = { title: 'Entrar' };
export const dynamic = 'force-dynamic';

export default async function Entrar() {
  const perfil = await perfilActual();
  if (perfil) redirect(INICIO_ROL[perfil.rol]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-oliva px-5 py-10">
      <Logo color="#F6EFE4" grande />
      <div className="tarjeta mt-8 w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Acceso del personal</h1>
        <p className="mb-5 mt-1 text-sm text-taupe">Usa el usuario y la contraseña que te dio el administrador.</p>
        <FormEntrar />
      </div>
    </main>
  );
}
