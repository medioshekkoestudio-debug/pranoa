'use client';
import { useEffect, useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { ESTADO_TEXTO, hora, usd } from '@/lib/formato';
import type { EstadoPedido } from '@/lib/tipos';

interface Datos {
  numero: number; estado: EstadoPedido; subtotal_usd: number; costo_envio_usd: number; created_at: string;
  cliente_nombre: string; zona: string; motorizado: string | null;
  items: { nombre: string; cantidad: number; precio_usd: number }[];
}

const PASOS: { e: EstadoPedido[]; t: string }[] = [
  { e: ['por_aprobar'], t: 'Confirmando tu pago' },
  { e: ['nuevo', 'preparando'], t: 'En cocina' },
  { e: ['listo'], t: 'Listo para salir' },
  { e: ['en_ruta'], t: 'En camino' },
  { e: ['entregado'], t: 'Entregado' },
];

export function Seguimiento({ token, whatsapp }: { token: string; whatsapp: string | null }) {
  const [d, setD] = useState<Datos | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      const { data } = await supabaseNavegador().rpc('estado_pedido_publico', { p_token: token });
      if (vivo) setD((data as Datos) || null);
    };
    cargar();
    const t = setInterval(cargar, 8000);
    return () => { vivo = false; clearInterval(t); };
  }, [token]);

  if (d === undefined) return <p className="py-10 text-center text-taupe">Cargando…</p>;
  if (d === null) return <p className="tarjeta text-center">No encontramos este pedido.</p>;

  const actual = PASOS.findIndex((p) => p.e.includes(d.estado));
  return (
    <div className="space-y-4">
      <div className="tarjeta">
        <p className="text-sm text-taupe">Pedido #{d.numero} · {hora(d.created_at)}</p>
        <p className="mt-1 text-2xl font-bold">{d.estado === 'cancelado' ? 'Pedido cancelado' : ESTADO_TEXTO[d.estado]}</p>
        {d.motorizado && d.estado === 'en_ruta' && <p className="mt-1 text-taupe">Lo lleva {d.motorizado}</p>}
        {d.estado !== 'cancelado' && (
          <ol className="mt-5 space-y-3">
            {PASOS.map((p, i) => (
              <li key={p.t} className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${i <= actual ? 'bg-oliva text-white' : 'bg-crema text-taupe'}`}>
                  {i < actual ? '✓' : i + 1}
                </span>
                <span className={i === actual ? 'font-semibold' : i < actual ? '' : 'text-taupe'}>{p.t}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="tarjeta text-sm">
        {d.items.map((it, i) => (
          <div key={i} className="flex justify-between py-0.5"><span>{it.cantidad} × {it.nombre}</span><span>{usd(it.precio_usd * it.cantidad)}</span></div>
        ))}
        <div className="mt-2 flex justify-between border-t border-ciruela/10 pt-2"><span>Envío ({d.zona})</span><span>{usd(d.costo_envio_usd)}</span></div>
        <div className="flex justify-between font-bold"><span>Total</span><span>{usd(Number(d.subtotal_usd) + Number(d.costo_envio_usd))}</span></div>
      </div>
      <p className="text-center text-sm text-taupe">Guarda este enlace para ver cómo va tu pedido.</p>
      {whatsapp && (
        <a className="btn-secundario w-full" target="_blank" rel="noreferrer"
          href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, consulto por mi pedido #${d.numero}`)}`}>
          Escribir por WhatsApp
        </a>
      )}
    </div>
  );
}
