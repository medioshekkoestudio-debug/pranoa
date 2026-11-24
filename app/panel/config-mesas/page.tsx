'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { Logo } from '@/components/Logo';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import type { Mesa } from '@/lib/tipos';

export default function ConfigMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [f, setF] = useState({ numero: '', ambiente: 'salon', capacidad: '4' });
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const { data } = await supabaseNavegador().from('mesas').select('*').order('numero');
    const lista = (data || []) as Mesa[];
    setMesas(lista);
    const base = window.location.origin;
    const pares = await Promise.all(lista.map(async (m) => [m.id, await QRCode.toDataURL(`${base}/mesa/${m.token}`, { margin: 1, width: 360, color: { dark: '#3C2525', light: '#FFFFFF' } })]));
    setQrs(Object.fromEntries(pares));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const sb = supabaseNavegador();
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error } = await sb.from('mesas').insert({ numero: Number(f.numero), ambiente: f.ambiente, capacidad: Number(f.capacidad) || 4 });
    if (error) { setError(error.message.includes('duplicate') ? 'Ya existe una mesa con ese número' : error.message); return; }
    setF({ ...f, numero: '' });
    cargar();
  }
  async function actualizar(id: string, datos: Partial<Mesa>) {
    const { error } = await sb.from('mesas').update(datos).eq('id', id);
    if (error) alert(error.message);
    cargar();
  }

  return (
    <>
      <CabeceraPanel titulo="Mesas y QR">
        <button className="btn-chico bg-oliva text-white" onClick={() => window.print()}>Imprimir QR</button>
      </CabeceraPanel>
      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-4">
        <form onSubmit={crear} className="tarjeta flex flex-wrap items-end gap-2 print:hidden">
          <div><label className="etiqueta">Número</label><input className="campo w-24" inputMode="numeric" required value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></div>
          <div><label className="etiqueta">Ambiente</label>
            <select className="campo" value={f.ambiente} onChange={(e) => setF({ ...f, ambiente: e.target.value })}><option value="salon">Salón</option><option value="terraza">Terraza</option></select>
          </div>
          <div><label className="etiqueta">Puestos</label><input className="campo w-20" inputMode="numeric" value={f.capacidad} onChange={(e) => setF({ ...f, capacidad: e.target.value })} /></div>
          <button className="btn-primario">Agregar mesa</button>
          {error && <p className="w-full text-sm text-red-700">{error}</p>}
        </form>
        <p className="text-sm text-taupe print:hidden">
          Cada QR abre la carta de su mesa. Si un código se filtra (foto en redes, etc.), toca «Nuevo QR» y reimprime: el anterior deja de funcionar.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
          {mesas.map((m) => (
            <div key={m.id} className={`tarjeta flex flex-col items-center text-center print:break-inside-avoid print:shadow-none print:ring-1 ${!m.activa ? 'opacity-50' : ''}`}>
              <Logo className="scale-75" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qrs[m.id] && <img src={qrs[m.id]} alt={`QR mesa ${m.numero}`} className="mt-1 w-full max-w-[180px]" />}
              <p className="mt-1 text-xl font-bold">Mesa {m.numero}</p>
              <p className="text-xs text-taupe">Escanea para ver la carta y pedir</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1 print:hidden">
                <select className="rounded-full border border-ciruela/15 px-2 py-1 text-xs" value={m.ambiente} onChange={(e) => actualizar(m.id, { ambiente: e.target.value as Mesa['ambiente'] })}>
                  <option value="salon">Salón</option><option value="terraza">Terraza</option>
                </select>
                <button className="btn-chico bg-crema text-xs" onClick={() => confirm(`¿Generar un QR nuevo para la mesa ${m.numero}? El impreso dejará de funcionar.`) && actualizar(m.id, { token: crypto.randomUUID() })}>Nuevo QR</button>
                <button className="btn-chico bg-crema text-xs" onClick={() => actualizar(m.id, { activa: !m.activa })}>{m.activa ? 'Desactivar' : 'Activar'}</button>
                <a className="btn-chico bg-crema text-xs" href={`/mesa/${m.token}`} target="_blank" rel="noreferrer">Probar</a>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
