import type { Icono as NombreIcono } from '@/lib/permisos';

const TRAZOS: Record<NombreIcono, string> = {
  inicio: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  mesas: 'M4 9h16M6 9v10M18 9v10M8 5h8a2 2 0 012 2v2H6V7a2 2 0 012-2z',
  cocina: 'M7 21h10M8 17h8l1-7a4 4 0 00-3-4.5 3 3 0 00-4 0A4 4 0 007 10l1 7z',
  caja: 'M3 7h18v12H3zM3 11h18M7 15h3',
  delivery: 'M5 17a2 2 0 104 0 2 2 0 00-4 0zM15 17a2 2 0 104 0 2 2 0 00-4 0zM9 17h6M3 13h9V6H3v7zM12 9h4l3 4v4',
  entregas: 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z',
  reservas: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3',
  carta: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM9 9h6M9 13h6',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  perfil: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  usuarios: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M16 3.5a4 4 0 010 7M22 21a7 7 0 00-4-6.3',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  zonas: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  ajustes: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.5-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.5-1a7 7 0 002 1.2L10 21h4l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z',
  reportes: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  campana: 'M6 16V11a6 6 0 1112 0v5l2 2H4l2-2zM10 21h4',
  contacto: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z',
  cuenta: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6',
  bolsa: 'M6 7h12l1 14H5L6 7zM9 7V6a3 3 0 016 0v1',
};

export function Icono({ nombre, className = 'h-6 w-6' }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={nombre === 'mas' ? 3.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
