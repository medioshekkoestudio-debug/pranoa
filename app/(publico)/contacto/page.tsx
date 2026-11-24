import { Encabezado } from '@/components/Encabezado';
import { BotonDescargar } from '@/components/Pwa';
import { cargarAjustes, enlaceWhatsapp } from '@/lib/datos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contacto y ubicación' };

export default async function Contacto() {
  const a = await cargarAjustes();
  const wa = enlaceWhatsapp(a.whatsapp, 'Hola Pranoa');
  const consulta = encodeURIComponent(a.direccion || 'Pranoa Valencia Carabobo');
  return (
    <main>
      <Encabezado titulo="Contacto y ubicación" />
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-ciruela/5">
          <iframe
            title="Mapa de Pranoa"
            className="h-72 w-full border-0"
            loading="lazy"
            src={`https://maps.google.com/maps?q=${consulta}&z=15&output=embed`}
          />
        </div>
        <div className="tarjeta space-y-3">
          <div><p className="text-sm text-taupe">Dirección</p><p className="font-semibold">{a.direccion}</p></div>
          <div><p className="text-sm text-taupe">Horario</p><p className="font-semibold">{a.horario}</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-primario">WhatsApp</a>}
          {a.instagram && (
            <a href={`https://instagram.com/${a.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="btn-secundario">
              Instagram
            </a>
          )}
          <a href={a.mapa_url || `https://www.google.com/maps/search/?api=1&query=${consulta}`} target="_blank" rel="noreferrer" className="btn-secundario">
            Cómo llegar
          </a>
        </div>
        <div className="pt-2 text-center"><BotonDescargar /></div>
      </div>
    </main>
  );
}
