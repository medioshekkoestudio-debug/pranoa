'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CartaInteractiva } from '@/components/CartaInteractiva';
import { ResumenCarrito } from '@/components/ResumenCarrito';
import { Hoja } from '@/components/Hoja';
import { paraEnviar, useCarrito } from '@/lib/carrito';
import { useProductosVivos } from '@/lib/useProductosVivos';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { aBs, bs, mensajeError, usd } from '@/lib/formato';
import type { Ajustes, Categoria, Producto, Zona } from '@/lib/tipos';

type Metodo = 'pago_movil' | 'zelle' | 'efectivo' | 'punto';

export function Delivery({ categorias, productosIniciales, zonas, ajustes }: {
  categorias: Categoria[]; productosIniciales: Producto[]; zonas: Zona[]; ajustes: Ajustes;
}) {
  const productos = useProductosVivos(productosIniciales);
  const carrito = useCarrito('pranoa-carrito-delivery');
  const router = useRouter();
  const tasa = Number(ajustes.tasa_bs);
  const [abierta, setAbierta] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [f, setF] = useState({ nombre: '', telefono: '', zona: '', direccion: '', notas: '', referencia: '' });

  // Precargar datos si el cliente ya se registró desde el QR de una mesa
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pranoa-cliente-perfil');
      if (raw) {
        const c = JSON.parse(raw) as { nombre?: string; telefono?: string };
        setF((prev) => ({
          ...prev,
          nombre: prev.nombre || c.nombre || '',
          telefono: prev.telefono || c.telefono || '',
        }));
      }
    } catch { /* modo privado */ }
  }, []);
  const [metodo, setMetodo] = useState<Metodo>('pago_movil');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const zona = zonas.find((z) => z.id === f.zona);
  const envio = zona ? Number(zona.tarifa_usd) : 0;
  const total = carrito.total + envio;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const notasPago = metodo === 'efectivo' ? 'Paga en efectivo al recibir' : metodo === 'punto' ? 'Paga con punto al recibir' : '';
      const { data, error } = await supabaseNavegador().rpc('crear_pedido_delivery', {
        p_nombre: f.nombre,
        p_telefono: f.telefono,
        p_direccion: f.direccion,
        p_zona: f.zona,
        p_items: paraEnviar(carrito.items),
        p_notas: [notasPago, f.notas].filter(Boolean).join(' · ') || null,
        p_metodo: metodo === 'pago_movil' || metodo === 'zelle' ? metodo : null,
        p_referencia: f.referencia || null,
      });
      if (error) throw error;
      carrito.vaciar();
      router.push(`/pedido/${data}`);
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }) });

  return (
    <>
      <CartaInteractiva
        categorias={categorias}
        productos={productos}
        tasa={tasa}
        onAgregar={(p) => carrito.agregar(p)}
        onQuitar={(p) => carrito.quitar(p.id)}
        cantidadDe={carrito.cantidadDe}
        ocultarSoloSalon
      />

      {carrito.unidades > 0 && (
        <button
          type="button"
          onClick={() => { setPaso(1); setAbierta(true); }}
          className="btn-naranja fixed inset-x-4 z-30 mx-auto max-w-md shadow-lg"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
        >
          Ver mi pedido ({carrito.unidades}) · {usd(carrito.total)}
        </button>
      )}

      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={paso === 1 ? 'Tu pedido' : 'Datos de entrega'}>
        {paso === 1 ? (
          <>
            <ResumenCarrito items={carrito.items} cambiar={carrito.cambiar} tasa={tasa} />
            {carrito.unidades > 0 && (
              <button className="btn-primario mt-5 w-full" onClick={() => setPaso(2)}>Continuar</button>
            )}
          </>
        ) : (
          <form onSubmit={enviar} className="space-y-3">
            <div>
              <label className="etiqueta" htmlFor="d-nombre">Nombre</label>
              <input id="d-nombre" className="campo" required minLength={2} autoComplete="name" {...campo('nombre')} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="d-tel">Teléfono (WhatsApp)</label>
              <input id="d-tel" className="campo" required inputMode="tel" autoComplete="tel" placeholder="0412 1234567" {...campo('telefono')} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="d-zona">Zona de entrega</label>
              <select id="d-zona" className="campo" required {...campo('zona')}>
                <option value="">Elige tu zona…</option>
                {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre} · envío {usd(z.tarifa_usd)}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="d-dir">Dirección exacta</label>
              <textarea id="d-dir" className="campo" required minLength={8} rows={2} placeholder="Urbanización, calle, casa o edificio, punto de referencia" {...campo('direccion')} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="d-notas">Indicaciones (opcional)</label>
              <input id="d-notas" className="campo" maxLength={200} {...campo('notas')} />
            </div>

            <div>
              <p className="etiqueta">¿Cómo vas a pagar?</p>
              <div className="grid grid-cols-2 gap-2">
                {([['pago_movil', 'Pago Móvil'], ['zelle', 'Zelle'], ['efectivo', 'Efectivo al recibir'], ['punto', 'Punto al recibir']] as [Metodo, string][]).map(([v, t]) => (
                  <button type="button" key={v} onClick={() => setMetodo(v)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${metodo === v ? 'border-oliva bg-oliva text-white' : 'border-ciruela/15 bg-white'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {(metodo === 'pago_movil' || metodo === 'zelle') && (
              <div className="rounded-xl bg-crema p-3 text-sm">
                <p className="font-semibold">
                  Paga {metodo === 'pago_movil' ? bs(aBs(total, tasa)) : usd(total)} a:
                </p>
                <p className="mt-1 whitespace-pre-line text-taupe">
                  {(metodo === 'pago_movil' ? ajustes.pago_movil_datos : ajustes.zelle_datos) || 'Te enviaremos los datos por WhatsApp.'}
                </p>
                <label className="etiqueta mt-3" htmlFor="d-ref">Número de referencia</label>
                <input id="d-ref" className="campo" required minLength={4} inputMode={metodo === 'pago_movil' ? 'numeric' : 'text'} {...campo('referencia')} />
              </div>
            )}

            <div className="space-y-1 border-t border-ciruela/10 pt-3 text-sm">
              <div className="flex justify-between"><span>Platos</span><span>{usd(carrito.total)}</span></div>
              <div className="flex justify-between"><span>Envío</span><span>{zona ? usd(envio) : '—'}</span></div>
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{usd(total)}</span></div>
              {tasa > 0 && <p className="text-right text-taupe">{bs(aBs(total, tasa))}</p>}
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn-secundario" onClick={() => setPaso(1)}>Atrás</button>
              <button className="btn-primario flex-1" disabled={enviando}>{enviando ? 'Enviando…' : 'Confirmar pedido'}</button>
            </div>
          </form>
        )}
      </Hoja>
    </>
  );
}
