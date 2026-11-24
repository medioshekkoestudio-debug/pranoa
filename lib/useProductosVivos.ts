'use client';
import { useEffect, useState } from 'react';
import { supabaseNavegador } from './supabase/cliente';
import type { Producto } from './tipos';

/**
 * Mantiene la carta al día para el público: si cocina apaga un plato agotado,
 * desaparece del menú del cliente en segundos (consulta cada 20 s y al volver a la pestaña).
 */
export function useProductosVivos(iniciales: Producto[]) {
  const [productos, setProductos] = useState(iniciales);
  useEffect(() => {
    const sb = supabaseNavegador();
    let vivo = true;
    const cargar = async () => {
      const { data } = await sb.from('productos_publicos').select('*').order('orden');
      if (vivo && data) setProductos(data as Producto[]);
    };
    const t = setInterval(cargar, 20000);
    const vis = () => document.visibilityState === 'visible' && cargar();
    document.addEventListener('visibilitychange', vis);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return productos;
}
