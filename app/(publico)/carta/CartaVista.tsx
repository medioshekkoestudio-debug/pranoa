'use client';
import { CartaInteractiva } from '@/components/CartaInteractiva';
import { useProductosVivos } from '@/lib/useProductosVivos';
import type { Categoria, Producto } from '@/lib/tipos';

export function CartaVista({ categorias, productosIniciales, tasa }: { categorias: Categoria[]; productosIniciales: Producto[]; tasa: number }) {
  const productos = useProductosVivos(productosIniciales);
  return <CartaInteractiva categorias={categorias} productos={productos} tasa={tasa} />;
}
