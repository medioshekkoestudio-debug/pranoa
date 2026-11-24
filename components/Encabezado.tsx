import Link from 'next/link';
import { Logo } from './Logo';

export function Encabezado({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <header className="mx-auto max-w-5xl px-4 pt-5">
      <Link href="/" aria-label="Inicio"><Logo /></Link>
      <h1 className="mt-5 text-3xl font-bold">{titulo}</h1>
      {subtitulo && <p className="mt-1 text-taupe">{subtitulo}</p>}
    </header>
  );
}
