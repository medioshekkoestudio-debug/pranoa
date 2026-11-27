'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { useTiempoReal } from '@/lib/tiempoReal';
import { ESTILO_MESA, estadoMesa, type EstadoMesa } from '@/lib/mesas';
import { cambiarEstado, hacer, rpc } from '@/lib/acciones';
import { minutosDesde } from '@/lib/formato';
import type { Cuenta, Llamada, Mesa, Pedido } from '@/lib/tipos';

export default function Mesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [llamadas, setLlamadas] = useState<Llamada[]>([]);
  const [cargado, setCargado] = useState(false);
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const cargar = useCallback(async () => {
    const sb = supabaseNavegador();
    const [m, c, l] = await Promise.all([
      sb.from('mesas').select('*').eq('activa', true).order('numero'),
      sb.from('cuentas').select('*').eq('abierta', true),
      sb.from('llamadas').select('*').eq('atendida', false).order('created_at'),
    ]);
    const ids = (c.data || []).map((x) => x.id);
    const p = ids.length
      ? await sb.from('pedidos').select('*, pedido_items(*)').in('cuenta_id', ids).order('created_at')
      : { data: [] };
    setMesas(((m.data || []) as Mesa[]).sort((a, b) => (a.nombre || String(a.numero)).localeCompare(b.nombre || String(b.numero), 'es', { numeric: true })));
    setCuentas((c.data || []) as Cuenta[]);
    setLlamadas((l.data || []) as Llamada[]);
    setPedidos((p.data || []) as Pedido[]);
    setCargado(true);
  }, []);

  useTiempoReal(['pedidos', 'pedido_items', 'llamadas', 'cuentas'], cargar, 30000);

  const numeroMesa = (id: string | null) => {
    const m = mesas.find((x) => x.id === id);
    return m ? (m.nombre || String(m.numero)) : '?';
  };
  const porAprobar = pedidos.filter((p) => p.estado === 'por_aprobar');
  const listos = pedidos.filter((p) => p.estado === 'listo');
  // Platos individuales marcados como "Retirar" en cocina aunque el resto del pedido siga preparándose
  const platosRetirar = pedidos
    .filter((p) => p.estado === 'preparando')
    .flatMap((p) => (p.pedido_items || []).filter((i) => i.estado === 'retirar').map((i) => ({ ...i, mesa_id: p.mesa_id, pedido_num: p.numero })));
  const facturasListas = cuentas.filter((c) => c.factura_estado === 'lista');
  const conteo = (e: EstadoMesa) => mesas.filter((m) => estadoMesa(m.id, cuentas, pedidos, llamadas) === e).length;

  return (
    <>
      <CabeceraPanel titulo="Mesas" />
      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-4">
        {/* Facturas listas en caja para que el mesonero las retire */}
        {facturasListas.length > 0 && (
          <section className="space-y-2">
            {facturasListas.map((c) => (
              <Link
                key={c.id}
                href={`/panel/mesas/${c.mesa_id}`}
                className="flex items-center gap-3 rounded-2xl bg-indigo-600 p-3 text-white shadow-sm transition hover:bg-indigo-700"
              >
                <span className="text-2xl">🧾</span>
                <p className="flex-1 font-semibold">
                  Mesa {numeroMesa(c.mesa_id)} · ¡Factura lista en caja! Pasa a buscarla
                  {c.cliente_nombre ? <span className="ml-2 text-sm font-normal opacity-90">({c.cliente_nombre})</span> : null}
                </p>
                <span className="btn-chico bg-white text-indigo-700">Ver mesa →</span>
              </Link>
            ))}
          </section>
        )}
        {/* lo urgente arriba */}
        {llamadas.length > 0 && (
          <section className="space-y-2">
            {llamadas.map((l) => (
              <div key={l.id} className={`flex items-center gap-3 rounded-2xl p-3 text-white ${l.tipo === 'cuenta' ? 'bg-red-500' : 'bg-naranja'}`}>
                <span className="text-2xl">{l.tipo === 'cuenta' ? '🧾' : '🔔'}</span>
                <p className="flex-1 font-semibold">
                  Mesa {numeroMesa(l.mesa_id)} {l.tipo === 'cuenta' ? 'pide la cuenta' : 'llama al mesonero'}
                  <span className="ml-2 text-sm font-normal opacity-80">hace {minutosDesde(l.created_at, ahora)} min</span>
                  {l.nota && <span className="mt-0.5 block text-sm font-normal text-white/95">💬 «{l.nota}»</span>}
                </p>
                <button className="btn-chico bg-white text-ciruela" onClick={() => hacer(rpc('atender_llamada', { p_llamada: l.id }))}>Atendida</button>
              </div>
            ))}
          </section>
        )}

        {porAprobar.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Pedidos del QR por confirmar</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {porAprobar.map((p) => (
                <div key={p.id} className="tarjeta border-l-4 border-amber-400">
                  <p className="font-semibold">Mesa {numeroMesa(p.mesa_id)} · #{p.numero}</p>
                  <ul className="mt-1 text-sm">
                    {p.pedido_items?.map((i) => <li key={i.id}>{i.cantidad} × {i.nombre}{i.notas ? <span className="text-taupe"> — {i.notas}</span> : null}</li>)}
                  </ul>
                  {p.notas && <p className="mt-1 text-sm text-taupe">Nota: {p.notas}</p>}
                  <div className="mt-3 flex gap-2">
                    <button className="btn-chico flex-1 bg-oliva py-2 text-white" onClick={() => hacer(cambiarEstado(p.id, 'nuevo'))}>Confirmar y enviar a cocina</button>
                    <button className="btn-peligro" onClick={() => confirm('¿Rechazar este pedido?') && hacer(cambiarEstado(p.id, 'cancelado'))}>Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {platosRetirar.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Platos listos para retirar en cocina</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {platosRetirar.map((it) => (
                <div key={it.id} className="tarjeta flex items-center gap-3 border-l-4 border-amber-400">
                  <div className="flex-1">
                    <p className="font-semibold">Mesa {numeroMesa(it.mesa_id)} · #{it.pedido_num}</p>
                    <p className="text-sm">{it.cantidad} × {it.nombre}</p>
                  </div>
                  <button
                    className="btn-chico bg-emerald-600 py-2 text-white"
                    onClick={() => hacer(rpc('cambiar_estado_item', { p_item: it.id, p_estado: 'entregado' })).then(cargar)}
                  >
                    Retirado
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {listos.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Listos para servir</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {listos.map((p) => (
                <div key={p.id} className="tarjeta flex items-center gap-3 border-l-4 border-emerald-500">
                  <div className="flex-1">
                    <p className="font-semibold">Mesa {numeroMesa(p.mesa_id)} · #{p.numero}</p>
                    <p className="text-sm text-taupe">{p.pedido_items?.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ')}</p>
                  </div>
                  <button className="btn-chico bg-oliva py-2 text-white" onClick={() => hacer(cambiarEstado(p.id, 'servido'))}>Servido</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* leyenda */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(ESTILO_MESA) as EstadoMesa[]).map((e) => (
            <span key={e} className="chip gap-1.5 bg-white py-1 ring-1 ring-ciruela/10">
              <span className={`h-2.5 w-2.5 rounded-full ${ESTILO_MESA[e].fondo}`} />
              {ESTILO_MESA[e].nombre} ({conteo(e)})
            </span>
          ))}
        </div>

        {!cargado && <p className="text-taupe">Cargando mesas…</p>}
        {cargado && mesas.length === 0 && <p className="tarjeta">No hay mesas. El administrador las crea en «Mesas y QR».</p>}

        {(['salon', 'terraza'] as const).map((amb) => {
          const lista = mesas.filter((m) => m.ambiente === amb);
          if (!lista.length) return null;
          return (
            <section key={amb}>
              <h2 className="mb-2 font-bold">{amb === 'salon' ? 'Salón principal' : 'Terraza'}</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {lista.map((m) => {
                  const e = estadoMesa(m.id, cuentas, pedidos, llamadas);
                  const cuenta = cuentas.find((c) => c.mesa_id === m.id);
                  const pedidosMesa = cuenta ? pedidos.filter((p) => p.cuenta_id === cuenta.id && p.estado !== 'cancelado') : [];
                  const total = pedidosMesa.reduce((s, p) => s + Number(p.subtotal_usd), 0);
                  const pendienteCocina = pedidosMesa.find((p) => ['por_aprobar', 'nuevo', 'preparando', 'listo'].includes(p.estado));
                  const mins = pendienteCocina ? minutosDesde(pendienteCocina.created_at, ahora) : cuenta ? minutosDesde(cuenta.abierta_at, ahora) : 0;
                  return (
                    <Link key={m.id} href={`/panel/mesas/${m.id}`}
                      className={`flex aspect-square flex-col items-center justify-center rounded-2xl p-2 text-center shadow-sm transition active:scale-95 ${ESTILO_MESA[e].fondo} ${ESTILO_MESA[e].texto}`}>
                      <span className="text-2xl font-bold sm:text-3xl">{m.nombre || m.numero}</span>
                      <span className="text-xs font-semibold">{ESTILO_MESA[e].nombre}</span>
                      <span className="text-[0.65rem] opacity-80">{m.capacidad} puestos</span>
                      {cuenta && (
                        <span className="mt-1 rounded-full bg-black/15 px-2 py-0.5 text-[0.68rem] font-semibold">
                          ${total.toFixed(2)} · ⏱ {mins} min
                        </span>
                      )}
                    </Link>
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
