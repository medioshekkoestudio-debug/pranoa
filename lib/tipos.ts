import type { Rol } from './permisos';

export type EstadoPedido =
  | 'por_aprobar' | 'nuevo' | 'preparando' | 'listo' | 'servido' | 'en_ruta' | 'entregado' | 'cancelado';
export type MetodoPago = 'pago_movil' | 'zelle' | 'efectivo_usd' | 'efectivo_bs' | 'punto';

export interface Perfil { id: string; nombre: string; rol: Rol; telefono: string | null; activo: boolean }
export interface Ajustes {
  nombre: string; lema: string; direccion: string | null; mapa_url: string | null; whatsapp: string | null;
  instagram: string | null; horario: string | null; tasa_bs: number; tasa_fuente: string | null;
  tasa_actualizada: string | null; qr_requiere_aprobacion: boolean; delivery_activo: boolean;
  pago_movil_datos: string | null; zelle_datos: string | null; alerta_minutos: number;
}
export interface Categoria { id: string; nombre: string; orden: number; activa: boolean }
export interface Producto {
  id: string; categoria_id: string | null; nombre: string; descripcion: string | null; precio_usd: number;
  costo_usd?: number | null; foto_url: string | null; alergenos: string[]; disponible: boolean;
  activo?: boolean; solo_salon: boolean; orden: number;
}
export interface Mesa { id: string; numero: number; ambiente: 'salon' | 'terraza'; capacidad: number; token: string; activa: boolean }
export interface Cuenta { id: string; mesa_id: string; abierta: boolean; mesonero_id: string | null; abierta_at: string }
export interface Zona { id: string; nombre: string; tarifa_usd: number; activa: boolean; orden: number }
export interface PedidoItem {
  id: string; pedido_id: string; producto_id: string | null; nombre: string; precio_usd: number;
  cantidad: number; notas: string | null; comensal: number;
}
export interface Pedido {
  id: string; numero: number; tipo: 'mesa' | 'delivery'; estado: EstadoPedido; origen: 'qr' | 'web' | 'personal';
  mesa_id: string | null; cuenta_id: string | null; cliente_nombre: string | null; cliente_telefono: string | null;
  direccion: string | null; zona_id: string | null; costo_envio_usd: number; subtotal_usd: number; notas: string | null;
  mesonero_id: string | null; motorizado_id: string | null; token_publico: string; created_at: string;
  aprobado_at: string | null; iniciado_at: string | null; listo_at: string | null; cerrado_at: string | null;
  pedido_items?: PedidoItem[];
}
export interface Pago {
  id: string; cuenta_id: string | null; pedido_id: string | null; metodo: MetodoPago; monto_usd: number;
  monto_bs: number | null; tasa: number | null; referencia: string | null; comensal: number | null;
  verificado: boolean; origen: 'personal' | 'web'; created_at: string;
}
export interface Llamada { id: string; mesa_id: string; tipo: 'mesonero' | 'cuenta'; atendida: boolean; created_at: string }
export interface Reserva {
  id: string; nombre: string; telefono: string; fecha: string; hora: string; personas: number;
  ambiente: 'salon' | 'terraza'; notas: string | null;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'completada'; created_at: string;
}
export interface ItemCarrito {
  producto_id: string; nombre: string; precio_usd: number; cantidad: number; notas?: string; comensal?: number;
}
