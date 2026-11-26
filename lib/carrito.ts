'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ItemCarrito, Producto } from './tipos';

function leer(clave: string): ItemCarrito[] {
  try {
    return JSON.parse(localStorage.getItem(clave) || '[]');
  } catch {
    return [];
  }
}

/** Carrito guardado en el teléfono. `clave` separa el de delivery del de cada mesa. */
export function useCarrito(clave: string, persistir = true, iniciales?: ItemCarrito[]) {
  const [items, setItems] = useState<ItemCarrito[]>(iniciales || []);

  useEffect(() => {
    if (persistir) setItems(leer(clave));
  }, [clave, persistir]);

  const guardar = useCallback((nuevos: ItemCarrito[]) => {
    setItems(nuevos);
    if (persistir) {
      try { localStorage.setItem(clave, JSON.stringify(nuevos)); } catch { /* modo privado */ }
    }
  }, [clave, persistir]);

  const agregar = (p: Producto, comensal = 1) => {
    const i = items.findIndex((x) => x.producto_id === p.id && (x.comensal || 1) === comensal && !x.notas);
    if (i >= 0) {
      const copia = [...items];
      copia[i] = { ...copia[i], cantidad: Math.min(50, copia[i].cantidad + 1) };
      guardar(copia);
    } else {
      guardar([...items, { producto_id: p.id, nombre: p.nombre, precio_usd: Number(p.precio_usd), cantidad: 1, comensal }]);
    }
  };

  /** Resta 1 unidad de un producto (prioriza el comensal activo; si no hay en ese comensal, resta del último coincidente). */
  const quitar = (productoId: string, comensal?: number) => {
    let idx = -1;
    if (comensal !== undefined) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].producto_id === productoId && (items[i].comensal || 1) === comensal) {
          idx = i;
          break;
        }
      }
    }
    if (idx < 0) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].producto_id === productoId) {
          idx = i;
          break;
        }
      }
    }
    if (idx < 0) return;
    const copia = [...items];
    const nuevaCant = copia[idx].cantidad - 1;
    if (nuevaCant <= 0) copia.splice(idx, 1);
    else copia[idx] = { ...copia[idx], cantidad: nuevaCant };
    guardar(copia);
  };

  const cambiar = (indice: number, cambios: Partial<ItemCarrito>) => {
    const copia = [...items];
    copia[indice] = { ...copia[indice], ...cambios };
    guardar(copia.filter((x) => x.cantidad > 0));
  };

  const cantidadDe = (productoId: string) =>
    items.filter((x) => x.producto_id === productoId).reduce((s, x) => s + x.cantidad, 0);

  const total = items.reduce((s, x) => s + x.precio_usd * x.cantidad, 0);
  const unidades = items.reduce((s, x) => s + x.cantidad, 0);

  return { items, agregar, quitar, cambiar, cargar: guardar, vaciar: () => guardar([]), cantidadDe, total, unidades };
}

export const paraEnviar = (items: ItemCarrito[]) =>
  items.map((x) => ({ producto_id: x.producto_id, cantidad: x.cantidad, notas: x.notas || null, comensal: x.comensal || 1 }));
