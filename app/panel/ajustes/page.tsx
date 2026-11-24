'use client';
import { useEffect, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import type { Ajustes } from '@/lib/tipos';

type Campo = { k: keyof Ajustes; t: string; tipo?: 'texto' | 'area' | 'numero' | 'si'; ayuda?: string };
const CAMPOS: Campo[] = [
  { k: 'horario', t: 'Horario' },
  { k: 'direccion', t: 'Dirección' },
  { k: 'mapa_url', t: 'Enlace de Google Maps' },
  { k: 'whatsapp', t: 'WhatsApp Business', ayuda: 'Con código de país, solo números: 584121234567' },
  { k: 'instagram', t: 'Instagram', ayuda: '@pranoa' },
  { k: 'pago_movil_datos', t: 'Datos de Pago Móvil', tipo: 'area', ayuda: 'Banco, teléfono y cédula/RIF. Lo ve el cliente al pagar el delivery.' },
  { k: 'zelle_datos', t: 'Datos de Zelle', tipo: 'area' },
  { k: 'alerta_minutos', t: 'Alerta de demora en cocina (minutos)', tipo: 'numero' },
  { k: 'qr_requiere_aprobacion', t: 'Los pedidos del QR los confirma el mesonero antes de ir a cocina', tipo: 'si' },
  { k: 'delivery_activo', t: 'Delivery abierto', tipo: 'si' },
];

export default function PaginaAjustes() {
  const [a, setA] = useState<Ajustes | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabaseNavegador().from('ajustes').select('*').eq('id', 1).single().then(({ data }) => setA(data as Ajustes));
  }, []);

  if (!a) return <p className="p-6 text-taupe">Cargando…</p>;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const { tasa_bs, tasa_fuente, tasa_actualizada, ...resto } = a!; // la tasa se cambia desde Caja
    void tasa_bs; void tasa_fuente; void tasa_actualizada;
    const { error } = await supabaseNavegador().from('ajustes').update({ ...resto, updated_at: new Date().toISOString() }).eq('id', 1);
    setMsg(error ? error.message : 'Guardado.');
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <>
      <CabeceraPanel titulo="Ajustes" />
      <form onSubmit={guardar} className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {CAMPOS.map((c) => (
          <div key={c.k}>
            {c.tipo === 'si' ? (
              <label className="tarjeta flex items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-[#65663B]" checked={!!a[c.k]} onChange={(e) => setA({ ...a, [c.k]: e.target.checked })} />
                <span>{c.t}</span>
              </label>
            ) : (
              <>
                <label className="etiqueta">{c.t}</label>
                {c.tipo === 'area' ? (
                  <textarea className="campo" rows={3} value={String(a[c.k] ?? '')} onChange={(e) => setA({ ...a, [c.k]: e.target.value })} />
                ) : (
                  <input className="campo" inputMode={c.tipo === 'numero' ? 'numeric' : undefined} value={String(a[c.k] ?? '')}
                    onChange={(e) => setA({ ...a, [c.k]: c.tipo === 'numero' ? Number(e.target.value) || 0 : e.target.value })} />
                )}
                {c.ayuda && <p className="mt-1 text-xs text-taupe">{c.ayuda}</p>}
              </>
            )}
          </div>
        ))}
        <button className="btn-primario w-full">Guardar</button>
        {msg && <p className="text-center text-sm text-taupe">{msg}</p>}
      </form>
    </>
  );
}
