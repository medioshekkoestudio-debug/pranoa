'use client';
import { useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/cliente';

export function FormEntrar() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    const sb = supabaseNavegador();
    const { error } = await sb.auth.signInWithPassword({ email: correo.trim(), password: clave });
    if (error) {
      setError(error.message.includes('Invalid') ? 'Correo o contraseña incorrectos.' : error.message);
      setCargando(false);
      return;
    }
    // recarga completa para que el servidor lea la sesión nueva
    window.location.href = '/panel';
  }

  return (
    <form onSubmit={entrar} className="space-y-3">
      <div>
        <label className="etiqueta" htmlFor="correo">Correo</label>
        <input id="correo" type="email" className="campo" required autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
      </div>
      <div>
        <label className="etiqueta" htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" className="campo" required autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primario w-full" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
