'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Icono as NombreIcono } from '@/lib/permisos';
import { Icono } from './Icono';

export interface BotonMenu {
  href: string;
  titulo: string;
  icono: NombreIcono;
  aviso?: number; // globito con número (pedidos pendientes, llamadas…)
  onClick?: () => void;
}

/** Barra inferior fija estilo app. Respeta el área segura del iPhone. */
export function MenuInferior({ botones, oscuro = false }: { botones: BotonMenu[]; oscuro?: boolean }) {
  const ruta = usePathname();
  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur print:hidden ${
        oscuro ? 'border-white/10 bg-ciruela-oscuro/95 text-crema' : 'border-ciruela/10 bg-white/95 text-ciruela'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-3xl">
        {botones.map((b) => {
          const activo = ruta === b.href || (b.href !== '/' && ruta.startsWith(b.href + '/'));
          const contenido = (
            <>
              <span className="relative">
                <Icono nombre={b.icono} className="h-6 w-6" />
                {!!b.aviso && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[1.15rem] rounded-full bg-naranja px-1 text-center text-[0.65rem] font-bold leading-[1.15rem] text-white">
                    {b.aviso > 99 ? '99+' : b.aviso}
                  </span>
                )}
              </span>
              <span className="text-[0.68rem] font-medium">{b.titulo}</span>
            </>
          );
          const clase = `flex h-16 w-full flex-col items-center justify-center gap-0.5 transition-colors ${
            activo ? (oscuro ? 'text-naranja' : 'text-oliva') : 'opacity-70 hover:opacity-100'
          }`;
          return (
            <li key={b.href + b.titulo} className="flex-1">
              {b.onClick ? (
                <button type="button" onClick={b.onClick} className={clase}>{contenido}</button>
              ) : (
                <Link href={b.href} className={clase} aria-current={activo ? 'page' : undefined}>{contenido}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
