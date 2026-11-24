'use client';
import { supabaseNavegador } from './supabase/cliente';
import { mensajeError } from './formato';
import type { EstadoPedido } from './tipos';

/** Llama a una función de la base y devuelve el error en español (o null si salió bien) */
export async function rpc(nombre: string, args: Record<string, unknown>): Promise<{ data: unknown; error: string | null }> {
  const { data, error } = await supabaseNavegador().rpc(nombre, args);
  return { data, error: error ? mensajeError(error) : null };
}

export const cambiarEstado = (id: string, estado: EstadoPedido) =>
  rpc('cambiar_estado_pedido', { p_pedido: id, p_estado: estado });

/** Ejecuta y avisa con alert si falla (para botones rápidos) */
export async function hacer(promesa: Promise<{ error: string | null }>) {
  const { error } = await promesa;
  if (error) alert(error);
  return !error;
}
