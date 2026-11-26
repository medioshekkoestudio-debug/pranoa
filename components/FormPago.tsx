'use client';
import { useEffect, useState } from 'react';
import { rpc } from '@/lib/acciones';
import { METODO_TEXTO, aBs, bs, usd } from '@/lib/formato';
import type { MetodoPago } from '@/lib/tipos';

/** Registrar un pago en caja (Pago Móvil, Zelle, efectivo $ / Bs., punto) */
export function FormPago({ cuentaId, pedidoId, sugerido, tasa, comensales = [], onListo }: {
  cuentaId?: string; pedidoId?: string; sugerido: number; tasa: number; comensales?: { n: number; pendiente: number }[];
  onListo: () => void;
}) {
  const [metodo, setMetodo] = useState<MetodoPago>('pago_movil');
  const [comensal, setComensal] = useState<number | ''>('');
  const [montoUsd, setMontoUsd] = useState(sugerido.toFixed(2));
  const [montoBs, setMontoBs] = useState('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enBs = metodo === 'pago_movil' || metodo === 'efectivo_bs' || metodo === 'punto';

  // El monto se rellena solo al cambiar de puesto o cuando cambia lo que falta por cobrar.
  // (Antes dependía de la lista `comensales`, que es nueva en cada recarga de la mesa: cada 30 s
  // o con cualquier cambio en vivo borraba lo que la caja estaba escribiendo.)
  const pendientePuesto = comensal === '' ? null : comensales.find((x) => x.n === comensal)?.pendiente ?? null;
  useEffect(() => {
    setMontoUsd((pendientePuesto ?? sugerido).toFixed(2));
  }, [comensal, pendientePuesto, sugerido]);
  useEffect(() => { if (enBs && tasa > 0) setMontoBs(aBs(Number(montoUsd) || 0, tasa).toFixed(2)); }, [montoUsd, tasa, enBs]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    // si se cobró en bolívares, el equivalente en dólares sale de lo recibido en Bs.
    const usdFinal = enBs && tasa > 0 && Number(montoBs) > 0 ? Number(montoBs) / tasa : Number(montoUsd);
    const { error } = await rpc('registrar_pago', {
      p_cuenta: cuentaId || null, p_pedido: pedidoId || null, p_metodo: metodo,
      p_monto_usd: Math.round(usdFinal * 100) / 100, p_monto_bs: enBs ? Number(montoBs) || null : null,
      p_referencia: referencia || null, p_comensal: comensal === '' ? null : comensal,
    });
    setEnviando(false);
    if (error) { setError(error); return; }
    setReferencia('');
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {(Object.keys(METODO_TEXTO) as MetodoPago[]).map((m) => (
          <button type="button" key={m} onClick={() => setMetodo(m)}
            className={`rounded-xl border px-2 py-2 text-xs font-semibold ${metodo === m ? 'border-oliva bg-oliva text-white' : 'border-ciruela/15 bg-white'}`}>
            {METODO_TEXTO[m]}
          </button>
        ))}
      </div>
      {comensales.length > 1 && (
        <select className="campo" value={comensal} onChange={(e) => setComensal(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Toda la mesa</option>
          {comensales.map((c) => <option key={c.n} value={c.n}>Puesto {c.n} · falta {usd(c.pendiente)}</option>)}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="etiqueta">Monto $</label>
          <input className="campo" inputMode="decimal" value={montoUsd} onChange={(e) => setMontoUsd(e.target.value.replace(',', '.'))} />
        </div>
        {enBs && (
          <div>
            <label className="etiqueta">Recibido Bs.</label>
            <input className="campo" inputMode="decimal" value={montoBs} onChange={(e) => setMontoBs(e.target.value.replace(',', '.'))} />
          </div>
        )}
      </div>
      {(metodo === 'pago_movil' || metodo === 'zelle' || metodo === 'punto') && (
        <div>
          <label className="etiqueta">Referencia {metodo === 'punto' && '(opcional)'}</label>
          <input className="campo" value={referencia} onChange={(e) => setReferencia(e.target.value)} required={metodo !== 'punto'} minLength={metodo !== 'punto' ? 4 : 0} />
        </div>
      )}
      {tasa > 0 && <p className="text-xs text-taupe">Tasa del día: {bs(tasa)} por $</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primario w-full" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar pago'}</button>
    </form>
  );
}
