import { Encabezado } from '@/components/Encabezado';
import { Seguimiento } from './Seguimiento';
import { cargarAjustes } from '@/lib/datos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu pedido' };

export default async function PaginaPedido({ params }: { params: { token: string } }) {
  const a = await cargarAjustes();
  return (
    <main>
      <Encabezado titulo="Tu pedido" />
      <div className="mx-auto max-w-xl px-4 pt-4">
        <Seguimiento token={params.token} whatsapp={a.whatsapp} />
      </div>
    </main>
  );
}
