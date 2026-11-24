// Fuente única de qué ve cada perfil. La base de datos aplica las mismas reglas
// (RLS y funciones en supabase/migrations/0001_inicial.sql); esto solo ordena la interfaz.

export type Rol = 'admin' | 'cajero' | 'mesonero' | 'cocina' | 'motorizado';

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  cajero: 'Caja',
  mesonero: 'Mesonero',
  cocina: 'Cocina',
  motorizado: 'Motorizado',
};

export type Icono =
  | 'inicio' | 'mesas' | 'cocina' | 'caja' | 'delivery' | 'reservas' | 'carta' | 'mas' | 'entregas'
  | 'perfil' | 'usuarios' | 'qr' | 'zonas' | 'ajustes' | 'reportes' | 'campana' | 'contacto' | 'cuenta' | 'bolsa';

export interface Seccion {
  ruta: string;
  titulo: string;
  icono: Icono;
  roles: Rol[];
}

// Todas las secciones del panel y quién entra
export const SECCIONES: Seccion[] = [
  { ruta: '/panel/resumen', titulo: 'Resumen', icono: 'reportes', roles: ['admin'] },
  { ruta: '/panel/mesas', titulo: 'Mesas', icono: 'mesas', roles: ['admin', 'cajero', 'mesonero'] },
  { ruta: '/panel/cocina', titulo: 'Cocina', icono: 'cocina', roles: ['admin', 'cocina'] },
  { ruta: '/panel/caja', titulo: 'Caja', icono: 'caja', roles: ['admin', 'cajero'] },
  { ruta: '/panel/delivery', titulo: 'Delivery', icono: 'delivery', roles: ['admin', 'cajero'] },
  { ruta: '/panel/entregas', titulo: 'Entregas', icono: 'entregas', roles: ['motorizado'] },
  { ruta: '/panel/reservas', titulo: 'Reservas', icono: 'reservas', roles: ['admin', 'cajero', 'mesonero'] },
  { ruta: '/panel/carta', titulo: 'Carta', icono: 'carta', roles: ['admin', 'cajero', 'mesonero', 'cocina'] },
  { ruta: '/panel/usuarios', titulo: 'Personal', icono: 'usuarios', roles: ['admin'] },
  { ruta: '/panel/config-mesas', titulo: 'Mesas y QR', icono: 'qr', roles: ['admin'] },
  { ruta: '/panel/zonas', titulo: 'Zonas de delivery', icono: 'zonas', roles: ['admin'] },
  { ruta: '/panel/ajustes', titulo: 'Ajustes', icono: 'ajustes', roles: ['admin'] },
  { ruta: '/panel/mas', titulo: 'Más', icono: 'mas', roles: ['admin', 'cajero', 'mesonero', 'cocina', 'motorizado'] },
];

// Menú inferior de la app por perfil (máximo 5 botones). Lo demás va en «Más».
export const MENU_INFERIOR: Record<Rol, string[]> = {
  admin: ['/panel/resumen', '/panel/mesas', '/panel/cocina', '/panel/caja', '/panel/mas'],
  cajero: ['/panel/caja', '/panel/mesas', '/panel/delivery', '/panel/reservas', '/panel/mas'],
  mesonero: ['/panel/mesas', '/panel/reservas', '/panel/carta', '/panel/mas'],
  cocina: ['/panel/cocina', '/panel/carta', '/panel/mas'],
  motorizado: ['/panel/entregas', '/panel/mas'],
};

export const INICIO_ROL: Record<Rol, string> = {
  admin: '/panel/resumen',
  cajero: '/panel/caja',
  mesonero: '/panel/mesas',
  cocina: '/panel/cocina',
  motorizado: '/panel/entregas',
};

export function seccionDe(ruta: string): Seccion | undefined {
  return SECCIONES.filter((s) => ruta === s.ruta || ruta.startsWith(s.ruta + '/'))
    .sort((a, b) => b.ruta.length - a.ruta.length)[0];
}

export function puedeEntrar(rol: Rol, ruta: string): boolean {
  const s = seccionDe(ruta);
  return !!s && s.roles.includes(rol);
}

export function menuDe(rol: Rol): Seccion[] {
  return MENU_INFERIOR[rol].map((r) => SECCIONES.find((s) => s.ruta === r)!).filter(Boolean);
}

/** Secciones que no caben en el menú inferior y van en «Más» */
export function extrasDe(rol: Rol): Seccion[] {
  return SECCIONES.filter((s) => s.roles.includes(rol) && !MENU_INFERIOR[rol].includes(s.ruta) && s.ruta !== '/panel/mas');
}
