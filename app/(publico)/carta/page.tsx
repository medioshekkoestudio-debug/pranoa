import { Encabezado } from '@/components/Encabezado';
import { CartaVista } from './CartaVista';
import { cargarCarta } from '@/lib/datos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carta' };

export default async function Carta() {
  const { categorias, productos, ajustes } = await cargarCarta();
  return (
    <main>
      <Encabezado titulo="Nuestra carta" subtitulo="Precios en dólares y bolívares a la tasa del día." />
      <div className="mx-auto max-w-5xl px-4">
        <CartaVista categorias={categorias} productosIniciales={productos} tasa={Number(ajustes.tasa_bs)} />
      </div>
    </main>
  );
}
