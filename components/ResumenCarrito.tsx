'use client';
import type { ItemCarrito } from '@/lib/tipos';
import { aBs, bs, usd } from '@/lib/formato';

/** Lista editable de lo que se va a pedir */
export function ResumenCarrito({
  items, cambiar, tasa, conComensal = false,
}: {
  items: ItemCarrito[];
  cambiar: (i: number, c: Partial<ItemCarrito>) => void;
  tasa: number;
  conComensal?: boolean;
}) {
  if (!items.length) return <p className="py-6 text-center text-taupe">Aún no has agregado platos.</p>;
  const total = items.reduce((s, x) => s + x.precio_usd * x.cantidad, 0);
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl bg-crema/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{it.nombre}</p>
              <p className="text-sm text-taupe">{usd(it.precio_usd * it.cantidad)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="h-8 w-8 rounded-full bg-white text-lg font-bold ring-1 ring-ciruela/15" onClick={() => cambiar(i, { cantidad: it.cantidad - 1 })} aria-label="Quitar uno">−</button>
              <span className="w-5 text-center font-semibold">{it.cantidad}</span>
              <button type="button" className="h-8 w-8 rounded-full bg-white text-lg font-bold ring-1 ring-ciruela/15" onClick={() => cambiar(i, { cantidad: Math.min(50, it.cantidad + 1) })} aria-label="Agregar uno">+</button>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="campo py-1.5 text-sm"
              placeholder="Nota (sin cebolla, término…)"
              value={it.notas || ''}
              maxLength={200}
              onChange={(e) => cambiar(i, { notas: e.target.value })}
            />
            {conComensal && (
              <select
                className="campo w-28 py-1.5 text-sm"
                value={it.comensal || 1}
                onChange={(e) => cambiar(i, { comensal: Number(e.target.value) })}
                aria-label="Comensal"
              >
                {Array.from({ length: 12 }, (_, n) => n + 1).map((n) => <option key={n} value={n}>Puesto {n}</option>)}
              </select>
            )}
          </div>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t border-ciruela/10 pt-3">
        <span className="font-semibold">Total</span>
        <span className="text-right">
          <span className="text-lg font-bold">{usd(total)}</span>
          {tasa > 0 && <span className="block text-sm text-taupe">{bs(aBs(total, tasa))}</span>}
        </span>
      </div>
    </div>
  );
}
