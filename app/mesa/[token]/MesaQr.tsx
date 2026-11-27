'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CartaInteractiva } from '@/components/CartaInteractiva';
import { ResumenCarrito } from '@/components/ResumenCarrito';
import { Hoja } from '@/components/Hoja';
import { Isotipo, Logo } from '@/components/Logo';
import { MenuInferior } from '@/components/MenuInferior';
import { paraEnviar, useCarrito } from '@/lib/carrito';
import { useProductosVivos } from '@/lib/useProductosVivos';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { ESTADO_TEXTO, aBs, bs, hora, mensajeError, usd } from '@/lib/formato';
import type { Categoria, EstadoPedido, Producto, SubestadoItem } from '@/lib/tipos';

interface ItemMesaQr {
  nombre: string;
  cantidad: number;
  precio_usd?: number;
  estado?: SubestadoItem;
}

interface PedidoMesa {
  numero: number;
  estado: EstadoPedido;
  subtotal_usd: number;
  created_at: string;
  items: ItemMesaQr[];
}

interface ClienteLocal {
  id?: string;
  nombre: string;
  cedula?: string | null;
  telefono: string;
  correo?: string | null;
}

const CLAVE_CLIENTE = 'pranoa-cliente-perfil';

export function MesaQr({
  token,
  nombre,
  categorias,
  productosIniciales,
  tasa,
  requiereAprobacion,
}: {
  token: string;
  nombre: string;
  categorias: Categoria[];
  productosIniciales: Producto[];
  tasa: number;
  requiereAprobacion: boolean;
}) {
  const productos = useProductosVivos(productosIniciales);
  const carrito = useCarrito(`pranoa-carrito-mesa-${token}`);
  const [vista, setVista] = useState<'inicio' | 'menu'>('inicio');
  const [hoja, setHoja] = useState<'' | 'carrito' | 'estatus' | 'mesonero' | 'cliente'>('');
  const [pedidos, setPedidos] = useState<PedidoMesa[]>([]);
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [notas, setNotas] = useState('');
  const [notaMesonero, setNotaMesonero] = useState('');
  const [cliente, setCliente] = useState<ClienteLocal | null>(null);
  const [formCli, setFormCli] = useState({ nombre: '', cedula: '', telefono: '', correo: '' });
  const [guardandoCli, setGuardandoCli] = useState(false);

  // Cargar perfil de cliente guardado localmente si ya se registró antes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLAVE_CLIENTE);
      if (raw) {
        const c = JSON.parse(raw) as ClienteLocal;
        if (c?.nombre) {
          setCliente(c);
          setFormCli({
            nombre: c.nombre || '',
            cedula: c.cedula || '',
            telefono: c.telefono || '',
            correo: c.correo || '',
          });
        }
      }
    } catch { /* modo privado */ }
  }, []);

  const cargarPedidos = useCallback(async () => {
    const { data } = await supabaseNavegador().rpc('pedidos_de_mesa', { p_token: token });
    if (data) setPedidos(data as PedidoMesa[]);
  }, [token]);

  useEffect(() => {
    cargarPedidos();
    const t = setInterval(cargarPedidos, 10000);
    return () => clearInterval(t);
  }, [cargarPedidos]);

  const mostrar = (m: string) => {
    setAviso(m);
    setTimeout(() => setAviso(''), 4500);
  };

  async function llamar(tipo: 'mesonero' | 'cuenta', notaTexto?: string) {
    setEnviando(true);
    const { error } = await supabaseNavegador().rpc('llamar_desde_mesa', {
      p_token: token,
      p_tipo: tipo,
      p_nota: notaTexto?.trim() || null,
    });
    setEnviando(false);
    if (error) { mostrar(mensajeError(error)); return; }
    if (tipo === 'mesonero') {
      setNotaMesonero('');
      setHoja('');
      mostrar('¡Listo! Le avisamos al mesonero, viene en camino.');
    } else {
      mostrar('¡Listo! Solicitamos la cuenta para tu mesa.');
    }
  }

  async function registrarCliente(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoCli(true);
    const { data, error } = await supabaseNavegador().rpc('registrar_cliente_qr', {
      p_token: token,
      p_nombre: formCli.nombre,
      p_telefono: formCli.telefono,
      p_cedula: formCli.cedula || null,
      p_correo: formCli.correo || null,
    });
    setGuardandoCli(false);
    if (error) { mostrar(mensajeError(error)); return; }
    const guardado = (data || formCli) as ClienteLocal;
    setCliente(guardado);
    try { localStorage.setItem(CLAVE_CLIENTE, JSON.stringify(guardado)); } catch { /* sin storage */ }
    setHoja('');
    mostrar(`¡Bienvenido/a ${guardado.nombre}! Tu perfil de cliente quedó guardado.`);
  }

  async function enviarPedido() {
    setEnviando(true);
    const { error } = await supabaseNavegador().rpc('crear_pedido_mesa', {
      p_token: token,
      p_items: paraEnviar(carrito.items),
      p_notas: notas || null,
    });
    setEnviando(false);
    if (error) { mostrar(mensajeError(error)); return; }
    carrito.vaciar();
    setNotas('');
    setHoja('estatus');
    cargarPedidos();
    mostrar(requiereAprobacion ? 'Pedido enviado. El mesonero lo confirmará en un momento.' : '¡Pedido enviado a cocina!');
  }

  const totalMesa = pedidos.reduce((s, p) => s + Number(p.subtotal_usd), 0);
  const activos = pedidos.filter((p) => !['servido', 'cancelado'].includes(p.estado)).length;

  return (
    <div className="con-menu min-h-screen bg-taupe-suave">
      {/* Header oficial Pranoa con logo blanco, Mesa y botón de perfil cliente */}
      <header className="sticky top-0 z-30 border-b border-ciruela/10 bg-taupe-claro/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          <button type="button" onClick={() => setVista('inicio')} aria-label="Inicio de mesa">
            <Logo color="#FFFFFF" className="h-9 sm:h-10" />
          </button>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-taupe-oscuro px-3 py-1 text-xs font-bold text-white shadow-sm">
              Mesa {nombre}
            </span>
            <button
              type="button"
              onClick={() => setHoja('cliente')}
              className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-white shadow-sm transition hover:scale-105"
              title={cliente ? `Perfil: ${cliente.nombre}` : 'Registro del cliente'}
            >
              <Image src="/iconos/icon-user.png" alt="Cliente" fill className="object-cover" />
            </button>
          </div>
        </div>
      </header>

      {/* Landing principal del QR de la mesa (jerarquía clara de acciones) */}
      {vista === 'inicio' ? (
        <main className="mx-auto max-w-4xl">
          {/* Banner principal con fachada y botones jerárquicos */}
          <section className="relative overflow-hidden bg-ciruela text-white shadow-md sm:mx-4 sm:mt-4 sm:rounded-3xl">
            <div className="relative min-h-[300px] sm:min-h-[360px]">
              <Image
                src="/marca/fachada-pranoa.jpg"
                alt="Pranoa, un refugio seguro"
                fill
                priority
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ciruela-oscuro/95 via-ciruela-oscuro/60 to-ciruela-oscuro/30" />

              <div className="relative z-10 flex min-h-[300px] flex-col justify-end px-5 pb-7 pt-10 sm:min-h-[360px] sm:px-8">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-oliva/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  Bienvenido a Mesa {nombre}
                </span>
                <h1 className="mt-2 text-2xl font-bold leading-tight drop-shadow sm:text-4xl">
                  {cliente ? `¡Hola, ${cliente.nombre}!` : 'Pranoa · un refugio seguro'}
                </h1>
                <p className="mt-1 max-w-lg text-sm text-crema/90">
                  Explora nuestra carta, sigue el estatus de tus platos en vivo o avísale a tu mesonero cuando lo necesites.
                </p>

                {/* JERARQUÍA NIVEL 1: Acciones principales (Menú y Estatus) */}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVista('menu')}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-naranja px-4 py-4 text-base font-bold text-white shadow-lg transition hover:bg-naranja-oscuro active:scale-[0.98]"
                  >
                    <span className="text-xl">🍽️</span>
                    <span>Menú</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { cargarPedidos(); setHoja('estatus'); }}
                    className="relative flex items-center justify-center gap-2 rounded-2xl bg-taupe-oscuro/90 px-4 py-4 text-base font-bold text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-taupe-oscuro active:scale-[0.98]"
                  >
                    <span className="text-xl">📋</span>
                    <span>Estatus</span>
                    {activos > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 rounded-full bg-naranja px-2 py-0.5 text-xs font-extrabold text-white ring-2 ring-white">
                        {activos}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* JERARQUÍA NIVEL 2 Y 3: Servicio en mesa + Registro del cliente */}
          <section className="space-y-3 px-4 pt-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHoja('mesonero')}
                className="tarjeta flex flex-col items-center justify-center gap-1.5 py-5 text-center transition hover:bg-crema/40 active:scale-[0.98]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-naranja/15 text-2xl">🔔</span>
                <span className="font-bold text-ciruela">Llamar mesonero</span>
                <span className="text-xs text-taupe">Enviar aviso o nota</span>
              </button>

              <button
                type="button"
                onClick={() => llamar('cuenta')}
                disabled={enviando}
                className="tarjeta flex flex-col items-center justify-center gap-1.5 py-5 text-center transition hover:bg-crema/40 active:scale-[0.98]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-oliva/15 text-2xl">🧾</span>
                <span className="font-bold text-ciruela">Pedir cuenta</span>
                <span className="text-xs text-taupe">
                  {totalMesa > 0 ? `Consumo: ${usd(totalMesa)}` : 'Solicitar recibo'}
                </span>
              </button>
            </div>

            {/* Nivel 3: Registro / Perfil del cliente */}
            <button
              type="button"
              onClick={() => setHoja('cliente')}
              className="tarjeta flex w-full items-center gap-3.5 text-left transition hover:bg-crema/40 active:scale-[0.99]"
            >
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-naranja/40">
                <Image src="/iconos/icon-user.png" alt="Registro cliente" fill className="object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ciruela">
                  {cliente ? `Mi perfil: ${cliente.nombre}` : 'Registro del cliente'}
                </p>
                <p className="text-xs text-taupe">
                  {cliente
                    ? 'Tus datos están guardados para ver tu estatus, facturar más rápido y pedir delivery.'
                    : 'Guarda tus datos para acceder a tus compras, pedir delivery y facturar sin esperas.'}
                </p>
              </div>
              <span className="text-lg font-bold text-oliva">›</span>
            </button>

            {/* Botón para ir a la landing principal con toda la información del restaurante */}
            <Link
              href="/"
              className="tarjeta flex w-full items-center gap-3.5 text-left transition hover:bg-crema/40 active:scale-[0.99]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-oliva/15 text-oliva">
                <Isotipo className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ciruela">Conoce Pranoa</p>
                <p className="text-xs text-taupe">
                  Horario, ubicación, reservas, delivery y toda la información del restaurante.
                </p>
              </div>
              <span className="text-lg font-bold text-oliva">›</span>
            </Link>

            {/* Acceso rápido a delivery si ya se registró */}
            {cliente && (
              <div className="tarjeta flex items-center justify-between gap-3 bg-oliva/10 ring-1 ring-oliva/20">
                <div className="text-sm">
                  <p className="font-semibold text-ciruela">¿Quieres pedir para llevar otro día?</p>
                  <p className="text-xs text-taupe">Con tu perfil ya tienes tus datos listos para delivery.</p>
                </div>
                <Link href="/delivery" className="btn-chico shrink-0 bg-oliva text-white">Delivery →</Link>
              </div>
            )}
          </section>
        </main>
      ) : (
        /* Vista completa del Menú interactivo */
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setVista('inicio')} className="text-sm font-semibold text-oliva">
              ← Volver a Mesa {nombre}
            </button>
            <button type="button" onClick={() => { cargarPedidos(); setHoja('estatus'); }} className="btn-chico bg-white text-xs ring-1 ring-ciruela/10">
              📋 Estatus ({activos})
            </button>
          </div>
          <CartaInteractiva
            categorias={categorias}
            productos={productos}
            tasa={tasa}
            onAgregar={(p) => carrito.agregar(p)}
            onQuitar={(p) => carrito.quitar(p.id)}
            cantidadDe={carrito.cantidadDe}
          />
        </div>
      )}

      {/* Botón flotante del carrito */}
      {carrito.unidades > 0 && (
        <button
          type="button"
          onClick={() => setHoja('carrito')}
          className="btn-naranja fixed inset-x-4 z-30 mx-auto max-w-md shadow-lg"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
        >
          Revisar y enviar ({carrito.unidades}) · {usd(carrito.total)}
        </button>
      )}

      {/* Toast de aviso */}
      {aviso && (
        <div className="fixed inset-x-4 top-16 z-[60] mx-auto max-w-md rounded-2xl bg-ciruela p-4 text-center text-sm font-medium text-crema shadow-lg" role="status">
          {aviso}
        </div>
      )}

      {/* Hoja: Carrito */}
      <Hoja abierta={hoja === 'carrito'} onCerrar={() => setHoja('')} titulo={`Tu pedido · Mesa ${nombre}`}>
        <ResumenCarrito items={carrito.items} cambiar={carrito.cambiar} tasa={tasa} />
        {carrito.unidades > 0 && (
          <>
            <input
              className="campo mt-3"
              placeholder="Nota para la cocina (opcional)"
              maxLength={300}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
            <button className="btn-primario mt-4 w-full" disabled={enviando} onClick={enviarPedido}>
              {enviando ? 'Enviando…' : 'Enviar pedido'}
            </button>
          </>
        )}
      </Hoja>

      {/* Hoja: Estatus en vivo de cada plato de la mesa */}
      <Hoja abierta={hoja === 'estatus'} onCerrar={() => setHoja('')} titulo={`Estatus · Mesa ${nombre}`}>
        {pedidos.length === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-taupe">Todavía no hay pedidos en esta mesa.</p>
            <button type="button" className="btn-naranja" onClick={() => { setHoja(''); setVista('menu'); }}>
              Ir al Menú
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pedidos.map((p) => (
              <div key={p.numero} className="rounded-xl bg-crema/70 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ciruela">Pedido #{p.numero} · {hora(p.created_at)}</span>
                  <span className="chip bg-oliva/15 text-oliva-oscuro">{ESTADO_TEXTO[p.estado]}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {p.items?.map((it, idx) => {
                    const sub = it.estado || (p.estado === 'servido' ? 'entregado' : p.estado === 'listo' ? 'retirar' : 'preparando');
                    const estilo =
                      sub === 'entregado'
                        ? 'bg-emerald-600 text-white'
                        : sub === 'retirar'
                          ? 'bg-amber-400 text-white'
                          : 'bg-red-600 text-white';
                    const texto =
                      sub === 'entregado'
                        ? 'Entregado'
                        : sub === 'retirar'
                          ? 'Listo en cocina'
                          : p.estado === 'por_aprobar'
                            ? 'Por confirmar'
                            : 'Preparando';
                    return (
                      <li key={idx} className="flex items-center justify-between gap-2 text-sm">
                        <span><b>{it.cantidad} ×</b> {it.nombre}</span>
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[0.68rem] font-bold ${estilo}`}>
                          {texto}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-ciruela/10 pt-3">
              <span className="font-semibold">Consumo de la mesa</span>
              <span className="text-right">
                <b className="text-lg">{usd(totalMesa)}</b>
                {tasa > 0 && <span className="block text-sm text-taupe">{bs(aBs(totalMesa, tasa))}</span>}
              </span>
            </div>
            <button type="button" className="btn-primario w-full" onClick={() => llamar('cuenta')}>
              🧾 Pedir la cuenta
            </button>
          </div>
        )}
      </Hoja>

      {/* Hoja: Llamar mesonero con nota opcional */}
      <Hoja abierta={hoja === 'mesonero'} onCerrar={() => setHoja('')} titulo={`Llamar mesonero · Mesa ${nombre}`}>
        <div className="space-y-3">
          <p className="text-sm text-taupe">
            Puedes enviar un llamado directo o escribir una nota para que el mesonero venga preparado.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['Agua / hielo', 'Servilletas', 'Cubiertos', 'Consulta sobre un plato'].map((rapida) => (
              <button
                key={rapida}
                type="button"
                onClick={() => setNotaMesonero(rapida)}
                className="chip border border-ciruela/15 bg-crema/70 py-1 text-xs hover:bg-crema"
              >
                {rapida}
              </button>
            ))}
          </div>
          <textarea
            className="campo"
            rows={3}
            maxLength={250}
            placeholder="Escribe una nota para el mesonero (opcional)…"
            value={notaMesonero}
            onChange={(e) => setNotaMesonero(e.target.value)}
          />
          <button
            type="button"
            disabled={enviando}
            onClick={() => llamar('mesonero', notaMesonero)}
            className="btn-naranja w-full"
          >
            {enviando ? 'Enviando aviso…' : '🔔 Enviar llamado al mesonero'}
          </button>
        </div>
      </Hoja>

      {/* Hoja: Registro del cliente */}
      <Hoja abierta={hoja === 'cliente'} onCerrar={() => setHoja('')} titulo="Registro del cliente">
        <form onSubmit={registrarCliente} className="space-y-3">
          <p className="text-sm text-taupe">
            Registra tus datos para tener tu perfil en Pranoa: podrás ver el estatus de tu mesa, agilizar tu factura y pedir delivery más rápido.
          </p>
          <div>
            <label className="etiqueta">Nombre completo *</label>
            <input
              className="campo"
              required
              minLength={2}
              placeholder="Ej: Ana García"
              value={formCli.nombre}
              onChange={(e) => setFormCli({ ...formCli, nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="etiqueta">Teléfono (WhatsApp) *</label>
            <input
              className="campo"
              required
              inputMode="tel"
              placeholder="0412 1234567"
              value={formCli.telefono}
              onChange={(e) => setFormCli({ ...formCli, telefono: e.target.value })}
            />
          </div>
          <div>
            <label className="etiqueta">Cédula / RIF</label>
            <input
              className="campo"
              placeholder="V-12345678"
              value={formCli.cedula}
              onChange={(e) => setFormCli({ ...formCli, cedula: e.target.value })}
            />
          </div>
          <div>
            <label className="etiqueta">Correo electrónico</label>
            <input
              className="campo"
              type="email"
              placeholder="tu@correo.com"
              value={formCli.correo}
              onChange={(e) => setFormCli({ ...formCli, correo: e.target.value })}
            />
          </div>
          <button className="btn-primario w-full" disabled={guardandoCli}>
            {guardandoCli ? 'Guardando perfil…' : cliente ? 'Actualizar mis datos' : 'Guardar mi perfil'}
          </button>
          {cliente && (
            <div className="flex gap-2 border-t border-ciruela/10 pt-3">
              <button
                type="button"
                className="btn-secundario flex-1 py-2 text-sm"
                onClick={() => { cargarPedidos(); setHoja('estatus'); }}
              >
                Ver estatus mesa
              </button>
              <Link href="/delivery" className="btn-naranja flex-1 py-2 text-sm">
                Pedir delivery
              </Link>
            </div>
          )}
        </form>
      </Hoja>

      <MenuInferior
        botones={[
          { href: `/mesa/${token}`, titulo: 'Inicio', icono: 'inicio', onClick: () => { setHoja(''); setVista('inicio'); } },
          { href: '#menu', titulo: 'Menú', icono: 'carta', onClick: () => { setHoja(''); setVista('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
          { href: '#estatus', titulo: 'Estatus', icono: 'bolsa', aviso: activos, onClick: () => { cargarPedidos(); setHoja('estatus'); } },
          { href: '#mesonero', titulo: 'Mesonero', icono: 'campana', onClick: () => setHoja('mesonero') },
          { href: '#cuenta', titulo: 'Cuenta', icono: 'cuenta', onClick: () => llamar('cuenta') },
        ]}
      />
    </div>
  );
}
