'use client';
// El evento beforeinstallprompt llega UNA vez y muy temprano: se escucha desde el layout raíz
// y se guarda aquí para que cualquier botón «Descargar la app» lo use después.
// En iPhone no existe: se muestra la indicación de Compartir → Añadir a pantalla de inicio.

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let guardado: EventoInstalar | null = null;
const oyentes = new Set<() => void>();

export function iniciarPwa() {
  if (typeof window === 'undefined') return;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    guardado = e as EventoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    guardado = null;
    oyentes.forEach((f) => f());
  });
}

export const puedeInstalar = () => !!guardado;
export const esIos = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
export const yaInstalada = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export async function instalar() {
  if (!guardado) return false;
  await guardado.prompt();
  const r = await guardado.userChoice;
  guardado = null;
  oyentes.forEach((f) => f());
  return r.outcome === 'accepted';
}

export function alCambiar(f: () => void) {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}
