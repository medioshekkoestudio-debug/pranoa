'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MenuInferior } from '@/components/MenuInferior';
import { INICIO_ROL, menuDe, puedeEntrar, seccionDe } from '@/lib/permisos';
import type { Perfil } from '@/lib/tipos';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { notificar, sonar, useTiempoReal } from '@/lib/tiempoReal';

const ContextoPerfil = createContext<Perfil | null>(null);
export const usePerfil = () => useContext(ContextoPerfil)!;

type Contadores = Record<string, number>;

/** Cuenta lo pendiente para los globitos del menú inferior, según el perfil */
async function contar(p: Perfil): Promise<Contadores> {
  const sb = supabaseNavegador();
  const n = async (q: PromiseLike<{ count: number | null }>) => (await q).count || 0;
  const c: Contadores = {};
  if (['admin', 'cajero', 'mesonero'].includes(p.rol)) {
    const [llamadas, porAprobarMesa, listosMesa] = await Promise.all([
      n(sb.from('llamadas').select('id', { count: 'exact', head: true }).eq('atendida', false)),
      n(sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('tipo', 'mesa').eq('estado', 'por_aprobar')),
      n(sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('tipo', 'mesa').eq('estado', 'listo')),
    ]);
    c['/panel/mesas'] = llamadas + porAprobarMesa + listosMesa;
  }
  if (['admin', 'cajero'].includes(p.rol)) {
    c['/panel/delivery'] = await n(sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('tipo', 'delivery').in('estado', ['por_aprobar', 'listo']));
    c['/panel/caja'] = await n(sb.from('llamadas').select('id', { count: 'exact', head: true }).eq('atendida', false).eq('tipo', 'cuenta'));
    c['/panel/reservas'] = await n(sb.from('reservas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'));
  }
  if (p.rol === 'mesonero') {
    c['/panel/reservas'] = await n(sb.from('reservas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'));
  }
  if (['admin', 'cocina'].includes(p.rol)) {
    c['/panel/cocina'] = await n(sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', 'nuevo'));
  }
  if (p.rol === 'motorizado') {
    c['/panel/entregas'] = await n(sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('motorizado_id', p.id).in('estado', ['listo', 'en_ruta']));
  }
  return c;
}

export function MarcoPanel({ perfil, children }: { perfil: Perfil; children: React.ReactNode }) {
  const ruta = usePathname();
  const router = useRouter();
  const [contadores, setContadores] = useState<Contadores>({});
  const vistos = useRef(new Map<string, Record<string, unknown>>());

  // guardia en el cliente (los layouts no se vuelven a ejecutar al navegar entre secciones)
  useEffect(() => {
    if (ruta !== '/panel' && !puedeEntrar(perfil.rol, ruta)) router.replace(INICIO_ROL[perfil.rol]);
  }, [ruta, perfil.rol, router]);

  const recontar = useCallback(async () => setContadores(await contar(perfil)), [perfil]);

  // alertas con sonido y notificación según el perfil
  // los contadores se recalculan agrupando ráfagas; los avisos se revisan evento por evento
  useTiempoReal(['pedidos', 'llamadas', 'reservas'], () => { recontar(); }, 30000, (c) => {
    const fila = (c.new || {}) as Record<string, unknown>;
    const r = perfil.rol;
    // Con RLS, Supabase no manda el registro anterior: se recuerda aquí el último estado visto
    const id = String(fila.id || '');
    const antes = (c.table === 'pedidos' && vistos.current.get(id)) || {};
    if (c.table === 'pedidos' && id) vistos.current.set(id, { estado: fila.estado, motorizado_id: fila.motorizado_id });
    if (c.table === 'pedidos') {
      const num = `#${fila.numero ?? ''}`;
      if (fila.estado === 'nuevo' && antes.estado !== 'nuevo' && (r === 'cocina' || r === 'admin')) {
        sonar('nuevo'); notificar('Nuevo pedido en cocina', `${fila.tipo === 'delivery' ? 'Delivery' : 'Sala'} ${num}`, '/panel/cocina');
      }
      if (c.eventType === 'INSERT' && fila.estado === 'por_aprobar') {
        if (fila.tipo === 'mesa' && ['mesonero', 'cajero', 'admin'].includes(r)) { sonar('llamada'); notificar('Pedido desde el QR', `Pedido ${num} por confirmar`, '/panel/mesas'); }
        if (fila.tipo === 'delivery' && ['cajero', 'admin'].includes(r)) { sonar('nuevo'); notificar('Nuevo delivery', `Pedido ${num} por confirmar`, '/panel/delivery'); }
      }
      if (fila.estado === 'listo' && antes.estado !== 'listo') {
        if (fila.tipo === 'mesa' && r === 'mesonero') { sonar('listo'); notificar('Plato listo', `Pedido ${num} listo para servir`, '/panel/mesas'); }
        if (fila.tipo === 'delivery' && (r === 'cajero' || (r === 'motorizado' && fila.motorizado_id === perfil.id))) { sonar('listo'); notificar('Delivery listo', `Pedido ${num} listo para despachar`, r === 'motorizado' ? '/panel/entregas' : '/panel/delivery'); }
      }
      if (r === 'motorizado' && fila.motorizado_id === perfil.id && antes.motorizado_id !== perfil.id) {
        sonar('nuevo'); notificar('Te asignaron una entrega', `Pedido ${num}`, '/panel/entregas');
      }
    }
    if (c.table === 'llamadas' && c.eventType === 'INSERT' && ['mesonero', 'cajero', 'admin'].includes(r)) {
      sonar('llamada'); notificar(fila.tipo === 'cuenta' ? 'Piden la cuenta' : 'Llaman al mesonero', 'Revisa el mapa de mesas', '/panel/mesas');
    }
    if (c.table === 'reservas' && c.eventType === 'INSERT' && ['cajero', 'admin'].includes(r)) {
      notificar('Nueva reserva', `${fila.nombre ?? ''} · ${fila.personas ?? ''} personas`, '/panel/reservas');
    }
  });

  const oscuro = seccionDe(ruta)?.ruta === '/panel/cocina';
  const botones = menuDe(perfil.rol).map((s) => ({ href: s.ruta, titulo: s.titulo, icono: s.icono, aviso: contadores[s.ruta] }));

  return (
    <ContextoPerfil.Provider value={perfil}>
      <div className={`con-menu min-h-screen ${oscuro ? 'bg-ciruela-oscuro text-crema' : ''}`}>{children}</div>
      <MenuInferior botones={botones} oscuro={oscuro} />
    </ContextoPerfil.Provider>
  );
}
