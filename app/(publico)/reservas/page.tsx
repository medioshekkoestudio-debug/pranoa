import { Encabezado } from '@/components/Encabezado';
import { FormReserva } from './FormReserva';

export const metadata = { title: 'Reservar mesa' };

export default function Reservas() {
  return (
    <main>
      <Encabezado titulo="Reserva tu mesa" subtitulo="Te confirmamos por WhatsApp." />
      <div className="mx-auto max-w-xl px-4 pt-4">
        <FormReserva />
      </div>
    </main>
  );
}
