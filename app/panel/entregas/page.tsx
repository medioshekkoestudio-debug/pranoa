'use client';
import { useCallback, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { usePerfil } from '../MarcoPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { useTiempoReal } from '@/lib/tiempoReal';
import { cambiarEstado, hacer } from '@/lib/acciones';
import { ESTADO_TEXTO, hora, usd } from '@/lib/formato';
import type { Pedido } from '@/lib/tipos';

export default function Entregas() {
  const perfil = usePerfil();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [hechas, setHechas] = useState(0);

  const cargar = useCallback(async () => {
    const sb = supabaseNavegador();
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    // la base solo deja ver al motorizado los pedidos asignados a él
    const [p, h] = await Promise.all([
      sb.from('pedidos').select('*, pedido_items(*)').eq('motorizado_id', perfil.id).in('estado', ['nuevo', 'preparando', 'listo', 'en_ruta']).order('created_at'),
      sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('motorizado_id', perfil.id).eq('estado', 'entregado').gte('created_at', inicio.toISOString()),
    ]);
    setPedidos((p.data || []) as Pedido[]);
    setHechas(h.count || 0);
  }, [perfil.id]);

  useTiempoReal(['pedidos'], cargar, 30000);

  return (
    <>
      <CabeceraPanel titulo="Mis entregas">
        <span className="chip bg-oliva/15 text-oliva-oscuro">{hechas} hoy</span>
      </CabeceraPanel>
      <main className="mx-auto max-w-xl space-y-3 px-4 pt-4">
        {pedidos.length === 0 && <p className="tarjeta text-center text-taupe">No tienes entregas asignadas.</p>}
        {pedidos.map((p) => {
          const total = Number(p.subtotal_usd) + Number(p.costo_envio_usd);
          const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.direccion || '') + ', Valencia, Carabobo')}`;
          return (
            <article key={p.id} className="tarjeta">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">#{p.numero} · {p.cliente_nombre}</p>
                <span className="chip bg-naranja/15 text-naranja-oscuro">{ESTADO_TEXTO[p.estado]}</span>
              </div>
              <p className="mt-1">{p.direccion}</p>
              {p.notas && <p className="text-sm text-taupe">{p.notas}</p>}
              <p className="mt-1 text-sm text-taupe">Pedido a las {hora(p.created_at)} · {p.pedido_items?.reduce((s, i) => s + i.cantidad, 0)} platos · total {usd(total)}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <a className="btn-chico bg-crema py-2.5" href={`tel:${p.cliente_telefono}`}>Llamar</a>
                <a className="btn-chico bg-crema py-2.5" target="_blank" rel="noreferrer" href={`https://wa.me/${(p.cliente_telefono || '').replace(/\D/g, '').replace(/^0/, '58')}`}>WhatsApp</a>
                <a className="btn-chico bg-crema py-2.5" target="_blank" rel="noreferrer" href={mapa}>Mapa</a>
              </div>
              {p.estado === 'listo' && <button className="btn-naranja mt-3 w-full" onClick={() => hacer(cambiarEstado(p.id, 'en_ruta'))}>Lo recogí · salgo</button>}
              {p.estado === 'en_ruta' && <button className="btn-primario mt-3 w-full" onClick={() => confirm('¿Confirmas que lo entregaste?') && hacer(cambiarEstado(p.id, 'entregado'))}>Entregado</button>}
              {['nuevo', 'preparando'].includes(p.estado) && <p className="mt-3 text-center text-sm text-taupe">En cocina. Te avisamos cuando esté listo.</p>}
            </article>
          );
        })}
      </main>
    </>
  );
}
