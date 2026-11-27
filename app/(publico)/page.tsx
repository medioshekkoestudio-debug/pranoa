import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { BotonDescargar } from '@/components/Pwa';
import { BotonQrWeb } from '@/components/QrWeb';
import { cargarAjustes, enlaceWhatsapp } from '@/lib/datos';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const a = await cargarAjustes();
  const wa = enlaceWhatsapp(a.whatsapp, 'Hola Pranoa, quisiera información.');
  return (
    <main className="min-h-screen bg-taupe-suave">
      {/* Header superior con logo blanco e icono de usuario (reemplaza "Personal") */}
      <header className="sticky top-0 z-30 border-b border-ciruela/10 bg-taupe-claro/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <Logo color="#FFFFFF" className="h-10" />
          <Link
            href="/entrar"
            aria-label="Acceso del personal"
            title="Acceso del personal"
            className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-white shadow-sm transition hover:scale-105"
          >
            <Image src="/iconos/icon-user.png" alt="Acceso personal" fill className="object-cover" />
          </Link>
        </div>
      </header>

      {/* Banner principal con la fachada oficial de Pranoa */}
      <section className="relative overflow-hidden bg-ciruela text-crema">
        <div className="relative min-h-[380px] sm:min-h-[440px]">
          <Image
            src="/marca/fachada-pranoa.jpg"
            alt="Fachada de Pranoa, un refugio seguro"
            fill
            priority
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ciruela-oscuro/90 via-ciruela-oscuro/55 to-ciruela-oscuro/35" />

          <div className="relative z-10 mx-auto flex min-h-[380px] max-w-5xl flex-col justify-end px-5 pb-10 pt-14 sm:min-h-[440px] sm:pb-12">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-naranja-claro sm:text-sm">
                un refugio seguro
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight text-white drop-shadow sm:text-5xl">
                Cocina mediterránea para bajar el ritmo y disfrutar.
              </h1>
              <p className="mt-3 max-w-md text-sm text-crema/90 sm:text-base">
                Un espacio en Valencia para reencontrarte con los tuyos, con calma y buena mesa.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/carta" className="btn-naranja">Ver la carta</Link>
                <Link href="/delivery" className="btn-primario">Pedir delivery</Link>
                <Link
                  href="/reservas"
                  className="btn-secundario border-white/40 bg-ciruela-oscuro/50 text-white backdrop-blur-sm hover:border-white hover:bg-ciruela-oscuro/70"
                >
                  Reservar mesa
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* tres accesos */}
      <section className="relative z-10 mx-auto mt-6 grid max-w-5xl gap-3 px-4 sm:grid-cols-3">
        {[
          { href: '/carta', t: 'Nuestra carta', d: 'Fotos, descripciones y alérgenos de cada plato.', c: 'bg-white text-ciruela' },
          { href: '/delivery', t: 'Delivery en Valencia', d: 'Pide desde casa: el envío se calcula según tu zona.', c: 'bg-naranja text-white' },
          { href: '/reservas', t: 'Reserva tu mesa', d: 'Salón principal o terraza, tú eliges.', c: 'bg-ciruela text-crema' },
        ].map((x) => (
          <Link key={x.href} href={x.href} className={`rounded-2xl px-5 pb-5 pt-7 shadow-sm transition hover:-translate-y-0.5 ${x.c}`}>
            <p className="text-lg font-bold">{x.t}</p>
            <p className="mt-1 text-sm opacity-85">{x.d}</p>
          </Link>
        ))}
      </section>

      {/* info */}
      <section className="mx-auto mt-8 grid max-w-5xl gap-4 px-4 sm:grid-cols-2">
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

      <section className="mx-auto mt-8 max-w-5xl px-4 pb-6 text-center">
        <div className="flex flex-wrap justify-center gap-3">
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-primario">Escríbenos por WhatsApp</a>}
          <BotonDescargar />
          <BotonQrWeb />
        </div>
        <footer className="mt-8 text-xs text-taupe-oscuro">
          © {new Date().getFullYear()} Pranoa · Valencia, Carabobo · Todos los derechos reservados ·{' '}
          <a
            href="https://grupomonterove.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline decoration-taupe-oscuro/40 underline-offset-2 transition hover:text-oliva"
          >
            Creado por Grupo Montero
          </a>
        </footer>
      </section>
    </main>
  );
}
