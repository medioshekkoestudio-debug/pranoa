'use client';
import Image from 'next/image';
import { createContext, useContext } from 'react';
import { Isotipo } from './Logo';
import type { Perfil } from '@/lib/tipos';
import { NOMBRE_ROL } from '@/lib/permisos';

// Contexto del perfil activo — lo provee MarcoPanel, lo consume CabeceraPanel
export const ContextoPerfilCabecera = createContext<Perfil | null>(null);

/** Título de cada sección del panel.
 *  Muestra: isotipo · título · nombre y rol del usuario activo + icono de usuario.
 */
export function CabeceraPanel({ titulo, children, oscuro = false }: { titulo: string; children?: React.ReactNode; oscuro?: boolean }) {
  const perfil = useContext(ContextoPerfilCabecera);

  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur print:hidden ${oscuro ? 'border-white/10 bg-ciruela-oscuro/95' : 'border-ciruela/10 bg-crema/95'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Isotipo className={`h-8 w-8 shrink-0 ${oscuro ? 'text-naranja' : 'text-oliva'}`} />
        <h1 className="flex-1 truncate text-xl font-bold">{titulo}</h1>
        {children}
        {perfil && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className={`text-xs font-semibold ${oscuro ? 'text-crema' : 'text-ciruela'}`}>{perfil.nombre}</span>
              <span className={`text-[0.65rem] font-medium ${oscuro ? 'text-naranja' : 'text-oliva'}`}>{NOMBRE_ROL[perfil.rol]}</span>
            </div>
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-oliva/30">
              <Image src="/iconos/icon-user.png" alt={perfil.nombre} fill className="object-cover" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

