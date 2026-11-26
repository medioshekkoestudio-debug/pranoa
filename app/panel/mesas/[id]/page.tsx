'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { Hoja } from '@/components/Hoja';
import { FormPago } from '@/components/FormPago';
import { TomarPedido } from '@/components/TomarPedido';
import { usePerfil } from '../../MarcoPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { useTiempoReal } from '@/lib/tiempoReal';
import { cambiarEstado, hacer, rpc } from '@/lib/acciones';
import { ESTILO_MESA, estadoMesa } from '@/lib/mesas';
import { ESTADO_TEXTO, METODO_TEXTO, aBs, bs, hora, minutosDesde, usd } from '@/lib/formato';
import type { Cuenta, Llamada, Mesa, Pago, Pedido } from '@/lib/tipos';

type Pestana = 'pedidos' | 'dividir' | 'cobrar';

export default function DetalleMesa() {
  const { id } = useParams<{ id: string }>();
  const perfil = usePerfil();
  const esCaja = perfil.rol === 'admin' || perfil.rol === 'cajero';
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [llamadas, setLlamadas] = useState<Llamada[]>([]);
  const [libres, setLibres] = useState<Mesa[]>([]);
  const [tasa, setTasa] = useState(0);
  const [pestana, setPestana] = useState<Pestana>('pedidos');
  const [hoja, setHoja] = useState<'' | 'pedido' | 'mover'>('');

  const cargar = useCallback(async () => {
    const sb = supabaseNavegador();
    const [m, c, a, l] = await Promise.all([
      sb.from('mesas').select('*').eq('id', id).single(),
      sb.from('cuentas').select('*').eq('mesa_id', id).eq('abierta', true).maybeSingle(),
      sb.from('ajustes').select('tasa_bs').eq('id', 1).single(),
      sb.from('llamadas').select('*').eq('mesa_id', id).eq('atendida', false),
    ]);
    setMesa(m.data as Mesa);
    setCuenta((c.data as Cuenta) || null);
    setTasa(Number(a.data?.tasa_bs || 0));
    setLlamadas((l.data || []) as Llamada[]);
    if (c.data) {
      const [p, pg] = await Promise.all([
        sb.from('pedidos').select('*, pedido_items(*)').eq('cuenta_id', c.data.id).order('created_at'),
        esCaja || perfil.rol === 'mesonero' ? sb.from('pagos').select('*').eq('cuenta_id', c.data.id).order('created_at') : Promise.resolve({ data: [] }),
      ]);
      setPedidos((p.data || []) as Pedido[]);
      setPagos((pg.data || []) as Pago[]);
    } else {
      setPedidos([]);
      setPagos([]);
    }
  }, [id, esCaja, perfil.rol]);

  useTiempoReal(['pedidos', 'pedido_items', 'pagos', 'cuentas', 'llamadas'], cargar, 30000);

  async function abrirMover() {
    const sb = supabaseNavegador();
    const [m, c] = await Promise.all([sb.from('mesas').select('*').eq('activa', true).order('numero'), sb.from('cuentas').select('mesa_id').eq('abierta', true)]);
    const ocupadas = new Set((c.data || []).map((x) => x.mesa_id));
    setLibres(((m.data || []) as Mesa[]).filter((x) => !ocupadas.has(x.id)));
    setHoja('mover');
  }

  if (!mesa) return <p className="p-6 text-taupe">Cargando…</p>;

  const validos = pedidos.filter((p) => p.estado !== 'cancelado');
  const items = validos.flatMap((p) => p.pedido_items || []);
  const total = validos.reduce((s, p) => s + Number(p.subtotal_usd), 0);
  const pagado = pagos.filter((p) => p.verificado).reduce((s, p) => s + Number(p.monto_usd), 0);
  const pendiente = Math.max(0, Math.round((total - pagado) * 100) / 100);
  const puestos = Array.from(new Set(items.map((i) => i.comensal))).sort((a, b) => a - b);
  const porPuesto = puestos.map((n) => {
    const sub = items.filter((i) => i.comensal === n).reduce((s, i) => s + i.precio_usd * i.cantidad, 0);
    const pag = pagos.filter((p) => p.comensal === n && p.verificado).reduce((s, p) => s + Number(p.monto_usd), 0);
    return { n, subtotal: sub, pendiente: Math.max(0, Math.round((sub - pag) * 100) / 100) };
  });
  const e = estadoMesa(mesa.id, cuenta ? [cuenta] : [], pedidos, llamadas);

  return (
    <>
      <CabeceraPanel titulo={`Mesa ${mesa.nombre || mesa.numero}`}>
        <span className={`chip py-1 ${ESTILO_MESA[e].fondo} ${ESTILO_MESA[e].texto}`}>{ESTILO_MESA[e].nombre}</span>
      </CabeceraPanel>
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <Link href="/panel/mesas" className="text-sm font-semibold text-oliva">← Todas las mesas</Link>

        {!cuenta ? (
          <div className="tarjeta text-center">
            <p className="text-lg font-semibold">Mesa libre</p>
            <p className="text-sm text-taupe">{mesa.ambiente === 'salon' ? 'Salón' : 'Terraza'} · {mesa.capacidad} puestos</p>
            <div className="mt-4 flex justify-center gap-2">
              <button className="btn-secundario" onClick={() => hacer(rpc('abrir_mesa', { p_mesa: mesa.id })).then(cargar)}>Sentar clientes</button>
              <button className="btn-primario" onClick={() => setHoja('pedido')}>Tomar pedido</button>
            </div>
          </div>
        ) : (
          <>
            <div className="tarjeta flex items-center justify-between">
              <div>
                <p className="text-sm text-taupe">Abierta hace {minutosDesde(cuenta.abierta_at)} min</p>
                <p className="text-2xl font-bold">{usd(total)}</p>
                {tasa > 0 && <p className="text-sm text-taupe">{bs(aBs(total, tasa))}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <button className="btn-primario py-2" onClick={() => setHoja('pedido')}>+ Pedido</button>
                <button className="btn-chico bg-crema" onClick={abrirMover}>Cambiar de mesa</button>
              </div>
            </div>

            <div className="flex rounded-full bg-white p-1 ring-1 ring-ciruela/10">
              {(['pedidos', 'dividir', ...(esCaja ? ['cobrar'] : [])] as Pestana[]).map((p) => (
                <button key={p} onClick={() => setPestana(p)}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold ${pestana === p ? 'bg-oliva text-white' : ''}`}>
                  {p === 'pedidos' ? 'Pedidos' : p === 'dividir' ? 'Dividir cuenta' : 'Cobrar'}
                </button>
              ))}
            </div>

            {pestana === 'pedidos' && (
              <div className="space-y-3">
                {pedidos.length === 0 && <p className="text-center text-taupe">Sin pedidos todavía.</p>}
                {pedidos.map((p) => (
                  <div key={p.id} className={`tarjeta ${p.estado === 'cancelado' ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-taupe">#{p.numero} · {hora(p.created_at)} · {p.origen === 'qr' ? 'QR' : 'Mesonero'}</span>
                      <span className="chip bg-crema">{ESTADO_TEXTO[p.estado]}</span>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {p.pedido_items?.map((i) => (
                        <li key={i.id} className="flex justify-between gap-2 text-sm">
                          <span>{i.cantidad} × {i.nombre} <span className="text-taupe">· P{i.comensal}</span>{i.notas && <span className="block text-xs text-taupe">{i.notas}</span>}</span>
                          <span>{usd(i.precio_usd * i.cantidad)}</span>
                        </li>
                      ))}
                    </ul>
                    {p.notas && <p className="mt-1 text-xs text-taupe">Nota: {p.notas}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.estado === 'por_aprobar' && <button className="btn-chico bg-oliva text-white" onClick={() => hacer(cambiarEstado(p.id, 'nuevo'))}>Confirmar y enviar a cocina</button>}
                      {p.estado === 'listo' && <button className="btn-chico bg-oliva text-white" onClick={() => hacer(cambiarEstado(p.id, 'servido'))}>Marcar servido</button>}
                      {!['cancelado', 'servido'].includes(p.estado) && (['por_aprobar', 'nuevo'].includes(p.estado) || esCaja) && (
                        <button className="btn-peligro py-1.5" onClick={() => confirm(p.estado === 'preparando' || p.estado === 'listo' ? 'Cocina ya lo preparó o lo está preparando. ¿Cancelar igual?' : '¿Cancelar este pedido?') && hacer(cambiarEstado(p.id, 'cancelado'))}>Cancelar</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pestana === 'dividir' && (
              <div className="space-y-3">
                <p className="text-sm text-taupe">Cambia el puesto de cada plato para repartir la cuenta.</p>
                {porPuesto.map((g) => (
                  <div key={g.n} className="tarjeta">
                    <div className="mb-2 flex items-baseline justify-between">
                      <p className="font-bold">Puesto {g.n}</p>
                      <p className="text-right"><b>{usd(g.subtotal)}</b>{tasa > 0 && <span className="ml-2 text-sm text-taupe">{bs(aBs(g.subtotal, tasa))}</span>}
                        {g.pendiente < g.subtotal && <span className="block text-xs text-emerald-700">{g.pendiente === 0 ? 'Pagado' : `Falta ${usd(g.pendiente)}`}</span>}
                      </p>
                    </div>
                    {items.filter((i) => i.comensal === g.n).map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                        <span className="flex-1">{i.cantidad} × {i.nombre}</span>
                        <span>{usd(i.precio_usd * i.cantidad)}</span>
                        <select className="rounded-lg border border-ciruela/15 bg-white px-2 py-1" value={i.comensal}
                          onChange={(ev) => hacer(rpc('asignar_comensal', { p_item: i.id, p_comensal: Number(ev.target.value) })).then(cargar)}>
                          {Array.from({ length: Math.max(mesa.capacidad || 6, ...puestos, 1) + 2 }, (_, k) => k + 1).map((k) => <option key={k} value={k}>P{k}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {pestana === 'cobrar' && esCaja && (
              <div className="space-y-3">
                <div className="tarjeta grid grid-cols-3 text-center">
                  <div><p className="text-xs text-taupe">Consumo</p><p className="font-bold">{usd(total)}</p></div>
                  <div><p className="text-xs text-taupe">Pagado</p><p className="font-bold text-emerald-700">{usd(pagado)}</p></div>
                  <div><p className="text-xs text-taupe">Falta</p><p className="font-bold text-red-600">{usd(pendiente)}</p>{tasa > 0 && <p className="text-xs text-taupe">{bs(aBs(pendiente, tasa))}</p>}</div>
                </div>
                {pendiente > 0 && (
                  <div className="tarjeta">
                    <FormPago cuentaId={cuenta.id} sugerido={pendiente} tasa={tasa} comensales={porPuesto} onListo={cargar} />
                  </div>
                )}
                {pagos.length > 0 && (
                  <div className="tarjeta text-sm">
                    {pagos.map((p) => (
                      <div key={p.id} className="flex justify-between py-1">
                        <span>{METODO_TEXTO[p.metodo]}{p.comensal ? ` · P${p.comensal}` : ''}{p.referencia ? ` · ref ${p.referencia}` : ''}</span>
                        <span>{usd(p.monto_usd)}{p.monto_bs ? ` (${bs(p.monto_bs)})` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-naranja w-full" disabled={pendiente > 0.009}
                  onClick={() => confirm('¿Cerrar la cuenta y liberar la mesa?') && hacer(rpc('cerrar_cuenta', { p_cuenta: cuenta.id, p_forzar: false })).then(cargar)}>
                  {pendiente > 0.009 ? `Falta cobrar ${usd(pendiente)}` : 'Cerrar cuenta y liberar mesa'}
                </button>
                {perfil.rol === 'admin' && pendiente > 0.009 && (
                  <button className="btn-peligro w-full" onClick={() => confirm('Cerrar SIN cobrar todo (cortesía o pérdida). ¿Seguro?') && hacer(rpc('cerrar_cuenta', { p_cuenta: cuenta.id, p_forzar: true })).then(cargar)}>
                    Cerrar como cortesía (solo admin)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <Hoja abierta={hoja === 'pedido'} onCerrar={() => setHoja('')} titulo={`Pedido · Mesa ${mesa.nombre || mesa.numero}`}>
        <TomarPedido mesaId={mesa.id} capacidad={mesa.capacidad} tasa={tasa} onListo={() => { setHoja(''); cargar(); }} />
      </Hoja>

      <Hoja abierta={hoja === 'mover'} onCerrar={() => setHoja('')} titulo="Mover a otra mesa">
        {libres.length === 0 ? <p className="text-taupe">No hay mesas libres.</p> : (
          <div className="grid grid-cols-4 gap-2">
            {libres.map((m) => (
              <button key={m.id} className="aspect-square rounded-xl bg-emerald-500 text-xl font-bold text-white"
                onClick={async () => {
                  if (cuenta && (await hacer(rpc('mover_cuenta', { p_cuenta: cuenta.id, p_mesa_destino: m.id })))) window.location.href = `/panel/mesas/${m.id}`;
                }}>
                {m.nombre || m.numero}
              </button>
            ))}
          </div>
        )}
      </Hoja>
    </>
  );
}
