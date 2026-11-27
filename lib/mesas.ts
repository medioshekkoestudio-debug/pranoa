import type { Cuenta, Llamada, Pedido } from './tipos';

export type EstadoMesa = 'libre' | 'esperando' | 'preparando' | 'listo' | 'comiendo' | 'cuenta' | 'factura_lista';

/** Colores tipo semáforo para cada estado de mesa:
 *  🟢 Libre · 🟡 Esperando pedido · 🟠 En cocina · 🔵 Listo para servir · 🫒 Comiendo · 🔴 Pide cuenta/factura · 🟣 Factura lista
 */
export const ESTILO_MESA: Record<EstadoMesa, { fondo: string; texto: string; nombre: string }> = {
  libre:         { fondo: 'bg-emerald-500', texto: 'text-white',   nombre: 'Libre' },
  esperando:     { fondo: 'bg-amber-400',   texto: 'text-ciruela', nombre: 'Esperando' },
  preparando:    { fondo: 'bg-naranja',     texto: 'text-white',   nombre: 'En cocina' },
  listo:         { fondo: 'bg-sky-500',     texto: 'text-white',   nombre: 'Listo para servir' },
  comiendo:      { fondo: 'bg-oliva',       texto: 'text-white',   nombre: 'Comiendo' },
  cuenta:        { fondo: 'bg-red-500',     texto: 'text-white',   nombre: 'Pidió cuenta' },
  factura_lista: { fondo: 'bg-indigo-600',  texto: 'text-white',   nombre: 'Factura lista' },
};

export function estadoMesa(mesaId: string, cuentas: Cuenta[], pedidos: Pedido[], llamadas: Llamada[]): EstadoMesa {
  const cuenta = cuentas.find((c) => c.mesa_id === mesaId && c.abierta);
  if (cuenta?.factura_estado === 'lista') return 'factura_lista';
  if (cuenta?.factura_estado === 'solicitada' || llamadas.some((l) => l.mesa_id === mesaId && l.tipo === 'cuenta' && !l.atendida)) return 'cuenta';
  if (!cuenta) return 'libre';
  const suyos = pedidos.filter((p) => p.cuenta_id === cuenta.id && p.estado !== 'cancelado');
  if (!suyos.length) return 'esperando';
  if (suyos.some((p) => p.estado === 'listo' || (p.pedido_items || []).some((i) => i.estado === 'retirar'))) return 'listo';
  if (suyos.some((p) => p.estado === 'preparando')) return 'preparando';
  if (suyos.some((p) => ['por_aprobar', 'nuevo'].includes(p.estado))) return 'esperando';
  return 'comiendo';
}
