'use client';
import { useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { ALERGENOS } from '@/lib/formato';
import type { Categoria, Producto } from '@/lib/tipos';

export function EditorProducto({ producto, categorias, onListo }: { producto: Producto | null; categorias: Categoria[]; onListo: () => void }) {
  const [f, setF] = useState({
    nombre: producto?.nombre || '',
    descripcion: producto?.descripcion || '',
    precio_usd: producto ? String(producto.precio_usd) : '',
    costo_usd: producto?.costo_usd != null ? String(producto.costo_usd) : '',
    categoria_id: producto?.categoria_id || categorias[0]?.id || '',
    alergenos: producto?.alergenos || [],
    solo_salon: producto?.solo_salon || false,
    activo: producto?.activo !== false,
    orden: producto?.orden ?? 0,
    tiempo_prep_min: producto?.tiempo_prep_min != null ? String(producto.tiempo_prep_min) : '',
    foto_url: producto?.foto_url || '',
  });
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function subirFoto(archivo: File) {
    if (archivo.size > 5 * 1024 * 1024) { setError('La foto debe pesar menos de 5 MB.'); return; }
    setSubiendo(true);
    const sb = supabaseNavegador();
    const ext = archivo.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ruta = `productos/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from('menu').upload(ruta, archivo, { cacheControl: '31536000', contentType: archivo.type });
    setSubiendo(false);
    if (error) { setError(error.message); return; }
    setF({ ...f, foto_url: sb.storage.from('menu').getPublicUrl(ruta).data.publicUrl });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const datos = {
      nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null,
      precio_usd: Number(f.precio_usd), costo_usd: f.costo_usd === '' ? null : Number(f.costo_usd),
      categoria_id: f.categoria_id || null, alergenos: f.alergenos, solo_salon: f.solo_salon,
      activo: f.activo, orden: Number(f.orden) || 0,
      tiempo_prep_min: f.tiempo_prep_min === '' ? null : Math.max(1, Math.min(240, Number(f.tiempo_prep_min) || 15)),
      foto_url: f.foto_url || null,
    };
    const sb = supabaseNavegador();
    const { error } = producto ? await sb.from('productos').update(datos).eq('id', producto.id) : await sb.from('productos').insert(datos);
    if (error) { setError(error.message); return; }
    onListo();
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-crema">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {f.foto_url && <img src={f.foto_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <label className="btn-chico cursor-pointer bg-crema">
          {subiendo ? 'Subiendo…' : f.foto_url ? 'Cambiar foto' : 'Subir foto'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])} />
        </label>
      </div>
      <input className="campo" placeholder="Nombre" required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
      <textarea className="campo" placeholder="Descripción" rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div><label className="etiqueta">Precio $</label><input className="campo" inputMode="decimal" required value={f.precio_usd} onChange={(e) => setF({ ...f, precio_usd: e.target.value.replace(',', '.') })} /></div>
        <div><label className="etiqueta">Costo $</label><input className="campo" inputMode="decimal" value={f.costo_usd} onChange={(e) => setF({ ...f, costo_usd: e.target.value.replace(',', '.') })} /></div>
        <div><label className="etiqueta">Prep. (min)</label><input className="campo" type="number" min={1} max={240} placeholder="Ej: 15" value={f.tiempo_prep_min} onChange={(e) => setF({ ...f, tiempo_prep_min: e.target.value })} /></div>
        <div><label className="etiqueta">Orden</label><input className="campo" inputMode="numeric" value={f.orden} onChange={(e) => setF({ ...f, orden: Number(e.target.value) || 0 })} /></div>
      </div>
      {Number(f.costo_usd) > 0 && Number(f.precio_usd) > 0 && (
        <p className="text-sm text-taupe">Escandallo: margen de {Math.round((1 - Number(f.costo_usd) / Number(f.precio_usd)) * 100)}% · ganancia ${(Number(f.precio_usd) - Number(f.costo_usd)).toFixed(2)} por plato</p>
      )}
      <select className="campo" value={f.categoria_id} onChange={(e) => setF({ ...f, categoria_id: e.target.value })}>
        <option value="">Sin categoría</option>
        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <div>
        <p className="etiqueta">Alérgenos</p>
        <div className="flex flex-wrap gap-1.5">
          {ALERGENOS.map((a) => {
            const on = f.alergenos.includes(a);
            return <button type="button" key={a} onClick={() => setF({ ...f, alergenos: on ? f.alergenos.filter((x) => x !== a) : [...f.alergenos, a] })}
              className={`chip border py-1 ${on ? 'border-naranja bg-naranja text-white' : 'border-ciruela/15'}`}>{a}</button>;
          })}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.solo_salon} onChange={(e) => setF({ ...f, solo_salon: e.target.checked })} /> Solo en el restaurante (no va por delivery)</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Aparece en la carta</label>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primario w-full" disabled={subiendo}>Guardar</button>
    </form>
  );
}

export function EditorCategorias({ categorias, onCambio }: { categorias: Categoria[]; onCambio: () => void }) {
  const [nueva, setNueva] = useState('');
  const sb = supabaseNavegador();
  const actualizar = async (id: string, datos: Partial<Categoria>) => { await sb.from('categorias').update(datos).eq('id', id); onCambio(); };

  return (
    <div className="space-y-2">
      {categorias.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <input className="campo py-2" defaultValue={c.nombre} onBlur={(e) => e.target.value !== c.nombre && actualizar(c.id, { nombre: e.target.value })} />
          <input className="campo w-16 py-2" inputMode="numeric" defaultValue={c.orden} onBlur={(e) => actualizar(c.id, { orden: Number(e.target.value) || 0 })} aria-label="Orden" />
          <button className={`btn-chico ${c.activa ? 'bg-emerald-100' : 'bg-red-100'}`} onClick={() => actualizar(c.id, { activa: !c.activa })}>{c.activa ? 'Visible' : 'Oculta'}</button>
        </div>
      ))}
      <form className="flex gap-2 pt-2" onSubmit={async (e) => {
        e.preventDefault();
        if (!nueva.trim()) return;
        await sb.from('categorias').insert({ nombre: nueva.trim(), orden: categorias.length + 1 });
        setNueva('');
        onCambio();
      }}>
        <input className="campo py-2" placeholder="Nueva categoría" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <button className="btn-primario py-2">Añadir</button>
      </form>
    </div>
  );
}
