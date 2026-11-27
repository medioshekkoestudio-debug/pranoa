'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { Logo } from '@/components/Logo';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import type { Mesa } from '@/lib/tipos';

/** Los QR SIEMPRE apuntan al dominio oficial, sin importar desde dónde se abra el panel
 *  (pranoa.vercel.app, vistas previas o localhost). */
const DOMINIO_QR = (process.env.NEXT_PUBLIC_QR_URL || 'https://www.espaciopranoa.com').replace(/\/$/, '');

export default function ConfigMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [f, setF] = useState({ nombre: '', ambiente: 'salon' as Mesa['ambiente'], capacidad: '4' });
  const [editando, setEditando] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editCapacidad, setEditCapacidad] = useState('4');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    const { data } = await supabaseNavegador().from('mesas').select('*').order('nombre', { ascending: true });
    const lista = ((data || []) as Mesa[]).sort((a, b) =>
      (a.nombre || String(a.numero)).localeCompare(b.nombre || String(b.numero), 'es', { numeric: true }),
    );
    setMesas(lista);
    const base = DOMINIO_QR;
    const pares = await Promise.all(
      lista.map(async (m) => [
        m.id,
        await QRCode.toDataURL(`${base}/mesa/${m.token}`, {
          margin: 1,
          width: 360,
          color: { dark: '#3C2525', light: '#FFFFFF' },
        }),
      ]),
    );
    setQrs(Object.fromEntries(pares));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const sb = supabaseNavegador();

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const nombre = f.nombre.trim().toUpperCase();
    if (!nombre) { setError('Escribe el nombre de la mesa (ej: A01, B07).'); return; }
    const capacidad = Math.max(1, Math.min(40, Number(f.capacidad) || 4));
    const maxNum = mesas.reduce((max, m) => Math.max(max, Number(m.numero) || 0), 100);
    const { error } = await sb.from('mesas').insert({
      nombre,
      numero: maxNum + 1,
      ambiente: f.ambiente,
      capacidad,
    });
    if (error) {
      setError(error.message.includes('duplicate') || error.message.includes('unique') ? `Ya existe una mesa llamada ${nombre}` : error.message);
      return;
    }
    setF({ ...f, nombre: '' });
    cargar();
  }

  async function actualizar(id: string, datos: Partial<Mesa>) {
    const { error } = await sb.from('mesas').update(datos).eq('id', id);
    if (error) {
      alert(error.message.includes('duplicate') || error.message.includes('unique') ? 'Ya existe otra mesa con ese nombre.' : error.message);
      return false;
    }
    cargar();
    return true;
  }

  async function guardarEdicion(id: string) {
    const nombre = editNombre.trim().toUpperCase();
    if (!nombre) { alert('El nombre no puede estar vacío.'); return; }
    const capacidad = Math.max(1, Math.min(40, Number(editCapacidad) || 4));
    const ok = await actualizar(id, { nombre, capacidad });
    if (ok) setEditando(null);
  }

  async function eliminar(m: Mesa) {
    const etiqueta = m.nombre || String(m.numero);
    if (!confirm(`¿Eliminar permanentemente la mesa ${etiqueta}?`)) return;
    const { error } = await sb.from('mesas').delete().eq('id', m.id);
    if (error) {
      if (error.message.includes('foreign key') || error.code === '23503') {
        if (confirm(`La mesa ${etiqueta} tiene historial de cuentas/pedidos y no se puede borrar de la base de datos. ¿Quieres desactivarla para ocultarla?`)) {
          await actualizar(m.id, { activa: false });
        }
      } else {
        alert(error.message);
      }
      return;
    }
    cargar();
  }

  return (
    <>
      <CabeceraPanel titulo="Mesas y QR">
        <button className="btn-chico bg-oliva text-white" onClick={() => window.print()}>Imprimir QR</button>
      </CabeceraPanel>
      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-4">
        <form onSubmit={crear} className="tarjeta flex flex-wrap items-end gap-2 print:hidden">
          <div>
            <label className="etiqueta">Nombre</label>
            <input
              className="campo w-28 uppercase"
              placeholder="Ej: H01"
              maxLength={20}
              required
              value={f.nombre}
              onChange={(e) => setF({ ...f, nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="etiqueta">Ambiente</label>
            <select className="campo" value={f.ambiente} onChange={(e) => setF({ ...f, ambiente: e.target.value as Mesa['ambiente'] })}>
              <option value="salon">Salón</option>
              <option value="terraza">Terraza</option>
            </select>
          </div>
          <div>
            <label className="etiqueta">Puestos / sillas</label>
            <input
              className="campo w-24"
              type="number"
              min={1}
              max={40}
              value={f.capacidad}
              onChange={(e) => setF({ ...f, capacidad: e.target.value })}
            />
          </div>
          <button className="btn-primario">+ Agregar mesa</button>
          {error && <p className="w-full text-sm text-red-700">{error}</p>}
        </form>

        <p className="text-sm text-taupe print:hidden">
          Define el nombre, ambiente y cantidad de puestos de cada mesa. Todos los QR apuntan a <b>{DOMINIO_QR.replace('https://', '')}</b>. Si un QR se filtra, toca «Nuevo QR» y reimprime.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
          {mesas.map((m) => {
            const etiqueta = m.nombre || String(m.numero);
            const enEdicion = editando === m.id;
            return (
              <div
                key={m.id}
                className={`tarjeta flex flex-col items-center text-center print:break-inside-avoid print:shadow-none print:ring-1 ${!m.activa ? 'opacity-50' : ''}`}
              >
                <Logo className="scale-75" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qrs[m.id] && <img src={qrs[m.id]} alt={`QR mesa ${etiqueta}`} className="mt-1 w-full max-w-[180px]" />}

                {enEdicion ? (
                  <div className="mt-2 w-full space-y-2 print:hidden">
                    <input
                      className="campo py-1.5 text-center text-sm font-bold uppercase"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      placeholder="Nombre"
                    />
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full bg-crema font-bold"
                        onClick={() => setEditCapacidad(String(Math.max(1, (Number(editCapacidad) || 1) - 1)))}
                      >
                        −
                      </button>
                      <input
                        className="campo w-16 py-1 text-center text-sm"
                        type="number"
                        min={1}
                        max={40}
                        value={editCapacidad}
                        onChange={(e) => setEditCapacidad(e.target.value)}
                      />
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full bg-crema font-bold"
                        onClick={() => setEditCapacidad(String(Math.min(40, (Number(editCapacidad) || 1) + 1)))}
                      >
                        +
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" className="btn-chico flex-1 bg-oliva text-xs text-white" onClick={() => guardarEdicion(m.id)}>Guardar</button>
                      <button type="button" className="btn-chico bg-crema text-xs" onClick={() => setEditando(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-xl font-bold">Mesa {etiqueta}</p>
                    <p className="text-xs font-medium text-oliva print:hidden">
                      {m.ambiente === 'salon' ? 'Salón' : 'Terraza'} · {m.capacidad} {m.capacidad === 1 ? 'puesto' : 'puestos'}
                    </p>
                    <p className="text-xs text-taupe">Escanea para ver la carta y pedir</p>

                    {/* Control rápido de puestos */}
                    <div className="mt-2 flex items-center gap-1.5 print:hidden">
                      <span className="text-[0.7rem] text-taupe">Puestos:</span>
                      <button
                        type="button"
                        className="h-6 w-6 rounded-full bg-crema text-xs font-bold hover:bg-crema-oscuro"
                        onClick={() => m.capacidad > 1 && actualizar(m.id, { capacidad: m.capacidad - 1 })}
                        aria-label="Restar puesto"
                      >
                        −
                      </button>
                      <span className="min-w-[1.5rem] text-xs font-bold">{m.capacidad}</span>
                      <button
                        type="button"
                        className="h-6 w-6 rounded-full bg-crema text-xs font-bold hover:bg-crema-oscuro"
                        onClick={() => m.capacidad < 40 && actualizar(m.id, { capacidad: m.capacidad + 1 })}
                        aria-label="Sumar puesto"
                      >
                        +
                      </button>
                    </div>

                    <div className="mt-2.5 flex flex-wrap justify-center gap-1 print:hidden">
                      <select
                        className="rounded-full border border-ciruela/15 px-2 py-1 text-xs"
                        value={m.ambiente}
                        onChange={(e) => actualizar(m.id, { ambiente: e.target.value as Mesa['ambiente'] })}
                      >
                        <option value="salon">Salón</option>
                        <option value="terraza">Terraza</option>
                      </select>
                      <button
                        type="button"
                        className="btn-chico bg-crema text-xs"
                        onClick={() => {
                          setEditando(m.id);
                          setEditNombre(etiqueta);
                          setEditCapacidad(String(m.capacidad));
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-chico bg-crema text-xs"
                        onClick={() => confirm(`¿Generar un QR nuevo para la mesa ${etiqueta}? El impreso dejará de funcionar.`) && actualizar(m.id, { token: crypto.randomUUID() })}
                      >
                        Nuevo QR
                      </button>
                      <button
                        type="button"
                        className="btn-chico bg-crema text-xs"
                        onClick={() => actualizar(m.id, { activa: !m.activa })}
                      >
                        {m.activa ? 'Desactivar' : 'Activar'}
                      </button>
                      <a className="btn-chico bg-crema text-xs" href={`${DOMINIO_QR}/mesa/${m.token}`} target="_blank" rel="noreferrer">Probar</a>
                      <button
                        type="button"
                        className="btn-chico bg-red-50 text-xs text-red-700 hover:bg-red-100"
                        onClick={() => eliminar(m)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
