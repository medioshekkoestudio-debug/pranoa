'use client';
import { useMemo, useState } from 'react';
import type { Categoria, Producto } from '@/lib/tipos';
import { ALERGENOS, aBs, bs, usd } from '@/lib/formato';

interface Props {
  categorias: Categoria[];
  productos: Producto[];
  tasa: number;
  /** Sin esto la carta es solo para ver */
  onAgregar?: (p: Producto) => void;
  cantidadDe?: (id: string) => number;
  ocultarSoloSalon?: boolean;
  compacta?: boolean; // vista del personal: sin fotos grandes
}

export function CartaInteractiva({ categorias, productos, tasa, onAgregar, cantidadDe, ocultarSoloSalon, compacta }: Props) {
  const [sinAlergenos, setSinAlergenos] = useState<string[]>([]);
  const [verFiltros, setVerFiltros] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(
      (p) =>
        !(ocultarSoloSalon && p.solo_salon) &&
        !p.alergenos.some((a) => sinAlergenos.includes(a)) &&
        (!q || p.nombre.toLowerCase().includes(q) || (p.descripcion || '').toLowerCase().includes(q)),
    );
  }, [productos, sinAlergenos, ocultarSoloSalon, busqueda]);

  const grupos = categorias
    .map((c) => ({ ...c, productos: visibles.filter((p) => p.categoria_id === c.id) }))
    .filter((g) => g.productos.length);

  return (
    <div>
      {/* barra de categorías fija */}
      <div className="sticky top-0 z-20 -mx-4 bg-taupe-suave/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="flex gap-2">
          <input className="campo py-2" placeholder="Buscar un plato…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <button
            type="button"
            className={`btn-chico shrink-0 border ${sinAlergenos.length ? 'border-oliva bg-oliva text-white' : 'border-ciruela/20 bg-white'}`}
            onClick={() => setVerFiltros(!verFiltros)}
          >
            Alérgenos{sinAlergenos.length ? ` (${sinAlergenos.length})` : ''}
          </button>
        </div>
        {verFiltros && (
          <div className="mt-2 rounded-2xl bg-white p-3 text-sm shadow-sm">
            <p className="mb-2 text-taupe">Ocultar platos que contengan:</p>
            <div className="flex flex-wrap gap-2">
              {ALERGENOS.map((a) => {
                const activo = sinAlergenos.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setSinAlergenos(activo ? sinAlergenos.filter((x) => x !== a) : [...sinAlergenos, a])}
                    className={`chip border py-1 ${activo ? 'border-naranja bg-naranja text-white' : 'border-ciruela/15'}`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {grupos.map((g) => (
            <a key={g.id} href={`#cat-${g.id}`} className="chip shrink-0 bg-white py-1.5 text-sm ring-1 ring-ciruela/10">
              {g.nombre}
            </a>
          ))}
        </div>
      </div>

      {grupos.length === 0 && <p className="py-10 text-center text-taupe">No hay platos con ese filtro.</p>}

      {grupos.map((g) => (
        <section key={g.id} id={`cat-${g.id}`} className="scroll-mt-36 pt-5">
          <h2 className="mb-3 text-lg font-bold">{g.nombre}</h2>
          <div className={compacta ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-3 sm:grid-cols-2'}>
            {g.productos.map((p) => {
              const n = cantidadDe?.(p.id) || 0;
              return (
                <article key={p.id} className={`tarjeta flex gap-3 ${!p.disponible ? 'opacity-50' : ''} ${compacta ? 'p-3' : ''}`}>
                  {!compacta && (
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-crema-oscuro">
                      {p.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.foto_url} alt={p.nombre} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl text-oliva/40">🌿</div>
                      )}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="font-semibold leading-tight">{p.nombre}</h3>
                    {p.descripcion && !compacta && <p className="mt-0.5 line-clamp-2 text-sm text-taupe">{p.descripcion}</p>}
                    {p.alergenos.length > 0 && !compacta && (
                      <p className="mt-1 text-[0.7rem] text-taupe/80">Contiene: {p.alergenos.join(', ')}</p>
                    )}
                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <div>
                        <span className="font-bold text-oliva">{usd(p.precio_usd)}</span>
                        {tasa > 0 && <span className="ml-1.5 text-xs text-taupe">{bs(aBs(p.precio_usd, tasa))}</span>}
                      </div>
                      {!p.disponible ? (
                        <span className="chip bg-ciruela/10">Agotado</span>
                      ) : (
                        onAgregar && (
                          <button
                            type="button"
                            onClick={() => onAgregar(p)}
                            className="btn-chico bg-oliva px-4 text-white"
                            aria-label={`Agregar ${p.nombre}`}
                          >
                            {n > 0 ? `${n} · +` : 'Agregar'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
