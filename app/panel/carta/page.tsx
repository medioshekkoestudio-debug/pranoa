'use client';
import { useCallback, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { Hoja } from '@/components/Hoja';
import { usePerfil } from '../MarcoPanel';
import { EditorProducto, EditorCategorias } from './Editores';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { useTiempoReal } from '@/lib/tiempoReal';
import { hacer, rpc } from '@/lib/acciones';
import { usd } from '@/lib/formato';
import type { Categoria, Producto } from '@/lib/tipos';

export default function GestorCarta() {
  const perfil = usePerfil();
  const esAdmin = perfil.rol === 'admin';
  const [cats, setCats] = useState<Categoria[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null);
  const [verCats, setVerCats] = useState(false);
  const [filtro, setFiltro] = useState('');

  const cargar = useCallback(async () => {
    const sb = supabaseNavegador();
    // el admin ve costos; el resto usa la vista sin costos
    const [c, p] = await Promise.all([
      sb.from('categorias').select('*').order('orden'),
      esAdmin ? sb.from('productos').select('*').order('orden') : sb.from('productos_publicos').select('*').order('orden'),
    ]);
    setCats((c.data || []) as Categoria[]);
    setProds((p.data || []) as Producto[]);
  }, [esAdmin]);

  useTiempoReal(['productos'], cargar, 60000);

  const agotados = prods.filter((p) => !p.disponible && p.activo !== false).length;
  const visibles = prods.filter((p) => !filtro || p.nombre.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <>
      <CabeceraPanel titulo="Carta">
        {esAdmin && <button className="btn-chico bg-oliva text-white" onClick={() => setEditando('nuevo')}>+ Plato</button>}
      </CabeceraPanel>
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <p className="text-sm text-taupe">
          Apaga un plato cuando se agote: desaparece de la carta de los clientes al momento. {agotados > 0 && <b className="text-red-600">{agotados} agotado(s).</b>}
        </p>
        <div className="flex gap-2">
          <input className="campo py-2" placeholder="Buscar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          {esAdmin && <button className="btn-chico shrink-0 bg-white ring-1 ring-ciruela/10" onClick={() => setVerCats(true)}>Categorías</button>}
        </div>

        {[...cats, { id: '', nombre: 'Sin categoría', orden: 999, activa: true }].map((c) => {
          const lista = visibles.filter((p) => (p.categoria_id || '') === c.id);
          if (!lista.length) return null;
          return (
            <section key={c.id || 'sin'}>
              <h2 className="mb-2 font-bold">{c.nombre}{!c.activa && <span className="ml-2 text-xs text-taupe">(oculta)</span>}</h2>
              <div className="tarjeta divide-y divide-ciruela/10 p-0">
                {lista.map((p) => {
                  const margen = esAdmin && p.costo_usd ? Math.round((1 - Number(p.costo_usd) / Number(p.precio_usd)) * 100) : null;
                  return (
                    <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${p.activo === false ? 'opacity-50' : ''}`}>
                      <button className="min-w-0 flex-1 text-left" disabled={!esAdmin} onClick={() => setEditando(p)}>
                        <p className="truncate font-semibold">{p.nombre}{p.activo === false && ' (fuera de carta)'}</p>
                        <p className="text-sm text-taupe">
                          {usd(p.precio_usd)}
                          {margen !== null && <span className={margen < 60 ? 'text-red-600' : ''}> · costo {usd(p.costo_usd!)} · margen {margen}%</span>}
                        </p>
                      </button>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <span className={p.disponible ? 'text-emerald-700' : 'font-semibold text-red-600'}>{p.disponible ? 'Disponible' : 'Agotado'}</span>
                        <input type="checkbox" className="peer sr-only" checked={p.disponible}
                          onChange={(e) => hacer(rpc('cambiar_disponibilidad', { p_producto: p.id, p_disponible: e.target.checked })).then(cargar)} />
                        <span className="relative h-7 w-12 rounded-full bg-red-400 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-emerald-500 peer-checked:after:translate-x-5" />
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      {esAdmin && (
        <>
          <Hoja abierta={!!editando} onCerrar={() => setEditando(null)} titulo={editando === 'nuevo' ? 'Nuevo plato' : 'Editar plato'}>
            {editando && <EditorProducto producto={editando === 'nuevo' ? null : editando} categorias={cats} onListo={() => { setEditando(null); cargar(); }} />}
          </Hoja>
          <Hoja abierta={verCats} onCerrar={() => setVerCats(false)} titulo="Categorías">
            <EditorCategorias categorias={cats} onCambio={cargar} />
          </Hoja>
        </>
      )}
    </>
  );
}
