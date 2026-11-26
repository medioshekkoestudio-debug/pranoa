'use client';
import { useCallback, useEffect, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { useTiempoReal } from '@/lib/tiempoReal';
import { cambiarEstado, hacer } from '@/lib/acciones';
import { hora, minutosDesde } from '@/lib/formato';
import type { EstadoPedido, Mesa, Pedido } from '@/lib/tipos';

const COLUMNAS: { estado: EstadoPedido; titulo: string; siguiente: EstadoPedido; accion: string; atras?: EstadoPedido }[] = [
  { estado: 'nuevo', titulo: 'Por preparar', siguiente: 'preparando', accion: 'Empezar' },
  { estado: 'preparando', titulo: 'En preparación', siguiente: 'listo', accion: '¡Listo!', atras: 'nuevo' },
  { estado: 'listo', titulo: 'Listos para servir / despachar', siguiente: 'listo', accion: '', atras: 'preparando' },
];

export default function Cocina() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mesas, setMesas] = useState<Record<string, string>>({});
  const [alerta, setAlerta] = useState(15);
  const [ahora, setAhora] = useState(Date.now());
  const [columna, setColumna] = useState(0); // en teléfono se ve una columna a la vez

  const cargar = useCallback(async () => {
    const sb = supabaseNavegador();
    const desde = new Date(Date.now() - 12 * 3600e3).toISOString();
    const [pedidos, mesas, a] = await Promise.all([
      sb.from('pedidos').select('*, pedido_items(*)').in('estado', ['nuevo', 'preparando', 'listo']).gte('created_at', desde).order('aprobado_at', { ascending: true }),
      sb.from('mesas').select('id, nombre, numero'),
      sb.from('ajustes').select('alerta_minutos').eq('id', 1).single(),
    ]);
    setPedidos((pedidos.data || []) as Pedido[]);
    setMesas(Object.fromEntries(((mesas.data || []) as Mesa[]).map((x) => [x.id, x.nombre || String(x.numero)])));
    setAlerta(a.data?.alerta_minutos || 15);
  }, []);

  useTiempoReal(['pedidos', 'pedido_items'], cargar, 30000);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 15000); return () => clearInterval(t); }, []);

  return (
    <>
      <CabeceraPanel titulo="Cocina" oscuro>
        <span className="text-sm opacity-70">{new Date(ahora).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })}</span>
      </CabeceraPanel>

      {/* selector de columna en pantallas pequeñas */}
      <div className="flex gap-1 px-3 pt-3 lg:hidden">
        {COLUMNAS.map((c, i) => (
          <button key={c.estado} onClick={() => setColumna(i)}
            className={`flex-1 rounded-full py-2 text-xs font-semibold ${columna === i ? 'bg-naranja text-white' : 'bg-white/10'}`}>
            {c.titulo.split(' ')[0]} ({pedidos.filter((p) => p.estado === c.estado).length})
          </button>
        ))}
      </div>

      <main className="grid gap-3 p-3 lg:grid-cols-3">
        {COLUMNAS.map((col, i) => {
          const lista = pedidos.filter((p) => p.estado === col.estado);
          return (
            <section key={col.estado} className={`${columna === i ? 'block' : 'hidden'} lg:block`}>
              <h2 className="mb-2 hidden text-sm font-bold uppercase tracking-wider text-crema/70 lg:block">
                {col.titulo} <span className="ml-1 rounded-full bg-white/10 px-2">{lista.length}</span>
              </h2>
              <div className="space-y-3">
                {lista.length === 0 && <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-crema/50">Nada por aquí</p>}
                {lista.map((p) => {
                  const desde = col.estado === 'nuevo' ? p.aprobado_at || p.created_at : col.estado === 'preparando' ? p.iniciado_at : p.listo_at;
                  const total = minutosDesde(p.aprobado_at || p.created_at, ahora);
                  const tarde = col.estado !== 'listo' && total >= alerta;
                  const delivery = p.tipo === 'delivery';
                  return (
                    <article key={p.id}
                      className={`overflow-hidden rounded-2xl bg-white text-ciruela shadow ${tarde ? 'ring-4 ring-red-500 animate-[pulse_2s_ease-in-out_infinite]' : ''}`}>
                      <div className={`flex items-center justify-between px-4 py-2 text-white ${delivery ? 'bg-naranja' : 'bg-oliva'}`}>
                        <span className="flex items-center gap-2 text-lg font-bold">
                          {delivery ? `DELIVERY #${p.numero}` : `MESA ${mesas[p.mesa_id || ''] ?? '?'}`}
                          {p.editado_at && (
                            <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[0.65rem] font-extrabold uppercase text-ciruela">
                              Editado
                            </span>
                          )}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-sm font-bold ${tarde ? 'bg-red-600' : 'bg-black/20'}`}>
                          {total} min
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <ul className="space-y-1">
                          {p.pedido_items?.map((it) => (
                            <li key={it.id} className="text-lg leading-snug">
                              <b className="mr-1">{it.cantidad}×</b>{it.nombre}
                              {it.notas && <span className="block text-sm font-semibold text-naranja-oscuro">↳ {it.notas}</span>}
                            </li>
                          ))}
                        </ul>
                        {p.notas && <p className="mt-2 rounded-lg bg-crema px-2 py-1 text-sm">📝 {p.notas}</p>}
                        <p className="mt-2 text-xs text-taupe">
                          Entró {hora(p.aprobado_at || p.created_at)}{desde && col.estado !== 'nuevo' ? ` · en esta etapa ${minutosDesde(desde, ahora)} min` : ''}
                        </p>
                        <div className="mt-3 flex gap-2">
                          {col.atras && (
                            <button className="btn-chico bg-crema px-3 py-3" onClick={() => hacer(cambiarEstado(p.id, col.atras!))} aria-label="Regresar">↩</button>
                          )}
                          {col.accion && (
                            <button className={`btn-chico flex-1 py-3 text-base text-white ${col.estado === 'nuevo' ? 'bg-naranja' : 'bg-emerald-600'}`}
                              onClick={() => hacer(cambiarEstado(p.id, col.siguiente))}>
                              {col.accion}
                            </button>
                          )}
                          {col.estado === 'listo' && (
                            <span className="flex-1 py-2 text-center text-sm text-taupe">
                              {delivery ? 'Esperando motorizado' : 'Esperando al mesonero'}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
