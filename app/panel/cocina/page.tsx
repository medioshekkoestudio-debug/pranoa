'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { notificar, sonar, useTiempoReal } from '@/lib/tiempoReal';
import { cambiarEstado, hacer, rpc } from '@/lib/acciones';
import { hora, minutosDesde } from '@/lib/formato';
import type { EstadoPedido, Mesa, Pedido, PedidoItem, SubestadoItem } from '@/lib/tipos';

const COLUMNAS: { estado: EstadoPedido; titulo: string; siguiente: EstadoPedido; accion: string; atras?: EstadoPedido }[] = [
  { estado: 'nuevo', titulo: 'Por preparar', siguiente: 'preparando', accion: 'Empezar' },
  { estado: 'preparando', titulo: 'En preparación', siguiente: 'listo', accion: '¡Listo!', atras: 'nuevo' },
  { estado: 'listo', titulo: 'Listos para retirar', siguiente: 'servido', accion: 'Todo entregado', atras: 'preparando' },
];

const SUBESTADO_ESTILO: Record<SubestadoItem, { etiqueta: string; clase: string; siguiente: SubestadoItem }> = {
  preparando: { etiqueta: 'Preparando', clase: 'bg-red-600 text-white hover:bg-red-700', siguiente: 'retirar' },
  retirar:    { etiqueta: 'Retirar',    clase: 'bg-amber-400 text-white hover:bg-amber-500', siguiente: 'entregado' },
  entregado:  { etiqueta: 'Entregado',  clase: 'bg-emerald-600 text-white hover:bg-emerald-700', siguiente: 'preparando' },
};

function tiempoObjetivo(p: Pedido, alertaDefecto: number): number {
  const tiempos = (p.pedido_items || [])
    .filter((i) => (i.estado || 'preparando') === 'preparando' && Number(i.tiempo_prep_min) > 0)
    .map((i) => Number(i.tiempo_prep_min));
  if (tiempos.length > 0) return Math.max(...tiempos);
  const todos = (p.pedido_items || []).map((i) => Number(i.tiempo_prep_min)).filter((n) => n > 0);
  if (todos.length > 0) return Math.max(...todos);
  return alertaDefecto;
}

export default function Cocina() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mesas, setMesas] = useState<Record<string, string>>({});
  const [alerta, setAlerta] = useState(15);
  const [ahora, setAhora] = useState(Date.now());
  const [columna, setColumna] = useState(0);
  const [verCampana, setVerCampana] = useState(false);
  const alertadosRef = useRef<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    const sb = supabaseNavegador();
    const desde = new Date(Date.now() - 12 * 3600e3).toISOString();
    const [pedidosRes, mesasRes, ajRes] = await Promise.all([
      sb
        .from('pedidos')
        .select('*, pedido_items(*)')
        .in('estado', ['nuevo', 'preparando', 'listo'])
        .gte('created_at', desde)
        .order('aprobado_at', { ascending: true }),
      sb.from('mesas').select('id, nombre, numero'),
      sb.from('ajustes').select('alerta_minutos').eq('id', 1).single(),
    ]);
    setPedidos((pedidosRes.data || []) as Pedido[]);
    setMesas(Object.fromEntries(((mesasRes.data || []) as Mesa[]).map((x) => [x.id, x.nombre || String(x.numero)])));
    setAlerta(ajRes.data?.alerta_minutos || 15);
  }, []);

  useTiempoReal(['pedidos', 'pedido_items'], cargar, 20000);
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  // Calcular pedidos atrasados respecto a su tiempo estimado de preparación
  const atrasados = useMemo(() => {
    return pedidos.filter((p) => {
      if (p.estado === 'listo') return false;
      const objetivo = tiempoObjetivo(p, alerta);
      const base = p.estado === 'preparando' ? (p.iniciado_at || p.aprobado_at || p.created_at) : (p.aprobado_at || p.created_at);
      return minutosDesde(base, ahora) >= objetivo;
    });
  }, [pedidos, alerta, ahora]);

  // Emitir sonido y notificación cuando un pedido supera su tiempo estimado de preparación
  useEffect(() => {
    for (const p of atrasados) {
      if (!alertadosRef.current.has(p.id)) {
        alertadosRef.current.add(p.id);
        const etiqueta = p.tipo === 'delivery' ? `Delivery #${p.numero}` : `Mesa ${mesas[p.mesa_id || ''] ?? '?'}`;
        sonar('llamada');
        notificar('⏰ Pedido atrasado en cocina', `${etiqueta} superó el tiempo estimado de preparación`, '/panel/cocina');
      }
    }
    // Limpiar IDs que ya salieron de atrasados
    const actuales = new Set(atrasados.map((p) => p.id));
    alertadosRef.current.forEach((id) => {
      if (!actuales.has(id)) alertadosRef.current.delete(id);
    });
  }, [atrasados, mesas]);

  async function avanzarSubestado(item: PedidoItem) {
    const actual: SubestadoItem = item.estado || 'preparando';
    const siguiente = SUBESTADO_ESTILO[actual].siguiente;
    const ok = await hacer(rpc('cambiar_estado_item', { p_item: item.id, p_estado: siguiente }));
    if (ok) cargar();
  }

  return (
    <>
      <CabeceraPanel titulo="Cocina" oscuro>
        {/* Campana de alertas de tiempo excedido */}
        <button
          type="button"
          onClick={() => setVerCampana((v) => !v)}
          className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
            atrasados.length > 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-white/10 text-crema hover:bg-white/20'
          }`}
          aria-label={`Alertas de cocina: ${atrasados.length}`}
          title="Alertas de tiempo de preparación"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {atrasados.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[0.65rem] font-extrabold text-ciruela">
              {atrasados.length}
            </span>
          )}
        </button>
        <span className="hidden text-xs opacity-75 sm:inline">
          {new Date(ahora).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })}
        </span>
      </CabeceraPanel>

      {/* Panel desplegable de campana de alertas */}
      {verCampana && (
        <div className="mx-3 mt-3 rounded-2xl border border-red-500/40 bg-red-950/80 p-3 text-sm text-crema shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold text-red-200">🔔 Alertas de tiempo ({atrasados.length})</span>
            <button type="button" className="text-xs text-crema/70 hover:text-white" onClick={() => setVerCampana(false)}>Cerrar</button>
          </div>
          {atrasados.length === 0 ? (
            <p className="text-xs text-crema/70">Todos los pedidos están dentro de su tiempo estimado de preparación.</p>
          ) : (
            <ul className="space-y-1.5">
              {atrasados.map((p) => {
                const obj = tiempoObjetivo(p, alerta);
                const trans = minutosDesde(p.iniciado_at || p.aprobado_at || p.created_at, ahora);
                const etq = p.tipo === 'delivery' ? `DELIVERY #${p.numero}` : `MESA ${mesas[p.mesa_id || ''] ?? '?'}`;
                return (
                  <li key={p.id} className="flex items-center justify-between rounded-xl bg-red-900/60 px-3 py-2">
                    <span className="font-semibold">⚠️ {etq} · Recibido {hora(p.aprobado_at || p.created_at)}</span>
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                      ⏱ {trans} min (est. {obj} min)
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Selector de columna en pantallas pequeñas */}
      <div className="flex gap-1 px-3 pt-3 lg:hidden">
        {COLUMNAS.map((c, i) => (
          <button
            key={c.estado}
            onClick={() => setColumna(i)}
            className={`flex-1 rounded-full py-2 text-xs font-semibold ${columna === i ? 'bg-naranja text-white' : 'bg-white/10 text-crema'}`}
          >
            {c.titulo.split(' ')[0]} ({pedidos.filter((p) => p.estado === c.estado).length})
          </button>
        ))}
      </div>

      {/* Leyenda rápida de subestados */}
      <div className="flex flex-wrap items-center gap-2 px-3 pt-3 text-xs text-crema/80">
        <span>Toca el estado de cada plato:</span>
        <span className="rounded-md bg-red-600 px-2 py-0.5 font-semibold text-white">Preparando</span>
        <span>→</span>
        <span className="rounded-md bg-amber-400 px-2 py-0.5 font-semibold text-white">Retirar</span>
        <span>→</span>
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-semibold text-white">Entregado</span>
      </div>

      <main className="grid gap-3 p-3 lg:grid-cols-3">
        {COLUMNAS.map((col, i) => {
          const lista = pedidos.filter((p) => p.estado === col.estado);
          return (
            <section key={col.estado} className={`${columna === i ? 'block' : 'hidden'} lg:block`}>
              <h2 className="mb-2 hidden text-sm font-bold uppercase tracking-wider text-crema/75 lg:block">
                {col.titulo} <span className="ml-1 rounded-full bg-white/10 px-2">{lista.length}</span>
              </h2>
              <div className="space-y-3">
                {lista.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-crema/50">
                    Nada por aquí
                  </p>
                )}
                {lista.map((p) => {
                  const desde = col.estado === 'nuevo' ? p.aprobado_at || p.created_at : col.estado === 'preparando' ? p.iniciado_at : p.listo_at;
                  const total = minutosDesde(p.aprobado_at || p.created_at, ahora);
                  const enEtapa = desde ? minutosDesde(desde, ahora) : 0;
                  const objetivo = tiempoObjetivo(p, alerta);
                  const tarde = col.estado !== 'listo' && (col.estado === 'preparando' ? enEtapa >= objetivo : total >= objetivo);
                  const delivery = p.tipo === 'delivery';
                  const mostrarSubestados = col.estado === 'preparando' || col.estado === 'listo';

                  return (
                    <article
                      key={p.id}
                      className={`overflow-hidden rounded-2xl shadow transition ${
                        tarde
                          ? 'bg-red-50 text-ciruela ring-4 ring-red-600'
                          : 'bg-white text-ciruela'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between px-4 py-2.5 text-white ${
                          tarde ? 'bg-red-600' : delivery ? 'bg-naranja' : 'bg-oliva'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-bold">
                            {delivery ? `DELIVERY #${p.numero}` : `MESA ${mesas[p.mesa_id || ''] ?? '?'}`}
                          </span>
                          {p.editado_at && (
                            <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[0.65rem] font-extrabold uppercase text-ciruela">
                              Editado
                            </span>
                          )}
                          {tarde && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-red-700">
                              ⏱ ⚠️ Atrasado
                            </span>
                          )}
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${tarde ? 'bg-red-900/60' : 'bg-black/20'}`}>
                          {total} min
                        </span>
                      </div>

                      <div className="px-4 py-3">
                        <ul className="space-y-2">
                          {p.pedido_items?.map((it) => {
                            const sub: SubestadoItem = it.estado || (col.estado === 'listo' ? 'retirar' : 'preparando');
                            const estilo = SUBESTADO_ESTILO[sub];
                            return (
                              <li key={it.id} className="flex items-start gap-2.5 text-base leading-snug">
                                {mostrarSubestados && (
                                  <button
                                    type="button"
                                    onClick={() => avanzarSubestado(it)}
                                    className={`mt-0.5 w-24 shrink-0 rounded-md px-2 py-1 text-center text-xs font-bold shadow-sm transition active:scale-95 ${estilo.clase}`}
                                    title="Toca para avanzar: Preparando → Retirar → Entregado"
                                  >
                                    {estilo.etiqueta}
                                  </button>
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className={sub === 'entregado' ? 'line-through opacity-55' : ''}>
                                    <b className="mr-1">{it.cantidad}×</b>
                                    {it.nombre}
                                  </span>
                                  {it.tiempo_prep_min && (
                                    <span className="ml-1.5 text-xs text-taupe">({it.tiempo_prep_min}m)</span>
                                  )}
                                  {it.notas && (
                                    <span className="block text-sm font-semibold text-naranja-oscuro">↳ {it.notas}</span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                        {p.notas && <p className="mt-2.5 rounded-lg bg-crema px-2.5 py-1.5 text-sm">📝 {p.notas}</p>}

                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 text-xs text-taupe">
                          <span>
                            Recibido {hora(p.aprobado_at || p.created_at)}
                            {desde && col.estado !== 'nuevo' ? ` · en esta etapa ${enEtapa} min` : ''}
                          </span>
                          <span className={tarde ? 'font-bold text-red-700' : ''}>
                            Est. {objetivo} min
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          {col.atras && (
                            <button
                              type="button"
                              className="btn-chico bg-crema px-3 py-3 text-ciruela"
                              onClick={() => hacer(cambiarEstado(p.id, col.atras!)).then(cargar)}
                              aria-label="Regresar"
                            >
                              ↩
                            </button>
                          )}
                          {col.estado === 'nuevo' && (
                            <button
                              type="button"
                              className="btn-chico flex-1 bg-naranja py-3 text-base text-white"
                              onClick={() => hacer(cambiarEstado(p.id, 'preparando')).then(cargar)}
                            >
                              Empezar
                            </button>
                          )}
                          {col.estado === 'preparando' && (
                            <button
                              type="button"
                              className="btn-chico flex-1 bg-emerald-600 py-3 text-base text-white"
                              onClick={() => hacer(cambiarEstado(p.id, 'listo')).then(cargar)}
                            >
                              ¡Listo!
                            </button>
                          )}
                          {col.estado === 'listo' && (
                            delivery ? (
                              <span className="flex-1 py-2 text-center text-sm text-taupe">Esperando motorizado</span>
                            ) : (
                              <button
                                type="button"
                                className="btn-chico flex-1 bg-oliva py-2.5 text-sm text-white"
                                onClick={() => hacer(cambiarEstado(p.id, 'servido')).then(cargar)}
                              >
                                ✓ Entregado al mesonero
                              </button>
                            )
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
