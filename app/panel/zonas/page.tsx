'use client';
import { useCallback, useEffect, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import type { Zona } from '@/lib/tipos';

export default function Zonas() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [f, setF] = useState({ nombre: '', tarifa: '' });
  const sb = supabaseNavegador();

  const cargar = useCallback(async () => {
    const { data } = await supabaseNavegador().from('zonas_delivery').select('*').order('orden');
    setZonas((data || []) as Zona[]);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const actualizar = async (id: string, datos: Partial<Zona>) => {
    const { error } = await sb.from('zonas_delivery').update(datos).eq('id', id);
    if (error) alert(error.message);
    cargar();
  };

  return (
    <>
      <CabeceraPanel titulo="Zonas de delivery" />
      <main className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <p className="text-sm text-taupe">El cliente elige su zona y el envío se suma solo. Los cambios se guardan al salir de cada casilla.</p>
        {zonas.map((z) => (
          <div key={z.id} className={`tarjeta flex flex-wrap items-center gap-2 ${!z.activa ? 'opacity-60' : ''}`}>
            <input className="campo min-w-0 flex-1 py-2" defaultValue={z.nombre} onBlur={(e) => e.target.value !== z.nombre && actualizar(z.id, { nombre: e.target.value })} />
            <div className="flex items-center gap-1">
              <span>$</span>
              <input className="campo w-20 py-2" inputMode="decimal" defaultValue={z.tarifa_usd}
                onBlur={(e) => Number(e.target.value.replace(',', '.')) !== Number(z.tarifa_usd) && actualizar(z.id, { tarifa_usd: Number(e.target.value.replace(',', '.')) })} />
            </div>
            <button className={`btn-chico ${z.activa ? 'bg-emerald-100' : 'bg-red-100'}`} onClick={() => actualizar(z.id, { activa: !z.activa })}>{z.activa ? 'Activa' : 'Inactiva'}</button>
          </div>
        ))}
        <form className="tarjeta flex gap-2" onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await sb.from('zonas_delivery').insert({ nombre: f.nombre.trim(), tarifa_usd: Number(f.tarifa.replace(',', '.')) || 0, orden: zonas.length + 1 });
          if (error) { alert(error.message); return; }
          setF({ nombre: '', tarifa: '' });
          cargar();
        }}>
          <input className="campo flex-1 py-2" placeholder="Nueva zona" required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          <input className="campo w-24 py-2" placeholder="$" inputMode="decimal" required value={f.tarifa} onChange={(e) => setF({ ...f, tarifa: e.target.value })} />
          <button className="btn-primario py-2">Añadir</button>
        </form>
      </main>
    </>
  );
}
