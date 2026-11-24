'use client';
import { MenuInferior } from '@/components/MenuInferior';

export function MenuPublico() {
  return (
    <MenuInferior
      botones={[
        { href: '/', titulo: 'Inicio', icono: 'inicio' },
        { href: '/carta', titulo: 'Carta', icono: 'carta' },
        { href: '/delivery', titulo: 'Delivery', icono: 'delivery' },
        { href: '/reservas', titulo: 'Reservar', icono: 'reservas' },
        { href: '/contacto', titulo: 'Contacto', icono: 'contacto' },
      ]}
    />
  );
}
