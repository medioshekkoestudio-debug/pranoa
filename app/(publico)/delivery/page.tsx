import { Encabezado } from '@/components/Encabezado';
import { cargarCarta, cargarZonas } from '@/lib/datos';
import { Delivery } from './Delivery';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Delivery' };

export default async function PaginaDelivery() {
  const [{ categorias, productos, ajustes }, zonas] = await Promise.all([cargarCarta(), cargarZonas()]);
  return (
    <main>
      <Encabezado titulo="Delivery" subtitulo="Pide desde tu casa u oficina en Valencia." />
      <div className="mx-auto max-w-5xl px-4">
        {ajustes.delivery_activo ? (
          <Delivery categorias={categorias} productosIniciales={productos} zonas={zonas} ajustes={ajustes} />
        ) : (
          <p className="tarjeta mt-6 text-center">El delivery no está disponible en este momento. ¡Te esperamos en el restaurante!</p>
        )}
      </div>
    </main>
  );
}
