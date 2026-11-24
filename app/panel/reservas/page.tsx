'use client';
import { useCallback, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { usePerfil } from '../MarcoPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { useTiempoReal } from '@/lib/tiempoReal';
import { fechaLarga, hoyVE } from '@/lib/formato';
import type { Reserva } from '@/lib/tipos';

const COLOR: Record<Reserva['estado'], string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  confirmada: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-red-100 text-red-700',
  completada: 'bg-ciruela/10 text-ciruela',
};

export default function Reservas() {
  const perfil = usePerfil();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [desde, setDesde] = useState(hoyVE());

  const cargar = useCallback(async () => {
    const { data } = await supabaseNavegador().from('reservas').select('*').gte('fecha', desde).order('fecha').order('hora').limit(300);
    setReservas((data || []) as Reserva[]);
  }, [desde]);

  useTiempoReal(['reservas'], cargar, 60000);

  async function cambiar(r: Reserva, estado: Reserva['estado']) {
    const { error } = await supabaseNavegador().from('reservas').update({ estado }).eq('id', r.id);
    if (error) { alert(error.message); return; }
    cargar();
    if (estado === 'confirmada' || estado === 'cancelada') {
      const texto = estado === 'confirmada'
        ? `Hola ${r.nombre}, te confirmamos tu reserva en Pranoa para ${r.personas} personas el ${fechaLarga(r.fecha)} a las ${r.hora.slice(0, 5)}. ¡Te esperamos!`
        : `Hola ${r.nombre}, lamentamos no poder confirmar tu reserva del ${fechaLarga(r.fecha)} a las ${r.hora.slice(0, 5)}. ¿Te podemos ofrecer otro horario?`;
      if (confirm('¿Avisar al cliente por WhatsApp?')) {
        window.open(`https://wa.me/${r.telefono.replace(/\D/g, '').replace(/^0/, '58')}?text=${encodeURIComponent(texto)}`, '_blank');
      }
    }
  }

  const dias = Array.from(new Set(reservas.map((r) => r.fecha)));

  return (
    <>
      <CabeceraPanel titulo="Reservas">
        <input type="date" className="rounded-full border border-ciruela/15 bg-white px-3 py-1.5 text-sm" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
      </CabeceraPanel>
      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-4">
        {reservas.length === 0 && <p className="tarjeta text-center text-taupe">No hay reservas desde esa fecha.</p>}
        {dias.map((d) => {
          const lista = reservas.filter((r) => r.fecha === d);
          const personas = lista.filter((r) => r.estado !== 'cancelada').reduce((s, r) => s + r.personas, 0);
          return (
            <section key={d}>
              <h2 className="mb-2 font-bold capitalize">{fechaLarga(d)} <span className="text-sm font-normal text-taupe">· {personas} personas</span></h2>
              <div className="space-y-2">
                {lista.map((r) => (
                  <div key={r.id} className="tarjeta">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{r.hora.slice(0, 5)} · {r.nombre} · {r.personas} pers.</p>
                        <p className="text-sm text-taupe">{r.ambiente === 'salon' ? 'Salón' : 'Terraza'} · <a className="text-oliva" href={`tel:${r.telefono}`}>{r.telefono}</a></p>
                        {r.notas && <p className="text-sm">{r.notas}</p>}
                      </div>
                      <span className={`chip ${COLOR[r.estado]}`}>{r.estado}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.estado === 'pendiente' && <button className="btn-chico bg-oliva text-white" onClick={() => cambiar(r, 'confirmada')}>Confirmar</button>}
                      {r.estado === 'confirmada' && <button className="btn-chico bg-crema" onClick={() => cambiar(r, 'completada')}>Llegaron</button>}
                      {['pendiente', 'confirmada'].includes(r.estado) && <button className="btn-peligro py-1" onClick={() => cambiar(r, 'cancelada')}>Cancelar</button>}
                      {perfil.rol === 'admin' && r.estado === 'cancelada' && (
                        <button className="btn-chico text-taupe" onClick={async () => { await supabaseNavegador().from('reservas').delete().eq('id', r.id); cargar(); }}>Borrar</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
