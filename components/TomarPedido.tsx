'use client';
import { useEffect, useState } from 'react';
import { CartaInteractiva } from './CartaInteractiva';
import { ResumenCarrito } from './ResumenCarrito';
import { paraEnviar, useCarrito } from '@/lib/carrito';
import { rpc } from '@/lib/acciones';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { usd } from '@/lib/formato';
import type { Categoria, Producto } from '@/lib/tipos';

/** Comandera: el mesonero arma el pedido por puesto y lo manda directo a cocina */
export function TomarPedido({ mesaId, tasa, onListo }: { mesaId: string; tasa: number; onListo: () => void }) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [puesto, setPuesto] = useState(1);
  const [verCarrito, setVerCarrito] = useState(false);
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const carrito = useCarrito('comandera', false);

  useEffect(() => {
    const sb = supabaseNavegador();
    Promise.all([
      sb.from('categorias').select('*').eq('activa', true).order('orden'),
      sb.from('productos_publicos').select('*').order('orden'),
    ]).then(([c, p]) => { setCategorias((c.data || []) as Categoria[]); setProductos((p.data || []) as Producto[]); });
  }, []);

  async function enviar() {
    setEnviando(true);
    const { error } = await rpc('crear_pedido_personal', { p_mesa: mesaId, p_items: paraEnviar(carrito.items), p_notas: notas || null });
    setEnviando(false);
    if (error) { alert(error); return; }
    carrito.vaciar();
    onListo();
  }

  if (verCarrito) {
    return (
      <div>
        <ResumenCarrito items={carrito.items} cambiar={carrito.cambiar} tasa={tasa} conComensal />
        <input className="campo mt-3" placeholder="Nota general para cocina" value={notas} onChange={(e) => setNotas(e.target.value)} />
        <div className="mt-4 flex gap-2">
          <button className="btn-secundario" onClick={() => setVerCarrito(false)}>Seguir agregando</button>
          <button className="btn-primario flex-1" disabled={enviando || !carrito.unidades} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar a cocina'}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm">
        <span className="text-taupe">Agregando al puesto:</span>
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" onClick={() => setPuesto(n)}
              className={`h-8 w-8 shrink-0 rounded-full text-sm font-bold ${puesto === n ? 'bg-naranja text-white' : 'bg-crema'}`}>{n}</button>
          ))}
        </div>
      </div>
      <CartaInteractiva categorias={categorias} productos={productos} tasa={tasa} compacta
        onAgregar={(p) => carrito.agregar(p, puesto)} cantidadDe={carrito.cantidadDe} />
      {carrito.unidades > 0 && (
        <button className="btn-naranja sticky bottom-0 mt-4 w-full shadow-lg" onClick={() => setVerCarrito(true)}>
          Revisar ({carrito.unidades}) · {usd(carrito.total)}
        </button>
      )}
    </div>
  );
}
