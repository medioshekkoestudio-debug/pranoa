import Image from 'next/image';
import Link from 'next/link';
import { Logo } from './Logo';

export function Encabezado({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <>
      <div className="sticky top-0 z-30 border-b border-ciruela/10 bg-taupe-claro/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <Link href="/" aria-label="Inicio"><Logo color="#FFFFFF" className="h-9 sm:h-10" /></Link>
          <Link
            href="/entrar"
            aria-label="Acceso del personal"
            title="Acceso del personal"
            className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-white shadow-sm transition hover:scale-105"
          >
            <Image src="/iconos/icon-user.png" alt="Usuario" fill className="object-cover" />
          </Link>
        </div>
      </div>
      <header className="mx-auto max-w-5xl px-4 pt-5">
        <h1 className="text-3xl font-bold">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-taupe">{subtitulo}</p>}
      </header>
    </>
  );
}
