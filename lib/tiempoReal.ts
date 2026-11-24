'use client';
import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabaseNavegador } from './supabase/cliente';

type Cambio = RealtimePostgresChangesPayload<Record<string, unknown>> & { table: string };

/**
 * Escucha cambios de tablas por WebSocket (Supabase Realtime, respeta RLS)
 * y llama a `alCambiar` agrupando ráfagas en 300 ms. También recarga al volver a la pestaña
 * y cada `respaldoMs` por si se cortó la conexión del teléfono.
 */
export function useTiempoReal(tablas: string[], alCambiar: (c?: Cambio) => void, respaldoMs = 60000) {
  const fn = useRef(alCambiar);
  fn.current = alCambiar;
  const clave = tablas.join(',');

  useEffect(() => {
    const sb = supabaseNavegador();
    let espera: ReturnType<typeof setTimeout> | null = null;
    const disparar = (c?: Cambio) => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => fn.current(c), 300);
    };
    let canal = sb.channel(`rt-${clave}-${Math.random().toString(36).slice(2)}`);
    for (const t of clave.split(',')) {
      canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, (p) => disparar({ ...p, table: t } as Cambio));
    }
    canal.subscribe();
    fn.current(); // primera carga
    const vis = () => document.visibilityState === 'visible' && disparar();
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(() => disparar(), respaldoMs);
    return () => {
      sb.removeChannel(canal);
      document.removeEventListener('visibilitychange', vis);
      clearInterval(t);
      if (espera) clearTimeout(espera);
    };
  }, [clave, respaldoMs]);
}

// ---------- sonido y notificaciones ----------
let ctx: AudioContext | null = null;

/** Campanita corta. Los navegadores solo dejan sonar después de un toque del usuario en la página. */
export function sonar(tipo: 'nuevo' | 'listo' | 'llamada' = 'nuevo') {
  try {
    ctx = ctx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notas = tipo === 'nuevo' ? [880, 1175] : tipo === 'listo' ? [660, 880, 1046] : [988, 740, 988];
    notas.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      const t0 = ctx!.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.connect(g).connect(ctx!.destination);
      o.start(t0);
      o.stop(t0 + 0.17);
    });
  } catch { /* sin audio */ }
}

export async function notificar(titulo: string, cuerpo: string, url = '/panel') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(titulo, { body: cuerpo, icon: '/iconos/icono-192.png', badge: '/iconos/icono-192.png', data: { url }, tag: titulo + cuerpo });
    else new Notification(titulo, { body: cuerpo, icon: '/iconos/icono-192.png' });
  } catch { /* no soportado */ }
  if ('vibrate' in navigator) navigator.vibrate?.([120, 60, 120]);
}
