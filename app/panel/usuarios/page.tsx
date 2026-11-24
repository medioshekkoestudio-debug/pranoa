'use client';
import { useCallback, useEffect, useState } from 'react';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { Hoja } from '@/components/Hoja';
import { usePerfil } from '../MarcoPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { NOMBRE_ROL, SECCIONES, type Rol } from '@/lib/permisos';
import type { Perfil } from '@/lib/tipos';

const ROLES = Object.keys(NOMBRE_ROL) as Rol[];

export default function Personal() {
  const yo = usePerfil();
  const [lista, setLista] = useState<Perfil[]>([]);
  const [correos, setCorreos] = useState<Record<string, string>>({});
  const [nuevo, setNuevo] = useState(false);
  const [clave, setClave] = useState<Perfil | null>(null);
  const [verPermisos, setVerPermisos] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabaseNavegador().from('perfiles').select('*').order('activo', { ascending: false }).order('nombre');
    setLista((data || []) as Perfil[]);
    const r = await fetch('/api/personal');
    if (r.ok) setCorreos(await r.json());
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function cambiar(p: Perfil, datos: Partial<Perfil>) {
    const { error } = await supabaseNavegador().from('perfiles').update(datos).eq('id', p.id);
    if (error) alert(error.message.replace(/^.*?ERROR:\s*/, ''));
    cargar();
  }

  return (
    <>
      <CabeceraPanel titulo="Personal">
        <button className="btn-chico bg-oliva text-white" onClick={() => setNuevo(true)}>+ Persona</button>
      </CabeceraPanel>
      <main className="mx-auto max-w-3xl space-y-3 px-4 pt-4">
        <button className="text-sm font-semibold text-oliva" onClick={() => setVerPermisos(true)}>¿Qué puede hacer cada perfil?</button>
        {lista.map((p) => (
          <div key={p.id} className={`tarjeta ${!p.activo ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{p.nombre} {p.id === yo.id && <span className="text-xs text-taupe">(tú)</span>}</p>
                <p className="truncate text-sm text-taupe">{correos[p.id] ? `Usuario: ${correos[p.id]}` : ''}{p.telefono ? ` · ${p.telefono}` : ''}</p>
              </div>
              <select className="rounded-full border border-ciruela/15 bg-white px-3 py-1.5 text-sm" value={p.rol} disabled={p.id === yo.id}
                onChange={(e) => cambiar(p, { rol: e.target.value as Rol })}>
                {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
              </select>
            </div>
            {p.id !== yo.id && (
              <div className="mt-2 flex gap-2">
                <button className="btn-chico bg-crema" onClick={() => setClave(p)}>Nueva contraseña</button>
                <button className={p.activo ? 'btn-peligro py-1' : 'btn-chico bg-emerald-100'} onClick={() => cambiar(p, { activo: !p.activo })}>
                  {p.activo ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>
            )}
          </div>
        ))}
      </main>

      <Hoja abierta={nuevo} onCerrar={() => setNuevo(false)} titulo="Nueva persona">
        <FormNuevo onListo={() => { setNuevo(false); cargar(); }} />
      </Hoja>
      <Hoja abierta={!!clave} onCerrar={() => setClave(null)} titulo={`Contraseña de ${clave?.nombre ?? ''}`}>
        {clave && <FormClave id={clave.id} onListo={() => setClave(null)} />}
      </Hoja>
      <Hoja abierta={verPermisos} onCerrar={() => setVerPermisos(false)} titulo="Permisos por perfil">
        <div className="space-y-3 text-sm">
          {ROLES.map((r) => (
            <div key={r}>
              <p className="font-bold">{NOMBRE_ROL[r]}</p>
              <p className="text-taupe">{SECCIONES.filter((s) => s.roles.includes(r) && s.ruta !== '/panel/mas').map((s) => s.titulo).join(' · ')}</p>
            </div>
          ))}
          <p className="rounded-xl bg-crema p-3 text-xs">
            Mesonero: toma pedidos, confirma los del QR, divide cuentas y marca servido; puede cancelar solo antes de que cocina empiece.
            Cocina: mueve pedidos en el tablero y apaga platos agotados. Caja: cobra, verifica pagos, fija la tasa, confirma deliveries y asigna motorizado.
            Motorizado: solo ve sus entregas. Administrador: todo, incluidos costos, reportes y personal.
          </p>
        </div>
      </Hoja>
    </>
  );
}

function FormNuevo({ onListo }: { onListo: () => void }) {
  const [f, setF] = useState({ nombre: '', usuario: '', clave: '', rol: 'mesonero' as Rol, telefono: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setEnviando(true); setError('');
      const r = await fetch('/api/personal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const d = await r.json();
      setEnviando(false);
      if (!r.ok) { setError(d.error); return; }
      onListo();
    }}>
      <input className="campo" placeholder="Nombre" required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
      <input className="campo" placeholder="Usuario (ej. mesonero2_pranoa)" required autoCapitalize="none" autoCorrect="off" spellCheck={false}
        pattern="[A-Za-z0-9._\-]{3,40}" title="Letras, números, punto, guion o guion bajo; sin espacios"
        value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value.trim() })} />
      <input className="campo" placeholder="Teléfono (opcional)" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
      <input className="campo" placeholder="Contraseña (mín. 8)" required minLength={8} value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} />
      <select className="campo" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })}>
        {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
      </select>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primario w-full" disabled={enviando}>{enviando ? 'Creando…' : 'Crear cuenta'}</button>
    </form>
  );
}

function FormClave({ id, onListo }: { id: string; onListo: () => void }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const r = await fetch('/api/personal', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, clave }) });
      if (!r.ok) { setError((await r.json()).error); return; }
      alert('Contraseña cambiada. Pásasela a la persona.');
      onListo();
    }}>
      <input className="campo" placeholder="Nueva contraseña (mín. 8)" required minLength={8} value={clave} onChange={(e) => setClave(e.target.value)} />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primario w-full">Guardar</button>
    </form>
  );
}
