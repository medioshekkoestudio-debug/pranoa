import { NextResponse } from 'next/server';
import { perfilActual, supabaseServicio } from '@/lib/supabase/servidor';
import type { Rol } from '@/lib/permisos';

const ROLES: Rol[] = ['admin', 'cajero', 'mesonero', 'cocina', 'motorizado'];

// Solo un administrador crea cuentas del personal o cambia contraseñas.
// El registro público de Supabase debe estar DESACTIVADO (ver LEEME.md).
async function soloAdmin() {
  const p = await perfilActual();
  return p?.rol === 'admin' ? p : null;
}

export async function POST(req: Request) {
  if (!(await soloAdmin())) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { nombre, correo, clave, rol, telefono } = await req.json();
  if (!nombre?.trim() || !correo?.trim() || !ROLES.includes(rol)) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  if (!clave || String(clave).length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });

  const sb = supabaseServicio();
  const { data, error } = await sb.auth.admin.createUser({ email: correo.trim().toLowerCase(), password: clave, email_confirm: true });
  if (error || !data.user) {
    const msg = error?.message?.includes('already') ? 'Ya existe una cuenta con ese correo' : error?.message || 'No se pudo crear';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { error: e2 } = await sb.from('perfiles').insert({ id: data.user.id, nombre: nombre.trim(), rol, telefono: telefono?.trim() || null });
  if (e2) {
    await sb.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: e2.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!(await soloAdmin())) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  const { id, clave } = await req.json();
  if (!id || !clave || String(clave).length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  const { error } = await supabaseServicio().auth.admin.updateUserById(id, { password: clave });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!(await soloAdmin())) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  // correos de las cuentas (no están en perfiles)
  const { data, error } = await supabaseServicio().auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(Object.fromEntries(data.users.map((u) => [u.id, u.email])));
}
