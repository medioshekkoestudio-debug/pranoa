import { supabaseServidor } from './supabase/servidor';
import { sincronizarTasaBcvSiFalta } from './tasaBcv';
import type { Ajustes, Categoria, Producto, Zona } from './tipos';

export async function cargarAjustes(): Promise<Ajustes> {
  const { data } = await supabaseServidor().from('ajustes').select('*').eq('id', 1).single();
  const aj = data as Ajustes;
  if (aj && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const res = await sincronizarTasaBcvSiFalta(false, aj);
      if (res.ajustes) return res.ajustes;
    } catch {
      // mantener tasa actual si falla la red
    }
  }
  return aj;
}

/** Carta pública (sin costos), ordenada */
export async function cargarCarta() {
  const sb = supabaseServidor();
  const [cats, prods, ajustes] = await Promise.all([
    sb.from('categorias').select('id, nombre, orden, activa').eq('activa', true).order('orden'),
    sb.from('productos_publicos').select('*').order('orden'),
    cargarAjustes(),
  ]);
  return {
    categorias: (cats.data || []) as Categoria[],
    productos: (prods.data || []) as Producto[],
    ajustes,
  };
}

export async function cargarZonas(): Promise<Zona[]> {
  const { data } = await supabaseServidor().from('zonas_delivery').select('*').eq('activa', true).order('orden');
  return (data || []) as Zona[];
}

export const enlaceWhatsapp = (numero: string | null, texto = '') =>
  numero ? `https://wa.me/${numero.replace(/\D/g, '')}${texto ? `?text=${encodeURIComponent(texto)}` : ''}` : null;
