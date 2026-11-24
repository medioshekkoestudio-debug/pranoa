'use client';
import { useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { fechaLarga, hoyVE, mensajeError } from '@/lib/formato';

const HORAS = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];

export function FormReserva() {
  const [f, setF] = useState({ nombre: '', telefono: '', fecha: hoyVE(), hora: '19:00', personas: 2, ambiente: 'salon', notas: '' });
  const [estado, setEstado] = useState<'' | 'enviando' | 'ok'>('');
  const [error, setError] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setError('');
    const { error } = await supabaseNavegador().rpc('crear_reserva', {
      p_nombre: f.nombre, p_telefono: f.telefono, p_fecha: f.fecha, p_hora: f.hora,
      p_personas: f.personas, p_ambiente: f.ambiente, p_notas: f.notas || null,
    });
    if (error) { setError(mensajeError(error)); setEstado(''); return; }
    setEstado('ok');
  }

  if (estado === 'ok') {
    return (
      <div className="tarjeta text-center">
        <p className="text-4xl">🌿</p>
        <p className="mt-2 text-xl font-bold">¡Solicitud recibida!</p>
        <p className="mt-1 text-taupe">
          {f.personas} {f.personas === 1 ? 'persona' : 'personas'} · {fechaLarga(f.fecha)} · {f.hora}
        </p>
        <p className="mt-3 text-sm">Te escribiremos al {f.telefono} para confirmar.</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="etiqueta" htmlFor="r-fecha">Fecha</label>
          <input id="r-fecha" type="date" className="campo" required min={hoyVE()} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="r-hora">Hora</label>
          <select id="r-hora" className="campo" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })}>
            {HORAS.map((h) => <option key={h}>{h}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="etiqueta">Personas</p>
        <div className="flex items-center gap-3">
          <button type="button" className="h-11 w-11 rounded-full bg-crema text-xl font-bold" onClick={() => setF({ ...f, personas: Math.max(1, f.personas - 1) })}>−</button>
          <span className="w-8 text-center text-xl font-bold">{f.personas}</span>
          <button type="button" className="h-11 w-11 rounded-full bg-crema text-xl font-bold" onClick={() => setF({ ...f, personas: Math.min(40, f.personas + 1) })}>+</button>
        </div>
      </div>
      <div>
        <p className="etiqueta">Ambiente</p>
        <div className="grid grid-cols-2 gap-2">
          {[['salon', 'Salón principal'], ['terraza', 'Terraza']].map(([v, t]) => (
            <button type="button" key={v} onClick={() => setF({ ...f, ambiente: v })}
              className={`rounded-xl border px-3 py-3 font-semibold ${f.ambiente === v ? 'border-oliva bg-oliva text-white' : 'border-ciruela/15 bg-white'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="etiqueta" htmlFor="r-nombre">Nombre</label>
        <input id="r-nombre" className="campo" required minLength={2} autoComplete="name" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="r-tel">Teléfono (WhatsApp)</label>
        <input id="r-tel" className="campo" required inputMode="tel" autoComplete="tel" placeholder="0412 1234567" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="r-notas">Ocasión o comentario (opcional)</label>
        <input id="r-notas" className="campo" maxLength={300} placeholder="Cumpleaños, silla para bebé…" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primario w-full" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Solicitar reserva'}</button>
    </form>
  );
}
