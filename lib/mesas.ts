import type { Cuenta, Llamada, Pedido } from './tipos';

export type EstadoMesa = 'libre' | 'esperando' | 'comiendo' | 'cuenta';

// Colores de la propuesta: Libre verde, Esperando amarillo, Comiendo azul, Cuenta rojo
export const ESTILO_MESA: Record<EstadoMesa, { fondo: string; texto: string; nombre: string }> = {
  libre: { fondo: 'bg-emerald-500', texto: 'text-white', nombre: 'Libre' },
  esperando: { fondo: 'bg-amber-400', texto: 'text-ciruela', nombre: 'Esperando' },
  comiendo: { fondo: 'bg-sky-500', texto: 'text-white', nombre: 'Comiendo' },
  cuenta: { fondo: 'bg-red-500', texto: 'text-white', nombre: 'Pidió la cuenta' },
};

export function estadoMesa(mesaId: string, cuentas: Cuenta[], pedidos: Pedido[], llamadas: Llamada[]): EstadoMesa {
  const cuenta = cuentas.find((c) => c.mesa_id === mesaId && c.abierta);
  if (llamadas.some((l) => l.mesa_id === mesaId && l.tipo === 'cuenta' && !l.atendida)) return 'cuenta';
  if (!cuenta) return 'libre';
  const suyos = pedidos.filter((p) => p.cuenta_id === cuenta.id && p.estado !== 'cancelado');
  if (!suyos.length || suyos.some((p) => ['por_aprobar', 'nuevo', 'preparando', 'listo'].includes(p.estado))) return 'esperando';
  return 'comiendo';
}
