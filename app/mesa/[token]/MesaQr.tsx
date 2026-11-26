'use client';
import { useCallback, useEffect, useState } from 'react';
import { CartaInteractiva } from '@/components/CartaInteractiva';
import { ResumenCarrito } from '@/components/ResumenCarrito';
import { Hoja } from '@/components/Hoja';
import { Logo } from '@/components/Logo';
import { MenuInferior } from '@/components/MenuInferior';
import { paraEnviar, useCarrito } from '@/lib/carrito';
import { useProductosVivos } from '@/lib/useProductosVivos';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { ESTADO_TEXTO, aBs, bs, hora, mensajeError, usd } from '@/lib/formato';
import type { Categoria, EstadoPedido, Producto } from '@/lib/tipos';

interface PedidoMesa { numero: number; estado: EstadoPedido; subtotal_usd: number; created_at: string; items: { nombre: string; cantidad: number }[] }

export function MesaQr({ token, nombre, categorias, productosIniciales, tasa, requiereAprobacion }: {
  token: string; nombre: string; categorias: Categoria[]; productosIniciales: Producto[]; tasa: number; requiereAprobacion: boolean;
}) {
  const productos = useProductosVivos(productosIniciales);
  const carrito = useCarrito(`pranoa-carrito-mesa-${token}`);
  const [hoja, setHoja] = useState<'' | 'carrito' | 'pedidos'>('');
  const [pedidos, setPedidos] = useState<PedidoMesa[]>([]);
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [notas, setNotas] = useState('');

  const cargarPedidos = useCallback(async () => {
    const { data } = await supabaseNavegador().rpc('pedidos_de_mesa', { p_token: token });
    if (data) setPedidos(data as PedidoMesa[]);
  }, [token]);

  useEffect(() => {
    cargarPedidos();
    const t = setInterval(cargarPedidos, 10000);
    return () => clearInterval(t);
  }, [cargarPedidos]);

  const mostrar = (m: string) => { setAviso(m); setTimeout(() => setAviso(''), 4000); };

  async function llamar(tipo: 'mesonero' | 'cuenta') {
    const { error } = await supabaseNavegador().rpc('llamar_desde_mesa', { p_token: token, p_tipo: tipo });
    mostrar(error ? mensajeError(error) : tipo === 'cuenta' ? 'Listo: te traemos la cuenta.' : 'Listo: el mesonero viene en camino.');
  }

  async function enviar() {
    setEnviando(true);
    const { error } = await supabaseNavegador().rpc('crear_pedido_mesa', {
      p_token: token, p_items: paraEnviar(carrito.items), p_notas: notas || null,
    });
    setEnviando(false);
    if (error) { mostrar(mensajeError(error)); return; }
    carrito.vaciar();
    setNotas('');
    setHoja('pedidos');
    cargarPedidos();
    mostrar(requiereAprobacion ? 'Pedido enviado. El mesonero lo confirmará en un momento.' : '¡Pedido enviado a cocina!');
  }

  const totalMesa = pedidos.reduce((s, p) => s + Number(p.subtotal_usd), 0);
  const activos = pedidos.filter((p) => !['servido', 'cancelado'].includes(p.estado)).length;

  return (
    <div className="con-menu">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-4">
        <Logo />
        <span className="chip bg-oliva px-3 py-1.5 text-sm text-white">Mesa {nombre}</span>
      </header>
      <div className="mx-auto max-w-5xl px-4">
        <CartaInteractiva categorias={categorias} productos={productos} tasa={tasa} onAgregar={(p) => carrito.agregar(p)} cantidadDe={carrito.cantidadDe} />
      </div>

      {carrito.unidades > 0 && (
        <button type="button" onClick={() => setHoja('carrito')}
          className="btn-naranja fixed inset-x-4 z-30 mx-auto max-w-md shadow-lg"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}>
          Revisar y enviar ({carrito.unidades}) · {usd(carrito.total)}
        </button>
      )}

      {aviso && (
        <div className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-md rounded-2xl bg-ciruela p-4 text-center text-crema shadow-lg" role="status">
          {aviso}
        </div>
      )}

      <Hoja abierta={hoja === 'carrito'} onCerrar={() => setHoja('')} titulo={`Tu pedido · Mesa ${nombre}`}>
        <ResumenCarrito items={carrito.items} cambiar={carrito.cambiar} tasa={tasa} />
        {carrito.unidades > 0 && (
          <>
            <input className="campo mt-3" placeholder="Nota para la cocina (opcional)" maxLength={300} value={notas} onChange={(e) => setNotas(e.target.value)} />
            <button className="btn-primario mt-4 w-full" disabled={enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
          </>
        )}
      </Hoja>

      <Hoja abierta={hoja === 'pedidos'} onCerrar={() => setHoja('')} titulo="Lo que has pedido">
        {pedidos.length === 0 ? (
          <p className="py-6 text-center text-taupe">Todavía no hay pedidos en esta mesa.</p>
        ) : (
          <div className="space-y-3">
            {pedidos.map((p) => (
              <div key={p.numero} className="rounded-xl bg-crema/60 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-taupe">#{p.numero} · {hora(p.created_at)}</span>
                  <span className="chip bg-oliva/15 text-oliva-oscuro">{ESTADO_TEXTO[p.estado]}</span>
                </div>
                <p className="mt-1 text-sm">{p.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ')}</p>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-ciruela/10 pt-3">
              <span className="font-semibold">Consumo de la mesa</span>
              <span className="text-right"><b className="text-lg">{usd(totalMesa)}</b>{tasa > 0 && <span className="block text-sm text-taupe">{bs(aBs(totalMesa, tasa))}</span>}</span>
            </div>
            <button className="btn-secundario w-full" onClick={() => llamar('cuenta')}>Pedir la cuenta</button>
          </div>
        )}
      </Hoja>

      <MenuInferior
        botones={[
          { href: `/mesa/${token}`, titulo: 'Carta', icono: 'carta', onClick: () => { setHoja(''); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
          { href: '#pedidos', titulo: 'Mis pedidos', icono: 'bolsa', aviso: activos, onClick: () => setHoja('pedidos') },
          { href: '#mesonero', titulo: 'Mesonero', icono: 'campana', onClick: () => llamar('mesonero') },
          { href: '#cuenta', titulo: 'La cuenta', icono: 'cuenta', onClick: () => llamar('cuenta') },
        ]}
      />
    </div>
  );
}
