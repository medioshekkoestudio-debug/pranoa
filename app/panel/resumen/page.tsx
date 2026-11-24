'use client';
import { useCallback, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { useTiempoReal } from '@/lib/tiempoReal';
import { METODO_TEXTO, bs, hoyVE, usd } from '@/lib/formato';
import type { MetodoPago } from '@/lib/tipos';

interface Resumen {
  ventas_usd: number; pedidos: number; pedidos_mesa: number; pedidos_delivery: number; cancelados: number; cobrado_usd: number;
  por_metodo: Record<string, { usd: number; bs: number; n: number }>;
  top_platos: { nombre: string; cantidad: number; usd: number }[];
  por_dia: { dia: string; usd: number; n: number }[];
  tiempo_cocina_min: number | null;
}

const RANGOS = [
  { t: 'Hoy', dias: 0 },
  { t: '7 días', dias: 6 },
  { t: '30 días', dias: 29 },
];

function restarDias(fecha: string, d: number) {
  const x = new Date(fecha + 'T12:00:00');
  x.setDate(x.getDate() - d);
  return x.toISOString().slice(0, 10);
}

export default function PaginaResumen() {
  const [rango, setRango] = useState(0);
  const [r, setR] = useState<Resumen | null>(null);
  const [vivo, setVivo] = useState({ mesas: 0, cocina: 0, delivery: 0 });

  const cargar = useCallback(async () => {
    const sb = supabaseNavegador();
    const hasta = hoyVE();
    const desde = restarDias(hasta, RANGOS[rango].dias);
    const cnt = async (q: PromiseLike<{ count: number | null }>) => (await q).count || 0;
    const [res, mesas, cocina, delivery] = await Promise.all([
      sb.rpc('resumen_ventas', { p_desde: desde, p_hasta: hasta }),
      cnt(sb.from('cuentas').select('id', { count: 'exact', head: true }).eq('abierta', true)),
      cnt(sb.from('pedidos').select('id', { count: 'exact', head: true }).in('estado', ['nuevo', 'preparando'])),
      cnt(sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('tipo', 'delivery').in('estado', ['por_aprobar', 'nuevo', 'preparando', 'listo', 'en_ruta'])),
    ]);
    setR(res.data as Resumen);
    setVivo({ mesas, cocina, delivery });
  }, [rango]);

  useTiempoReal(['pedidos', 'pagos', 'cuentas'], cargar, 60000);

  const ticket = r && r.pedidos ? r.ventas_usd / r.pedidos : 0;
  const maxDia = Math.max(1, ...(r?.por_dia || []).map((d) => Number(d.usd)));

  return (
    <>
      <CabeceraPanel titulo="Resumen" />
      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {[['Mesas ocupadas', vivo.mesas], ['En cocina', vivo.cocina], ['Deliveries activos', vivo.delivery]].map(([t, n]) => (
            <div key={t as string} className="rounded-2xl bg-oliva p-3 text-white">
              <p className="text-xs opacity-80">{t}</p>
              <p className="text-2xl font-bold">{n}</p>
            </div>
          ))}
        </div>

        <div className="flex rounded-full bg-white p-1 ring-1 ring-ciruela/10">
          {RANGOS.map((x, i) => (
            <button key={x.t} onClick={() => setRango(i)} className={`flex-1 rounded-full py-2 text-sm font-semibold ${rango === i ? 'bg-ciruela text-crema' : ''}`}>{x.t}</button>
          ))}
        </div>

        {!r ? <p className="text-taupe">Cargando…</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['Ventas', usd(r.ventas_usd)],
                ['Cobrado', usd(r.cobrado_usd)],
                ['Pedidos', `${r.pedidos}`, `${r.pedidos_mesa} sala · ${r.pedidos_delivery} delivery`],
                ['Ticket promedio', usd(ticket), r.tiempo_cocina_min != null ? `Cocina: ${r.tiempo_cocina_min} min prom.` : ''],
              ].map(([t, v, s]) => (
                <div key={t} className="tarjeta">
                  <p className="text-xs text-taupe">{t}</p>
                  <p className="text-2xl font-bold">{v}</p>
                  {s && <p className="text-xs text-taupe">{s}</p>}
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="tarjeta">
                <h2 className="mb-3 font-bold">Platos que más salen</h2>
                {r.top_platos.length === 0 && <p className="text-sm text-taupe">Sin ventas en el periodo.</p>}
                {r.top_platos.map((p, i) => (
                  <div key={p.nombre} className="flex justify-between border-t border-ciruela/10 py-1.5 text-sm first:border-0">
                    <span><b className="mr-2 text-taupe">{i + 1}</b>{p.nombre}</span>
                    <span>{p.cantidad} · {usd(p.usd)}</span>
                  </div>
                ))}
              </section>

              <section className="tarjeta">
                <h2 className="mb-3 font-bold">Cobros por método</h2>
                {(Object.keys(METODO_TEXTO) as MetodoPago[]).map((m) => {
                  const v = r.por_metodo[m];
                  const pct = r.cobrado_usd ? ((v?.usd || 0) / r.cobrado_usd) * 100 : 0;
                  return (
                    <div key={m} className="py-1.5 text-sm">
                      <div className="flex justify-between"><span>{METODO_TEXTO[m]}</span><span>{usd(v?.usd || 0)}{v?.bs ? ` · ${bs(v.bs)}` : ''}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-crema"><div className="h-2 rounded-full bg-naranja" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
                {r.cancelados > 0 && <p className="mt-2 text-xs text-red-600">{r.cancelados} pedido(s) cancelado(s)</p>}
              </section>
            </div>

            {r.por_dia.length > 1 && (
              <section className="tarjeta">
                <h2 className="mb-3 font-bold">Ventas por día</h2>
                <div className="flex h-40 items-end gap-1">
                  {r.por_dia.map((d) => (
                    <div key={d.dia} className="group flex flex-1 flex-col items-center justify-end" title={`${d.dia}: ${usd(d.usd)} (${d.n} pedidos)`}>
                      <div className="w-full rounded-t bg-oliva transition group-hover:bg-naranja" style={{ height: `${(Number(d.usd) / maxDia) * 100}%` }} />
                      <span className="mt-1 text-[0.6rem] text-taupe">{d.dia.slice(8)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
