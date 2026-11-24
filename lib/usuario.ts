// El personal entra con un usuario (sin correo). Supabase exige correo, así que por dentro
// cada usuario se guarda como <usuario>@pranoa.local. Nadie recibe correos en esa dirección.
export const DOMINIO_INTERNO = 'pranoa.local';

export function usuarioACorreo(usuario: string) {
  const u = usuario.trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${DOMINIO_INTERNO}`;
}

export function correoAUsuario(correo: string | undefined | null) {
  if (!correo) return '';
  return correo.endsWith('@' + DOMINIO_INTERNO) ? correo.slice(0, -(DOMINIO_INTERNO.length + 1)) : correo;
}

export const usuarioValido = (u: string) => /^[a-z0-9._-]{3,40}$/.test(u.trim().toLowerCase());
