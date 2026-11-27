'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { TasaDelDia } from '@/components/TasaDelDia';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { useTiempoReal } from '@/lib/tiempoReal';
import { hacer, rpc } from '@/lib/acciones';
import { METODO_TEXTO, bs, hora, minutosDesde, usd } from '@/lib/formato';
import type { Ajustes, Cuenta, Llamada, MetodoPago, Pago, Pedido } from '@/lib/tipos';

export default function Caja() {
  const [aj, setAj] = useState<Ajustes | null>(null);
  const [cuentas, setCuentas] = useState<(Cuenta & { mesas: { numero: number; nombre?: string } })[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pagosCuentas, setPagosCuentas] = useState<Pago[]>([]);
  const [porVerificar, setPorVerificar] = useState<(Pago & { pedidos: { numero: number; cliente_nombre: string } | null })[]>([]);
  const [hoy, setHoy] = useState<Pago[]>([]);
  const [llamadas, setLlamadas] = useState<Llamada[]>([]);

  const cargar = useCallback(async () => {
    const sb = supabaseNavegador();
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const [a, c, v, h, l] = await Promise.all([
      sb.from('ajustes').select('*').eq('id', 1).single(),
      sb.from('cuentas').select('*, mesas(numero, nombre)').eq('abierta', true).order('abierta_at'),
      sb.from('pagos').select('*, pedidos(numero, cliente_nombre)').eq('verificado', false).order('created_at'),
      sb.from('pagos').select('*').eq('verificado', true).gte('created_at', inicio.toISOString()).order('created_at', { ascending: false }),
      sb.from('llamadas').select('*').eq('atendida', false).eq('tipo', 'cuenta'),
    ]);
    setAj(a.data as Ajustes);
    const cs = (c.data || []) as (Cuenta & { mesas: { numero: number; nombre?: string } })[];
    setCuentas(cs);
    setPorVerificar((v.data || []) as never);
    setHoy((h.data || []) as Pago[]);
    setLlamadas((l.data || []) as Llamada[]);
    const ids = cs.map((x) => x.id);
    if (ids.length) {
      const [p, pg] = await Promise.all([
        sb.from('pedidos').select('id, cuenta_id, subtotal_usd, estado').in('cuenta_id', ids).neq('estado', 'cancelado'),
        sb.from('pagos').select('cuenta_id, monto_usd, verificado').in('cuenta_id', ids),
      ]);
      setPedidos((p.data || []) as Pedido[]);
      setPagosCuentas((pg.data || []) as Pago[]);
    } else { setPedidos([]); setPagosCuentas([]); }
  }, []);

  useTiempoReal(['pagos', 'cuentas', 'pedidos', 'llamadas', 'ajustes'], cargar, 30000);

  const totalCuenta = (id: string) => pedidos.filter((p) => p.cuenta_id === id).reduce((s, p) => s + Number(p.subtotal_usd), 0);
  const pagadoCuenta = (id: string) => pagosCuentas.filter((p) => p.cuenta_id === id && p.verificado).reduce((s, p) => s + Number(p.monto_usd), 0);
  const porMetodo = hoy.reduce<Record<string, { usd: number; bs: number }>>((acc, p) => {
    acc[p.metodo] = acc[p.metodo] || { usd: 0, bs: 0 };
    acc[p.metodo].usd += Number(p.monto_usd);
    acc[p.metodo].bs += Number(p.monto_bs || 0);
    return acc;
  }, {});
  const solicitudesFactura = cuentas.filter((c) => c.factura_estado === 'solicitada');

  return (
    <>
      <CabeceraPanel titulo="Caja" />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 lg:grid-cols-2">
        <div className="space-y-4">
          {aj && <TasaDelDia tasa={Number(aj.tasa_bs)} actualizada={aj.tasa_actualizada} fuente={aj.tasa_fuente} onCambio={cargar} />}

          {/* Solicitudes de factura enviadas por mesoneros */}
          <section className={`tarjeta ${solicitudesFactura.length > 0 ? 'ring-2 ring-red-400' : ''}`}>
            <h2 className="mb-2 font-bold">Solicitudes de factura ({solicitudesFactura.length})</h2>
            {solicitudesFactura.length === 0 && <p className="text-sm text-taupe">Sin solicitudes pendientes.</p>}
            {solicitudesFactura.map((c) => {
              const t = totalCuenta(c.id);
              const tasaActual = Number(aj?.tasa_bs || 0);
              return (
                <div key={c.id} className="border-t border-ciruela/10 py-3 first:border-0">
                  <div className="flex items-baseline justify-between">
                    <p className="font-bold text-red-700">
                      🧾 Mesa {c.mesas?.nombre || c.mesas?.numero}
                      {c.factura_solicitada_at && (
                        <span className="ml-2 text-xs font-normal text-taupe">hace {minutosDesde(c.factura_solicitada_at)} min</span>
                      )}
                    </p>
                    <div className="text-right">
                      <p className="font-bold">{usd(t)}</p>
                      {tasaActual > 0 && <p className="text-xs text-taupe">{bs(Math.round(t * tasaActual * 100) / 100)}</p>}
                    </div>
                  </div>
                  {(c.cliente_nombre || c.cliente_cedula || c.cliente_telefono || c.cliente_correo) && (
                    <div className="mt-1.5 rounded-xl bg-crema/70 p-2 text-xs text-ciruela space-y-0.5">
                      {c.cliente_nombre && <p><b>Cliente:</b> {c.cliente_nombre}</p>}
                      {c.cliente_cedula && <p><b>Cédula / RIF:</b> {c.cliente_cedula}</p>}
                      {c.cliente_telefono && <p><b>Teléfono:</b> {c.cliente_telefono}</p>}
                      {c.cliente_correo && <p><b>Correo:</b> {c.cliente_correo}</p>}
                    </div>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-chico flex-1 bg-indigo-600 py-2 text-white hover:bg-indigo-700"
                      onClick={() => hacer(rpc('marcar_factura_lista', { p_cuenta: c.id })).then(cargar)}
                    >
                      ✓ Factura lista (avisar mesonero)
                    </button>
                    <Link href={`/panel/mesas/${c.mesa_id}`} className="btn-chico bg-crema py-2">
                      Ver / Cobrar
                    </Link>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="tarjeta">
            <h2 className="mb-2 font-bold">Pagos por verificar ({porVerificar.length})</h2>
            {porVerificar.length === 0 && <p className="text-sm text-taupe">Nada pendiente.</p>}
            {porVerificar.map((p) => (
              <div key={p.id} className="border-t border-ciruela/10 py-2 first:border-0">
                <p className="font-semibold">{METODO_TEXTO[p.metodo]} · ref <span className="font-mono">{p.referencia}</span></p>
                <p className="text-sm text-taupe">
                  {p.pedidos ? `Delivery #${p.pedidos.numero} · ${p.pedidos.cliente_nombre}` : 'Mesa'} · {usd(p.monto_usd)}{p.monto_bs ? ` · ${bs(p.monto_bs)}` : ''} · {hora(p.created_at)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button className="btn-chico bg-oliva text-white" onClick={() => hacer(rpc('verificar_pago', { p_pago: p.id, p_ok: true }))}>Llegó el pago</button>
                  <button className="btn-peligro py-1" onClick={() => confirm('¿Descartar este pago? (no llegó o la referencia es falsa)') && hacer(rpc('verificar_pago', { p_pago: p.id, p_ok: false }))}>No llegó</button>
                </div>
              </div>
            ))}
          </section>
        </div>

        <div className="space-y-4">
          <section className="tarjeta">
            <h2 className="mb-2 font-bold">Mesas abiertas ({cuentas.length})</h2>
            {cuentas.length === 0 && <p className="text-sm text-taupe">No hay mesas ocupadas.</p>}
            {cuentas.map((c) => {
              const t = totalCuenta(c.id);
              const pg = pagadoCuenta(c.id);
              const pide = llamadas.some((l) => l.mesa_id === c.mesa_id);
              return (
                <Link key={c.id} href={`/panel/mesas/${c.mesa_id}`}
                  className={`flex items-center justify-between border-t border-ciruela/10 py-2.5 first:border-0 ${pide ? 'font-semibold text-red-600' : ''}`}>
                  <span>Mesa {c.mesas?.nombre || c.mesas?.numero} {pide && '· pide la cuenta'} <span className="text-xs font-normal text-taupe">· {minutosDesde(c.abierta_at)} min</span></span>
                  <span className="text-right">{usd(t)}{pg > 0 && <span className="block text-xs text-emerald-700">pagado {usd(pg)}</span>}</span>
                </Link>
              );
            })}
          </section>

          <section className="tarjeta">
            <h2 className="mb-2 font-bold">Cobrado hoy</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(METODO_TEXTO) as MetodoPago[]).map((m) => (
                <div key={m} className="rounded-xl bg-crema/70 p-2">
                  <p className="text-xs text-taupe">{METODO_TEXTO[m]}</p>
                  <p className="font-bold">{usd(porMetodo[m]?.usd || 0)}</p>
                  {(porMetodo[m]?.bs || 0) > 0 && <p className="text-xs">{bs(porMetodo[m].bs)}</p>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-right font-bold">Total: {usd(hoy.reduce((s, p) => s + Number(p.monto_usd), 0))}</p>
          </section>
        </div>
      </main>
    </>
  );
}
