import { notFound } from 'next/navigation';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { cargarCarta } from '@/lib/datos';
import { MesaQr } from './MesaQr';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu mesa' };

export default async function PaginaMesa({ params }: { params: { token: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) notFound();
  const { data } = await supabaseServidor().rpc('mesa_por_token', { p_token: params.token });
  const mesa = Array.isArray(data) ? data[0] : null;
  if (!mesa) notFound();
  const { categorias, productos, ajustes } = await cargarCarta();
  return (
    <MesaQr
      token={params.token}
      numero={mesa.numero}
      categorias={categorias}
      productosIniciales={productos}
      tasa={Number(ajustes.tasa_bs)}
      requiereAprobacion={ajustes.qr_requiere_aprobacion}
    />
  );
}
