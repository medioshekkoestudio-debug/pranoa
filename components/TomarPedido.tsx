'use client';
import { useEffect, useMemo, useState } from 'react';
import { CartaInteractiva } from './CartaInteractiva';
import { ResumenCarrito } from './ResumenCarrito';
import { paraEnviar, useCarrito } from '@/lib/carrito';
import { rpc } from '@/lib/acciones';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { usd } from '@/lib/formato';
import type { Categoria, ItemCarrito, Pedido, Producto } from '@/lib/tipos';

/** Comandera: el mesonero arma un pedido nuevo o edita uno ya enviado a cocina y notifica la actualización */
export function TomarPedido({
  mesaId,
  capacidad = 6,
  tasa,
  pedidoEditar,
  onListo,
}: {
  mesaId: string;
  capacidad?: number;
  tasa: number;
  pedidoEditar?: Pedido | null;
  onListo: () => void;
}) {
  const iniciales = useMemo<ItemCarrito[]>(() => {
    if (!pedidoEditar?.pedido_items) return [];
    return pedidoEditar.pedido_items
      .filter((i) => !!i.producto_id)
      .map((i) => ({
        producto_id: i.producto_id!,
        nombre: i.nombre,
        precio_usd: Number(i.precio_usd),
        cantidad: i.cantidad,
        notas: i.notas || '',
        comensal: i.comensal || 1,
      }));
  }, [pedidoEditar]);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [puesto, setPuesto] = useState(1);
  const [maxPuestos, setMaxPuestos] = useState(
    Math.max(1, capacidad, ...iniciales.map((x) => x.comensal || 1)),
  );
  const [verCarrito, setVerCarrito] = useState(!!pedidoEditar);
  const [notas, setNotas] = useState(pedidoEditar?.notas || '');
  const [enviando, setEnviando] = useState(false);
  const carrito = useCarrito(`comandera-${pedidoEditar?.id || 'nuevo'}`, false, iniciales);

  useEffect(() => {
    setMaxPuestos((prev) => Math.max(prev, Math.max(1, capacidad)));
  }, [capacidad]);

  useEffect(() => {
    const sb = supabaseNavegador();
    Promise.all([
      sb.from('categorias').select('*').eq('activa', true).order('orden'),
      sb.from('productos_publicos').select('*').order('orden'),
    ]).then(([c, p]) => {
      setCategorias((c.data || []) as Categoria[]);
      setProductos((p.data || []) as Producto[]);
    });
  }, []);

  async function enviar() {
    setEnviando(true);
    const { error } = pedidoEditar
      ? await rpc('editar_pedido_personal', {
          p_pedido: pedidoEditar.id,
          p_items: paraEnviar(carrito.items),
          p_notas: notas || null,
        })
      : await rpc('crear_pedido_personal', {
          p_mesa: mesaId,
          p_items: paraEnviar(carrito.items),
          p_notas: notas || null,
        });
    setEnviando(false);
    if (error) { alert(error); return; }
    carrito.vaciar();
    onListo();
  }

  if (verCarrito) {
    return (
      <div>
        {pedidoEditar && (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
            Editando pedido #{pedidoEditar.numero}. Al guardar se enviará una notificación inmediata a cocina con los cambios y notas.
          </p>
        )}
        <ResumenCarrito items={carrito.items} cambiar={carrito.cambiar} tasa={tasa} conComensal maxComensales={maxPuestos} />
        <label className="etiqueta mt-3">Nota general del pedido para cocina</label>
        <input
          className="campo"
          placeholder="Ej: Sin salsa, prioridad mesa, cambio de plato…"
          maxLength={300}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-secundario" onClick={() => setVerCarrito(false)}>
            {pedidoEditar ? '+ Agregar / quitar platos' : 'Seguir agregando'}
          </button>
          <button
            type="button"
            className="btn-primario flex-1"
            disabled={enviando || !carrito.unidades}
            onClick={enviar}
          >
            {enviando
              ? 'Enviando…'
              : pedidoEditar
                ? 'Guardar y notificar cocina'
                : 'Enviar a cocina'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm">
        <span className="text-taupe">Agregando al puesto:</span>
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {Array.from({ length: maxPuestos }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" onClick={() => setPuesto(n)}
              className={`h-8 w-8 shrink-0 rounded-full text-sm font-bold ${puesto === n ? 'bg-naranja text-white' : 'bg-crema'}`}>{n}</button>
          ))}
          {maxPuestos < 30 && (
            <button
              type="button"
              onClick={() => { const sig = maxPuestos + 1; setMaxPuestos(sig); setPuesto(sig); }}
              className="h-8 shrink-0 rounded-full border border-dashed border-oliva/50 px-2.5 text-xs font-bold text-oliva"
              title="Agregar puesto adicional"
            >
              + Puesto
            </button>
          )}
        </div>
      </div>
      <CartaInteractiva
        categorias={categorias}
        productos={productos}
        tasa={tasa}
        compacta
        onAgregar={(p) => carrito.agregar(p, puesto)}
        onQuitar={(p) => carrito.quitar(p.id, puesto)}
        cantidadDe={carrito.cantidadDe}
      />
      {carrito.unidades > 0 && (
        <button type="button" className="btn-naranja sticky bottom-0 mt-4 w-full shadow-lg" onClick={() => setVerCarrito(true)}>
          Revisar ({carrito.unidades}) · {usd(carrito.total)}
        </button>
      )}
    </div>
  );
}
