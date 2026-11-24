import type { EstadoPedido, MetodoPago } from './tipos';

const num = (n: number) =>
  Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const usd = (n: number) => '$' + num(n);
export const bs = (n: number) => 'Bs. ' + num(n);
export const aBs = (montoUsd: number, tasa: number) => Math.round(montoUsd * tasa * 100) / 100;

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Caracas' });

export const fechaLarga = (fecha: string) =>
  new Date(fecha + 'T12:00:00').toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });

export const minutosDesde = (iso: string | null, ahora = Date.now()) =>
  iso ? Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000)) : 0;

/** Fecha de hoy en Venezuela, AAAA-MM-DD */
export const hoyVE = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

export const ESTADO_TEXTO: Record<EstadoPedido, string> = {
  por_aprobar: 'Por confirmar',
  nuevo: 'Recibido en cocina',
  preparando: 'Preparando',
  listo: 'Listo',
  servido: 'Servido',
  en_ruta: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const METODO_TEXTO: Record<MetodoPago, string> = {
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  efectivo_usd: 'Efectivo $',
  efectivo_bs: 'Efectivo Bs.',
  punto: 'Punto de venta',
};

export const ALERGENOS = ['gluten', 'lácteos', 'huevo', 'frutos secos', 'maní', 'pescado', 'mariscos', 'soya', 'sésamo'];

export function mensajeError(e: unknown): string {
  const m = (e as { message?: string })?.message || String(e);
  if (m.includes('Failed to fetch')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  return m.replace(/^.*?ERROR:\s*/, '');
}
