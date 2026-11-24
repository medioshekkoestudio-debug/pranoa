'use client';
import { useCallback, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { Hoja } from '@/components/Hoja';
import { FormPago } from '@/components/FormPago';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { useTiempoReal } from '@/lib/tiempoReal';
import { cambiarEstado, hacer, rpc } from '@/lib/acciones';
import { ESTADO_TEXTO, METODO_TEXTO, hora, minutosDesde, usd } from '@/lib/formato';
import type { EstadoPedido, Pago, Pedido, Perfil, Zona } from '@/lib/tipos';

const GRUPOS: { titulo: string; estados: EstadoPedido[] }[] = [
  { titulo: 'Por confirmar', estados: ['por_aprobar'] },
  { titulo: 'En cocina', estados: ['nuevo', 'preparando'] },
  { titulo: 'Listos para despachar', estados: ['listo'] },
  { titulo: 'En ruta', estados: ['en_ruta'] },
];

export default function ControlDelivery() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [motos, setMotos] = useState<Perfil[]>([]);
  const [zonas, setZonas] = useState<Record<string, string>>({});
  const [tasa, setTasa] = useState(0);
  const [cobrar, setCobrar] = useState<Pedido | null>(null);
  const [verHoy, setVerHoy] = useState(false);
  const [cerrados, setCerrados] = useState<Pedido[]>([]);

  const cargar = useCallback(async () => {
    const sb = supabaseNavegador();
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const [p, m, z, a, h] = await Promise.all([
      sb.from('pedidos').select('*, pedido_items(*)').eq('tipo', 'delivery').in('estado', ['por_aprobar', 'nuevo', 'preparando', 'listo', 'en_ruta']).order('created_at'),
      sb.from('perfiles').select('*').eq('rol', 'motorizado').eq('activo', true).order('nombre'),
      sb.from('zonas_delivery').select('id, nombre'),
      sb.from('ajustes').select('tasa_bs').eq('id', 1).single(),
      sb.from('pedidos').select('*').eq('tipo', 'delivery').in('estado', ['entregado', 'cancelado']).gte('created_at', inicio.toISOString()).order('created_at', { ascending: false }),
    ]);
    const ps = (p.data || []) as Pedido[];
    setPedidos(ps);
    setMotos((m.data || []) as Perfil[]);
    setZonas(Object.fromEntries(((z.data || []) as Zona[]).map((x) => [x.id, x.nombre])));
    setTasa(Number(a.data?.tasa_bs || 0));
    setCerrados((h.data || []) as Pedido[]);
    const ids = ps.map((x) => x.id);
    const pg = ids.length ? await sb.from('pagos').select('*').in('pedido_id', ids) : { data: [] };
    setPagos((pg.data || []) as Pago[]);
  }, []);

  useTiempoReal(['pedidos', 'pagos'], cargar, 30000);

  const pagosDe = (id: string) => pagos.filter((p) => p.pedido_id === id);
  const pagado = (id: string) => pagosDe(id).filter((p) => p.verificado).reduce((s, p) => s + Number(p.monto_usd), 0);

  return (
    <>
      <CabeceraPanel titulo="Delivery">
        <button className="btn-chico bg-white ring-1 ring-ciruela/10" onClick={() => setVerHoy(!verHoy)}>{verHoy ? 'Activos' : 'Cerrados hoy'}</button>
      </CabeceraPanel>
      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-4">
        {verHoy ? (
          <section className="tarjeta">
            {cerrados.length === 0 && <p className="text-taupe">Ninguno todavía.</p>}
            {cerrados.map((p) => (
              <div key={p.id} className="flex justify-between border-t border-ciruela/10 py-2 text-sm first:border-0">
                <span>#{p.numero} · {p.cliente_nombre} · {hora(p.created_at)}</span>
                <span>{ESTADO_TEXTO[p.estado]} · {usd(Number(p.subtotal_usd) + Number(p.costo_envio_usd))}</span>
              </div>
            ))}
          </section>
        ) : GRUPOS.map((g) => {
          const lista = pedidos.filter((p) => g.estados.includes(p.estado));
          return (
            <section key={g.titulo}>
              <h2 className="mb-2 font-bold">{g.titulo} <span className="text-taupe">({lista.length})</span></h2>
              {lista.length === 0 && <p className="text-sm text-taupe">—</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {lista.map((p) => {
                  const total = Number(p.subtotal_usd) + Number(p.costo_envio_usd);
                  const pg = pagado(p.id);
                  const reportado = pagosDe(p.id).find((x) => !x.verificado);
                  return (
                    <article key={p.id} className="tarjeta">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold">#{p.numero} · {p.cliente_nombre}</p>
                          <p className="text-sm text-taupe">{zonas[p.zona_id || '']} · {hora(p.created_at)} ({minutosDesde(p.created_at)} min)</p>
                        </div>
                        <span className="chip bg-naranja/15 text-naranja-oscuro">{ESTADO_TEXTO[p.estado]}</span>
                      </div>
                      <p className="mt-2 text-sm">{p.direccion}</p>
                      <p className="text-sm">
                        <a className="font-semibold text-oliva" href={`tel:${p.cliente_telefono}`}>{p.cliente_telefono}</a>
                        {' · '}
                        <a className="font-semibold text-oliva" target="_blank" rel="noreferrer" href={`https://wa.me/${(p.cliente_telefono || '').replace(/\D/g, '').replace(/^0/, '58')}`}>WhatsApp</a>
                      </p>
                      <ul className="mt-2 text-sm text-taupe">
                        {p.pedido_items?.map((i) => <li key={i.id}>{i.cantidad} × {i.nombre}{i.notas ? ` (${i.notas})` : ''}</li>)}
                      </ul>
                      {p.notas && <p className="mt-1 text-sm">Nota: {p.notas}</p>}
                      <div className="mt-2 flex justify-between rounded-xl bg-crema/70 px-3 py-2 text-sm">
                        <span>Total {usd(total)}</span>
                        <span className={pg + 0.009 >= total ? 'font-semibold text-emerald-700' : 'text-red-600'}>
                          {pg + 0.009 >= total ? 'Pagado' : `Pagado ${usd(pg)}`}
                        </span>
                      </div>
                      {reportado && (
                        <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-sm">
                          Reportó {METODO_TEXTO[reportado.metodo]} · ref <b className="font-mono">{reportado.referencia}</b> · {usd(reportado.monto_usd)}
                          <div className="mt-1.5 flex gap-2">
                            <button className="btn-chico bg-oliva text-white" onClick={() => hacer(rpc('verificar_pago', { p_pago: reportado.id, p_ok: true }))}>Llegó</button>
                            <button className="btn-peligro py-1" onClick={() => confirm('¿Descartar el pago reportado?') && hacer(rpc('verificar_pago', { p_pago: reportado.id, p_ok: false }))}>No llegó</button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {p.estado === 'por_aprobar' && (
                          <button className="btn-chico bg-oliva py-2 text-white" onClick={() => hacer(cambiarEstado(p.id, 'nuevo'))}>Confirmar y enviar a cocina</button>
                        )}
                        {['listo', 'nuevo', 'preparando', 'por_aprobar'].includes(p.estado) && (
                          <select className="rounded-full border border-ciruela/15 bg-white px-3 py-1.5 text-sm" value={p.motorizado_id || ''}
                            onChange={(e) => hacer(rpc('asignar_motorizado', { p_pedido: p.id, p_motorizado: e.target.value || null }))}>
                            <option value="">Motorizado…</option>
                            {motos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                          </select>
                        )}
                        {p.estado === 'listo' && (
                          <button className="btn-chico bg-naranja py-2 text-white" disabled={!p.motorizado_id} onClick={() => hacer(cambiarEstado(p.id, 'en_ruta'))}>Despachar</button>
                        )}
                        {p.estado === 'en_ruta' && (
                          <button className="btn-chico bg-emerald-600 py-2 text-white" onClick={() => hacer(cambiarEstado(p.id, 'entregado'))}>Entregado</button>
                        )}
                        {pg + 0.009 < total && <button className="btn-chico bg-crema" onClick={() => setCobrar(p)}>Registrar pago</button>}
                        <button className="btn-peligro py-1" onClick={() => confirm('¿Cancelar este pedido?') && hacer(cambiarEstado(p.id, 'cancelado'))}>Cancelar</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <Hoja abierta={!!cobrar} onCerrar={() => setCobrar(null)} titulo={`Pago delivery #${cobrar?.numero ?? ''}`}>
        {cobrar && (
          <FormPago pedidoId={cobrar.id} tasa={tasa}
            sugerido={Math.max(0, Number(cobrar.subtotal_usd) + Number(cobrar.costo_envio_usd) - pagado(cobrar.id))}
            onListo={() => { setCobrar(null); cargar(); }} />
        )}
      </Hoja>
    </>
  );
}
