'use client';
import Image from 'next/image';
import Link from 'next/link';
import { createContext, useContext } from 'react';
import { Logo } from './Logo';
import type { Perfil } from '@/lib/tipos';
import { NOMBRE_ROL } from '@/lib/permisos';

// Contexto del perfil activo — lo provee MarcoPanel, lo consume CabeceraPanel
export const ContextoPerfilCabecera = createContext<Perfil | null>(null);

/** Cabecera unificada del panel según la interfaz oficial Pranoa:
 *  Logo Pranoa en blanco a la izquierda · Título de la sección al centro ·
 *  Pill con el nombre del perfil activo (Administrador, Mesonero, Cocina...) + icono de usuario a la derecha.
 */
export function CabeceraPanel({ titulo, children, oscuro = false }: { titulo: string; children?: React.ReactNode; oscuro?: boolean }) {
  const perfil = useContext(ContextoPerfilCabecera);

  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur print:hidden ${
        oscuro
          ? 'border-white/10 bg-ciruela-oscuro/95 text-crema'
          : 'border-ciruela/10 bg-taupe-claro/95 text-ciruela'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Logo color="#FFFFFF" className="h-9 shrink-0 sm:h-10" />
          <h1 className={`truncate text-base font-bold sm:text-xl ${oscuro ? 'text-crema' : 'text-ciruela'}`}>
            {titulo}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {children}
          {perfil && (
            <Link
              href="/panel/mas"
              className="flex items-center gap-2 rounded-full transition hover:opacity-90"
              title={`${perfil.nombre} · ${NOMBRE_ROL[perfil.rol]}`}
            >
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-white shadow-sm ${
                  oscuro ? 'bg-naranja/90' : 'bg-taupe-oscuro'
                }`}
              >
                {NOMBRE_ROL[perfil.rol]}
              </span>
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
                <Image src="/iconos/icon-user.png" alt={NOMBRE_ROL[perfil.rol]} fill className="object-cover" />
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
