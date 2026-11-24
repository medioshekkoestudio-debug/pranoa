import Link from 'next/link';
import { Isotipo, Logo } from '@/components/Logo';
import { BotonDescargar } from '@/components/Pwa';
import { cargarAjustes, enlaceWhatsapp } from '@/lib/datos';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const a = await cargarAjustes();
  const wa = enlaceWhatsapp(a.whatsapp, 'Hola Pranoa, quisiera información.');
  return (
    <main>
      {/* portada */}
      <section className="relative overflow-hidden bg-oliva text-crema">
        <Isotipo className="pointer-events-none absolute -right-16 -top-10 h-80 w-80 opacity-10" />
        <div className="mx-auto max-w-5xl px-5 pb-14 pt-8">
          <div className="flex items-center justify-between">
            <Logo color="#F6EFE4" />
            <Link href="/entrar" className="text-sm opacity-70 hover:opacity-100">Personal</Link>
          </div>
          <div className="mt-14 max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-naranja-claro">un refugio seguro</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
              Cocina mediterránea para bajar el ritmo y disfrutar.
            </h1>
            <p className="mt-4 max-w-md text-crema/80">
              Un espacio en Valencia para reencontrarte con los tuyos, con calma y buena mesa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/carta" className="btn-naranja">Ver la carta</Link>
              <Link href="/delivery" className="btn-secundario border-transparent">Pedir delivery</Link>
              <Link href="/reservas" className="btn-secundario border-crema/30 bg-transparent text-crema hover:border-crema">Reservar mesa</Link>
            </div>
          </div>
        </div>
      </section>

      {/* tres accesos */}
      <section className="relative z-10 mx-auto mt-6 grid max-w-5xl gap-3 px-4 sm:grid-cols-3">
        {[
          { href: '/carta', t: 'Nuestra carta', d: 'Fotos, descripciones y alérgenos de cada plato.', c: 'bg-white' },
          { href: '/delivery', t: 'Delivery en Valencia', d: 'Pide desde casa: el envío se calcula según tu zona.', c: 'bg-naranja text-white' },
          { href: '/reservas', t: 'Reserva tu mesa', d: 'Salón principal o terraza, tú eliges.', c: 'bg-ciruela text-crema' },
        ].map((x) => (
          <Link key={x.href} href={x.href} className={`rounded-2xl px-5 pb-5 pt-7 shadow-sm transition hover:-translate-y-0.5 ${x.c}`}>
            <p className="text-lg font-bold">{x.t}</p>
            <p className="mt-1 text-sm opacity-80">{x.d}</p>
          </Link>
        ))}
      </section>

      {/* info */}
      <section className="mx-auto mt-10 grid max-w-5xl gap-4 px-4 sm:grid-cols-2">
        <div className="tarjeta">
          <p className="text-sm font-semibold uppercase tracking-wider text-taupe">Horario</p>
          <p className="mt-1 text-lg">{a.horario}</p>
        </div>
        <div className="tarjeta">
          <p className="text-sm font-semibold uppercase tracking-wider text-taupe">Dónde estamos</p>
          <p className="mt-1 text-lg">{a.direccion}</p>
          {a.mapa_url && <a href={a.mapa_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-oliva">Cómo llegar →</a>}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-5xl px-4 text-center">
        <div className="flex flex-wrap justify-center gap-3">
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-primario">Escríbenos por WhatsApp</a>}
          <BotonDescargar />
        </div>
        <p className="mt-10 text-xs text-taupe">© {new Date().getFullYear()} Pranoa · Valencia, Carabobo</p>
      </section>
    </main>
  );
}
