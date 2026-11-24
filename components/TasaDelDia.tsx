'use client';
import { useEffect, useState } from 'react';
import { rpc } from '@/lib/acciones';
import { bs } from '@/lib/formato';

export function TasaDelDia({ tasa, actualizada, fuente, onCambio }: { tasa: number; actualizada: string | null; fuente: string | null; onCambio: () => void }) {
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { setValor(tasa ? String(tasa) : ''); }, [tasa]);

  const vieja = !actualizada || new Date(actualizada).toDateString() !== new Date().toDateString();

  async function guardar(v: number, f: string) {
    setOcupado(true);
    const { error } = await rpc('fijar_tasa', { p_valor: v, p_fuente: f });
    setOcupado(false);
    setMsg(error || 'Tasa guardada.');
    if (!error) onCambio();
  }

  async function traerBcv() {
    setOcupado(true);
    setMsg('');
    const r = await fetch('/api/tasa-bcv');
    const d = await r.json();
    setOcupado(false);
    if (d.error) { setMsg(d.error); return; }
    setValor(String(d.valor));
    setMsg(`BCV: ${bs(d.valor)}. Revisa y toca Guardar.`);
  }

  return (
    <div className={`tarjeta ${vieja ? 'ring-2 ring-naranja' : ''}`}>
      <div className="flex items-baseline justify-between">
        <p className="font-bold">Tasa del día</p>
        <p className="text-xs text-taupe">
          {actualizada ? `${new Date(actualizada).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })} · ${fuente || ''}` : 'Sin fijar'}
        </p>
      </div>
      <p className="mt-1 text-3xl font-bold">{bs(tasa)} <span className="text-base font-normal text-taupe">por $</span></p>
      {vieja && <p className="mt-1 text-sm font-semibold text-naranja-oscuro">La tasa no es de hoy: actualízala.</p>}
      <div className="mt-3 flex gap-2">
        <input className="campo" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(',', '.'))} aria-label="Nueva tasa" />
        <button className="btn-primario" disabled={ocupado || !(Number(valor) > 0)} onClick={() => guardar(Number(valor), msg.startsWith('BCV') ? 'BCV' : 'manual')}>Guardar</button>
      </div>
      <button className="btn-chico mt-2 bg-crema" disabled={ocupado} onClick={traerBcv}>Traer tasa oficial BCV</button>
      {msg && <p className="mt-2 text-sm text-taupe">{msg}</p>}
    </div>
  );
}
