'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CabeceraPanel } from '@/components/CabeceraPanel';
import { Icono } from '@/components/Icono';
import { BotonDescargar } from '@/components/Pwa';
import { usePerfil } from '../MarcoPanel';
import { supabaseNavegador } from '@/lib/supabase/cliente';
import { NOMBRE_ROL, extrasDe } from '@/lib/permisos';
import { sonar } from '@/lib/tiempoReal';

export default function Mas() {
  const perfil = usePerfil();
  const extras = extrasDe(perfil.rol);
  const [permiso, setPermiso] = useState<string>('default');
  const [clave, setClave] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { if (typeof Notification !== 'undefined') setPermiso(Notification.permission); }, []);

  async function activarAvisos() {
    sonar('listo'); // también desbloquea el sonido en el navegador
    if (typeof Notification === 'undefined') { setMsg('Este teléfono no permite avisos. En iPhone, primero descarga la app.'); return; }
    setPermiso(await Notification.requestPermission());
  }

  async function cambiarClave(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabaseNavegador().auth.updateUser({ password: clave });
    setMsg(error ? error.message : 'Contraseña cambiada.');
    setClave('');
  }

  async function salir() {
    await supabaseNavegador().auth.signOut();
    window.location.href = '/entrar';
  }

  return (
    <>
      <CabeceraPanel titulo="Más" />
      <main className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        <div className="tarjeta">
          <p className="text-lg font-bold">{perfil.nombre}</p>
          <p className="text-sm text-taupe">{NOMBRE_ROL[perfil.rol]}</p>
        </div>

        {extras.length > 0 && (
          <nav className="tarjeta divide-y divide-ciruela/10 p-0">
            {extras.map((s) => (
              <Link key={s.ruta} href={s.ruta} className="flex items-center gap-3 px-4 py-3.5 hover:bg-crema/50">
                <Icono nombre={s.icono} className="h-5 w-5 text-oliva" />
                <span className="flex-1 font-medium">{s.titulo}</span>
                <span className="text-taupe">›</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="tarjeta space-y-3">
          <p className="font-bold">Avisos y sonido</p>
          <p className="text-sm text-taupe">
            {permiso === 'granted' ? 'Avisos activados. Deja la app abierta durante el servicio.' : 'Actívalos para enterarte de pedidos nuevos, platos listos y llamadas de mesa.'}
          </p>
          <button className="btn-secundario w-full" onClick={activarAvisos}>{permiso === 'granted' ? 'Probar sonido' : 'Activar avisos'}</button>
          <BotonDescargar className="btn-primario w-full" />
        </div>

        <form onSubmit={cambiarClave} className="tarjeta space-y-2">
          <p className="font-bold">Cambiar mi contraseña</p>
          <input className="campo" type="password" placeholder="Nueva contraseña (mín. 8)" minLength={8} required value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" />
          <button className="btn-secundario w-full">Guardar</button>
        </form>
        {msg && <p className="text-center text-sm text-taupe">{msg}</p>}

        <button className="btn-peligro w-full py-3" onClick={salir}>Cerrar sesión</button>
      </main>
    </>
  );
}
