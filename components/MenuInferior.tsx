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

/** Barra inferior fija estilo app, con los colores oficiales de Pranoa (fondo oliva e iconos blancos). */
export function MenuInferior({ botones, oscuro = false }: { botones: BotonMenu[]; oscuro?: boolean }) {
  const ruta = usePathname();
  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 border-t shadow-[0_-4px_16px_rgba(60,37,37,0.12)] print:hidden ${
        oscuro
          ? 'border-white/10 bg-ciruela-oscuro/98 text-crema'
          : 'border-oliva-oscuro/30 bg-oliva text-white'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-4xl">
        {botones.map((b) => {
          const activo = ruta === b.href || (b.href !== '/' && ruta.startsWith(b.href + '/'));
          const contenido = (
            <>
              {activo && (
                <span
                  className={`absolute left-1/2 top-0 h-1 w-10 -translate-x-1/2 rounded-b-full ${
                    oscuro ? 'bg-naranja' : 'bg-naranja-claro'
                  }`}
                />
              )}
              <span className="relative">
                <Icono nombre={b.icono} className="h-6 w-6" />
                {!!b.aviso && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[1.15rem] rounded-full bg-naranja px-1 text-center text-[0.65rem] font-bold leading-[1.15rem] text-white ring-2 ring-oliva">
                    {b.aviso > 99 ? '99+' : b.aviso}
                  </span>
                )}
              </span>
              <span className={`text-[0.7rem] ${activo ? 'font-bold' : 'font-medium'}`}>{b.titulo}</span>
            </>
          );
          const clase = `relative flex h-16 w-full flex-col items-center justify-center gap-0.5 transition-all ${
            activo
              ? oscuro
                ? 'bg-white/5 text-naranja'
                : 'bg-oliva-oscuro/45 text-white'
              : oscuro
                ? 'text-crema/65 hover:text-crema'
                : 'text-white/80 hover:bg-oliva-oscuro/25 hover:text-white'
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
