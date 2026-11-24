import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pranoa · un refugio seguro',
    short_name: 'Pranoa',
    description: 'Carta digital, delivery, reservas y sistema interno de Pranoa.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#F6EFE4',
    theme_color: '#65663B',
    lang: 'es',
    icons: [
      { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Carta', url: '/carta' },
      { name: 'Pedir delivery', url: '/delivery' },
      { name: 'Personal', url: '/entrar' },
    ],
  };
}
